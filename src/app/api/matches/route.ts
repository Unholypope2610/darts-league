import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const matches = await prisma.match.findMany({
    where: { fixture: null, bracketNodeId: null },
    include: {
      playerA: { select: { id: true, name: true, avatarUrl: true } },
      playerB: { select: { id: true, name: true, avatarUrl: true } },
      winner: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  })

  return NextResponse.json(matches)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { playerAId, playerBId, bestOf, startingScore, finishType, startingPlayerId } = body

  if (!playerAId || !playerBId) {
    return NextResponse.json({ error: "Both players are required" }, { status: 400 })
  }

  const match = await prisma.$transaction(async (tx) => {
    const newMatch = await tx.match.create({
      data: {
        playerAId,
        playerBId,
        bestOf: bestOf ?? 7,
        startingScore: startingScore ?? 501,
        finishType: finishType ?? "DOUBLE_OUT",
        createdByUserId: userId,
      },
      include: {
        playerA: { select: { id: true, name: true, avatarUrl: true } },
        playerB: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    await tx.leg.create({
      data: {
        matchId: newMatch.id,
        legNumber: 1,
        starterId: startingPlayerId ?? playerAId,
      },
    })

    return newMatch
  })

  // Find the creator's linked player so we can skip notifying them
  const creatorUser = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true } })
  const creatorPlayerId = creatorUser?.playerId ?? null

  // Only notify players who didn't create the match
  const supabase = createServerSupabaseClient()
  const notifications: Promise<unknown>[] = []
  if (match.playerAId !== creatorPlayerId) {
    notifications.push(
      supabase.channel(`player:${match.playerAId}`).send({
        type: "broadcast",
        event: "MATCH_STARTED",
        payload: { matchId: match.id, opponentName: match.playerB.name },
      })
    )
  }
  if (match.playerBId !== creatorPlayerId) {
    notifications.push(
      supabase.channel(`player:${match.playerBId}`).send({
        type: "broadcast",
        event: "MATCH_STARTED",
        payload: { matchId: match.id, opponentName: match.playerA.name },
      })
    )
  }
  notifications.push(
    supabase.channel("match-spectators").send({
      type: "broadcast",
      event: "MATCH_LIVE",
      payload: { matchId: match.id, playerAName: match.playerA.name, playerBName: match.playerB.name, playerAId: match.playerAId, playerBId: match.playerBId },
    })
  )
  await Promise.allSettled(notifications)

  return NextResponse.json(match, { status: 201 })
}
