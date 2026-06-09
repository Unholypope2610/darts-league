import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ competitionId: string; nodeId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { competitionId, nodeId } = await params

  const [competition, node] = await Promise.all([
    prisma.competition.findUnique({
      where: { id: competitionId },
      select: { bestOf: true, startingScore: true, finishType: true, isSets: true, legSize: true, bracketBestOf: true, bracketStartingScore: true, bracketFinishType: true },
    }),
    prisma.bracketNode.findUnique({ where: { id: nodeId } }),
  ])

  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 })
  if (!node) return NextResponse.json({ error: "Bracket node not found" }, { status: 404 })
  if (!node.seedAId || !node.seedBId) return NextResponse.json({ error: "Both seeds must be set before starting" }, { status: 400 })
  if (node.matchId) return NextResponse.json({ matchId: node.matchId })

  const match = await prisma.match.create({
    data: {
      playerAId: node.seedAId,
      playerBId: node.seedBId,
      startingScore: competition.bracketStartingScore ?? competition.startingScore,
      bestOf: competition.bracketBestOf ?? competition.bestOf,
      finishType: competition.bracketFinishType ?? competition.finishType,
      isSets: competition.isSets ?? false,
      legSize: competition.legSize ?? null,
      bracketNodeId: node.id,
    },
    include: { playerA: { select: { name: true } }, playerB: { select: { name: true } } },
  })

  await prisma.bracketNode.update({ where: { id: nodeId }, data: { matchId: match.id } })

  const creatorUser = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true } })
  const creatorPlayerId = creatorUser?.playerId ?? null

  const supabase = createServerSupabaseClient()
  const notifications: Promise<unknown>[] = []
  if (match.playerAId !== creatorPlayerId) {
    notifications.push(supabase.channel(`player:${match.playerAId}`).send({
      type: "broadcast", event: "MATCH_STARTED",
      payload: { matchId: match.id, opponentName: match.playerB.name },
    }))
  }
  if (match.playerBId !== creatorPlayerId) {
    notifications.push(supabase.channel(`player:${match.playerBId}`).send({
      type: "broadcast", event: "MATCH_STARTED",
      payload: { matchId: match.id, opponentName: match.playerA.name },
    }))
  }
  notifications.push(
    supabase.channel("match-spectators").send({
      type: "broadcast",
      event: "MATCH_LIVE",
      payload: { matchId: match.id, playerAName: match.playerA.name, playerBName: match.playerB.name, playerAId: match.playerAId, playerBId: match.playerBId },
    })
  )
  await Promise.allSettled(notifications)

  return NextResponse.json({ matchId: match.id })
}
