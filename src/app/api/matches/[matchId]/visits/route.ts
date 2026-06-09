import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { recordVisitSchema } from "@/lib/validations/visit.schema"
import { getNewRemainder, isMatchOver, isMatchDraw, matchWinner, computeSetScores } from "@/lib/utils/darts"
import type { RecordVisitResponse } from "@/types/api"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId } = await params
  const body = await req.json()
  const parsed = recordVisitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { legId, playerId, scoreThrown, dartsUsed, doublesAttempted, forceBust } = parsed.data

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (match.completedAt) return NextResponse.json({ error: "Match already completed" }, { status: 400 })

  const leg = await prisma.leg.findUnique({
    where: { id: legId },
    include: { visits: { orderBy: { visitNumber: "asc" } } },
  })
  if (!leg || leg.matchId !== matchId) return NextResponse.json({ error: "Leg not found" }, { status: 404 })

  // Calculate current remainder for this player
  const playerVisits = leg.visits.filter((v) => v.playerId === playerId && !v.isBust)
  const currentRemainder =
    playerVisits.length > 0
      ? playerVisits[playerVisits.length - 1].runningRemainder
      : match.startingScore

  const newRemainder = forceBust
    ? null
    : getNewRemainder(scoreThrown, currentRemainder, match.finishType as "DOUBLE_OUT" | "MASTER_OUT" | "STRAIGHT_OUT")
  const isBust = newRemainder === null
  const isCheckout = !isBust && newRemainder === 0

  const visitNumber = leg.visits.filter((v) => v.playerId === playerId).length + 1
  const runningRemainder = isBust ? currentRemainder : newRemainder!

  const visit = await prisma.visit.create({
    data: {
      legId,
      playerId,
      visitNumber,
      scoreThrown,
      dartsUsed,
      doublesAttempted,
      runningRemainder,
      isBust,
      isCheckout,
    },
  })

  let legWinnerId: string | null = null
  let matchWinnerId: string | null = null
  let matchDraw = false
  let setWinnerId: string | null = null
  let currentSetLegsA = 0
  let currentSetLegsB = 0

  if (isCheckout) {
    // Only count the winning player's darts (not the opponent's)
    const totalDartsThrown = leg.visits
      .filter((v) => v.playerId === playerId)
      .reduce((sum, v) => sum + v.dartsUsed, 0) + dartsUsed

    // Mark leg complete
    await prisma.leg.update({
      where: { id: legId },
      data: { winnerId: playerId, dartsThrown: totalDartsThrown, completedAt: new Date() },
    })

    legWinnerId = playerId

    const isPlayerA = playerId === match.playerAId
    let newAScore: number
    let newBScore: number

    if (match.isSets && match.legSize) {
      // Derive set scores by replaying all completed legs
      const allLegs = await prisma.leg.findMany({
        where: { matchId },
        orderBy: { legNumber: "asc" },
        select: { winnerId: true },
      })
      const { aSets, bSets, aSetLegs, bSetLegs } = computeSetScores(allLegs, match.legSize, match.playerAId)
      currentSetLegsA = aSetLegs
      currentSetLegsB = bSetLegs

      // Check if a set was just won
      if (aSets > match.playerAScore) setWinnerId = match.playerAId
      else if (bSets > match.playerBScore) setWinnerId = match.playerBId

      if (setWinnerId) {
        await prisma.match.update({ where: { id: matchId }, data: { playerAScore: aSets, playerBScore: bSets } })
      }
      newAScore = aSets
      newBScore = bSets
    } else {
      // Legs mode — existing increment approach
      const updatedMatch = await prisma.match.update({
        where: { id: matchId },
        data: {
          playerAScore: isPlayerA ? { increment: 1 } : undefined,
          playerBScore: !isPlayerA ? { increment: 1 } : undefined,
        },
      })
      newAScore = updatedMatch.playerAScore
      newBScore = updatedMatch.playerBScore
    }

    if (isMatchOver(newAScore, newBScore, match.bestOf)) {
      const winner = matchWinner(newAScore, newBScore, match.bestOf, match.playerAId, match.playerBId)
      matchWinnerId = winner
      matchDraw = isMatchDraw(newAScore, newBScore, match.bestOf)

      await prisma.match.update({
        where: { id: matchId },
        data: { winnerId: winner, completedAt: new Date() },
      })

      // Update fixture status
      const fixture = await prisma.fixture.findFirst({ where: { matchId } })
      if (fixture) {
        await prisma.fixture.update({
          where: { id: fixture.id },
          data: { status: "COMPLETED" },
        })
      }

      // Update bracket node if applicable
      if (match.bracketNodeId) {
        const node = await prisma.bracketNode.update({
          where: { id: match.bracketNodeId },
          data: { winnerId: winner },
        })
        if (node.winnerNextNodeId && winner) {
          const nextNode = await prisma.bracketNode.findUnique({ where: { id: node.winnerNextNodeId } })
          if (nextNode) {
            const isNextA = nextNode.seedAId === null
            await prisma.bracketNode.update({
              where: { id: node.winnerNextNodeId },
              data: isNextA ? { seedAId: winner } : { seedBId: winner },
            })
          }
        }
      }
    }
  }

  const response: RecordVisitResponse = {
    visit: {
      id: visit.id,
      playerId: visit.playerId,
      visitNumber: visit.visitNumber,
      scoreThrown: visit.scoreThrown,
      dartsUsed: visit.dartsUsed,
      doublesAttempted: visit.doublesAttempted,
      runningRemainder: visit.runningRemainder,
      isBust: visit.isBust,
      isCheckout: visit.isCheckout,
    },
    isBust,
    isCheckout,
    legWinnerId,
    matchWinnerId,
    isMatchDraw: matchDraw,
    newRemainder: runningRemainder,
    setWinnerId,
    currentSetLegsA,
    currentSetLegsB,
  }

  return NextResponse.json(response)
}
