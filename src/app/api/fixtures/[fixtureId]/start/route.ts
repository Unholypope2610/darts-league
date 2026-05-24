import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { startMatchSchema } from "@/lib/validations/visit.schema"
import { sendMatchStartPush } from "@/lib/push"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { fixtureId } = await params
  const body = await req.json()
  const parsed = startMatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: { competition: true },
  })
  if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (fixture.status === "COMPLETED") {
    return NextResponse.json({ error: "Fixture already completed" }, { status: 400 })
  }

  const { startingPlayerId, isLocal, ...matchFormat } = parsed.data

  // Create match + first leg in a transaction
  const [match] = await prisma.$transaction(async (tx) => {
    const newMatch = await tx.match.create({
      data: {
        ...matchFormat,
        isLocal: isLocal === true,
        playerAId: fixture.playerAId,
        playerBId: fixture.playerBId,
      },
      include: { playerA: true, playerB: true },
    })

    // Link match to fixture
    await tx.fixture.update({
      where: { id: fixtureId },
      data: { matchId: newMatch.id, status: "LIVE" },
    })

    // Create first leg
    await tx.leg.create({
      data: {
        matchId: newMatch.id,
        legNumber: 1,
        starterId: startingPlayerId,
      },
    })

    return [newMatch]
  })

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

  // Native push to players who have subscriptions
  const [playerAUser, playerBUser] = await Promise.all([
    prisma.user.findFirst({ where: { playerId: match.playerAId }, select: { id: true } }),
    prisma.user.findFirst({ where: { playerId: match.playerBId }, select: { id: true } }),
  ])
  const pushPromises: Promise<void>[] = []
  if (playerAUser && match.playerAId !== creatorPlayerId) {
    pushPromises.push(sendMatchStartPush(playerAUser.id, match.playerB.name, match.id))
  }
  if (playerBUser && match.playerBId !== creatorPlayerId) {
    pushPromises.push(sendMatchStartPush(playerBUser.id, match.playerA.name, match.id))
  }
  await Promise.allSettled(pushPromises)

  return NextResponse.json(match, { status: 201 })
}
