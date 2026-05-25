import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { sendMatchStartPush } from "@/lib/push"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { fixtureId } = await params

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true, role: true } })
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: { match: { include: { playerA: true, playerB: true } } },
  })
  if (!fixture || !fixture.match) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isParticipant = user.playerId === fixture.playerAId || user.playerId === fixture.playerBId
  if (!isParticipant && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (fixture.status !== "PAUSED") {
    return NextResponse.json({ error: "Match is not paused" }, { status: 400 })
  }

  await prisma.fixture.update({ where: { id: fixtureId }, data: { status: "LIVE" } })

  const match = fixture.match
  const supabase = createServerSupabaseClient()
  const notifications: Promise<unknown>[] = []

  // Notify the other player (not the one who clicked Resume)
  if (match.playerAId !== user.playerId) {
    notifications.push(supabase.channel(`player:${match.playerAId}`).send({
      type: "broadcast", event: "MATCH_STARTED",
      payload: { matchId: match.id, opponentName: match.playerB.name },
    }))
  }
  if (match.playerBId !== user.playerId) {
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

  // Push notifications — only to the other player
  const [playerAUser, playerBUser] = await Promise.all([
    prisma.user.findFirst({ where: { playerId: match.playerAId }, select: { id: true } }),
    prisma.user.findFirst({ where: { playerId: match.playerBId }, select: { id: true } }),
  ])
  const pushPromises: Promise<void>[] = []
  if (playerAUser && match.playerAId !== user.playerId) {
    pushPromises.push(sendMatchStartPush(playerAUser.id, match.playerB.name, match.id))
  }
  if (playerBUser && match.playerBId !== user.playerId) {
    pushPromises.push(sendMatchStartPush(playerBUser.id, match.playerA.name, match.id))
  }
  await Promise.allSettled(pushPromises)

  return NextResponse.json({ matchId: match.id })
}
