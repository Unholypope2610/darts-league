import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function winnerVisitScores(startingScore: number): number[] {
  const checkout = 40
  const scores: number[] = []
  let rem = startingScore - checkout
  while (rem > 180) { scores.push(180); rem -= 180 }
  if (rem > 0) scores.push(rem)
  scores.push(checkout)
  return scores
}

interface VisitData {
  playerId: string
  visitNumber: number
  scoreThrown: number
  dartsUsed: number
  doublesAttempted: number
  runningRemainder: number
  isBust: boolean
  isCheckout: boolean
}

function buildLegVisits(
  startingScore: number,
  winnerId: string,
  loserId: string,
  winnerStarts: boolean,
): { visits: VisitData[]; dartsThrown: number } {
  const winScores = winnerVisitScores(startingScore)
  const visits: VisitData[] = []
  let winnerRem = startingScore
  let loserRem = startingScore
  let winnerVisitNum = 0
  let loserVisitNum = 0

  for (let i = 0; i < winScores.length; i++) {
    const isCheckout = i === winScores.length - 1
    if (!winnerStarts) {
      loserRem -= 60
      loserVisitNum++
      visits.push({ playerId: loserId, visitNumber: loserVisitNum, scoreThrown: 60, dartsUsed: 3, doublesAttempted: 0, runningRemainder: loserRem, isBust: false, isCheckout: false })
    }
    const score = winScores[i]
    winnerRem -= score
    winnerVisitNum++
    visits.push({ playerId: winnerId, visitNumber: winnerVisitNum, scoreThrown: score, dartsUsed: isCheckout ? 2 : 3, doublesAttempted: isCheckout ? 1 : 0, runningRemainder: winnerRem, isBust: false, isCheckout })
    if (winnerStarts && !isCheckout) {
      loserRem -= 60
      loserVisitNum++
      visits.push({ playerId: loserId, visitNumber: loserVisitNum, scoreThrown: 60, dartsUsed: 3, doublesAttempted: 0, runningRemainder: loserRem, isBust: false, isCheckout: false })
    }
  }

  const dartsThrown = visits.filter((v) => v.playerId === winnerId).reduce((s, v) => s + v.dartsUsed, 0)
  return { visits, dartsThrown }
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { competitionId } = await params

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { bestOf: true, startingScore: true, finishType: true, bracketBestOf: true, bracketStartingScore: true, bracketFinishType: true },
    })
    if (!competition) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const nodes = await prisma.bracketNode.findMany({
      where: { competitionId },
      orderBy: [{ round: "desc" }, { position: "asc" }],
    })

    if (nodes.length === 0) return NextResponse.json({ error: "No bracket generated yet" }, { status: 400 })

    const bestOf = competition.bracketBestOf ?? competition.bestOf
    const startingScore = competition.bracketStartingScore ?? competition.startingScore
    const finishType = competition.bracketFinishType ?? competition.finishType
    const legsToWin = Math.floor(bestOf / 2) + 1
    const now = new Date()

    // Mutable working state for each node — we'll update seeds as winners advance
    type NodeState = {
      id: string
      round: number
      position: number
      seedAId: string | null
      seedBId: string | null
      winnerId: string | null
      winnerNextNodeId: string | null
      matchId: string | null
    }
    const nodeMap = new Map<string, NodeState>(
      nodes.map((n) => [n.id, { ...n, winnerId: n.winnerId, winnerNextNodeId: n.winnerNextNodeId, matchId: n.matchId }])
    )

    type MatchRow = { id: string; bracketNodeId: string; playerAId: string; playerBId: string; startingScore: number; bestOf: number; finishType: string; isSets: boolean; playerAScore: number; playerBScore: number; winnerId: string; startedAt: Date; completedAt: Date }
    type LegRow = { id: string; matchId: string; legNumber: number; starterId: string; winnerId: string; dartsThrown: number; completedAt: Date }
    type VisitRow = VisitData & { legId: string }

    const matchRows: MatchRow[] = []
    const legRows: LegRow[] = []
    const visitRows: VisitRow[] = []

    // Process rounds from outermost (highest round number) to final (round 1)
    const rounds = [...new Set<number>(nodes.map((n) => n.round))].sort((a, b) => b - a)

    for (const round of rounds) {
      const roundNodes = nodes
        .filter((n) => n.round === round)
        .sort((a, b) => a.position - b.position)

      // Track winners in position order so we can fill seedA then seedB on the next node
      const advancingTo = new Map<string, string[]>()

      for (const node of roundNodes) {
        const state = nodeMap.get(node.id)!
        if (!state.seedAId || !state.seedBId) continue // TBD slots, skip
        if (state.matchId) continue // already has a match

        const playerAId = state.seedAId
        const playerBId = state.seedBId
        const matchWinnerId = Math.random() < 0.5 ? playerAId : playerBId
        const matchLoserId = matchWinnerId === playerAId ? playerBId : playerAId
        const loserLegsWon = Math.floor(Math.random() * legsToWin)

        const outcomes: ("W" | "L")[] = shuffle([
          ...Array<"W">(legsToWin - 1).fill("W"),
          ...Array<"L">(loserLegsWon).fill("L"),
        ])
        outcomes.push("W")

        const playerAScore = outcomes.filter((o) => (o === "W") === (matchWinnerId === playerAId)).length
        const playerBScore = outcomes.length - playerAScore

        const matchId = randomUUID()
        state.matchId = matchId
        state.winnerId = matchWinnerId

        matchRows.push({ id: matchId, bracketNodeId: node.id, playerAId, playerBId, startingScore, bestOf, finishType, isSets: false, playerAScore, playerBScore, winnerId: matchWinnerId, startedAt: now, completedAt: now })

        for (let legIdx = 0; legIdx < outcomes.length; legIdx++) {
          const legWinnerId = outcomes[legIdx] === "W" ? matchWinnerId : matchLoserId
          const legLoserId = legWinnerId === playerAId ? playerBId : playerAId
          const winnerStarts = Math.random() < 0.5
          const { visits, dartsThrown } = buildLegVisits(startingScore, legWinnerId, legLoserId, winnerStarts)
          const legId = randomUUID()
          legRows.push({ id: legId, matchId, legNumber: legIdx + 1, starterId: winnerStarts ? legWinnerId : legLoserId, winnerId: legWinnerId, dartsThrown, completedAt: now })
          for (const v of visits) visitRows.push({ ...v, legId })
        }

        if (state.winnerNextNodeId) {
          if (!advancingTo.has(state.winnerNextNodeId)) advancingTo.set(state.winnerNextNodeId, [])
          advancingTo.get(state.winnerNextNodeId)!.push(matchWinnerId)
        }
      }

      // Seed winners into next-round nodes before processing that round
      for (const [nextId, winners] of advancingTo) {
        const next = nodeMap.get(nextId)!
        if (winners[0]) next.seedAId = winners[0]
        if (winners[1]) next.seedBId = winners[1]
      }
    }

    if (matchRows.length === 0) return NextResponse.json({ simulated: 0 })

    await prisma.match.createMany({ data: matchRows })
    await prisma.leg.createMany({ data: legRows })
    await prisma.visit.createMany({ data: visitRows })

    // Update bracket nodes with matchId, winnerId, and any advanced seeds
    await Promise.all(
      [...nodeMap.values()].map((state) =>
        prisma.bracketNode.update({
          where: { id: state.id },
          data: {
            matchId: state.matchId,
            winnerId: state.winnerId,
            seedAId: state.seedAId,
            seedBId: state.seedBId,
          },
        })
      )
    )

    return NextResponse.json({ simulated: matchRows.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[simulate-bracket]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
