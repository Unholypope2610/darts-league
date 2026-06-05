import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { sendPracticeSessionPush } from "@/lib/push"
import type { HalfItTarget } from "@/types/api"

const MODE_LABELS: Record<string, string> = {
  BOBS_27: "Bob's 27",
  CRICKET: "Cricket",
  HALF_IT: "Half It",
}

function generateHalfItSequence(random: boolean): HalfItTarget[] {
  const base: HalfItTarget[] = [
    { type: "NUMBER", value: 20 },
    { type: "NUMBER", value: 16 },
    { type: "DOUBLES" },
    { type: "NUMBER", value: 17 },
    { type: "NUMBER", value: 18 },
    { type: "TREBLES" },
    { type: "NUMBER", value: 19 },
    { type: "NUMBER", value: 15 },
    { type: "BULL" },
    { type: "3_DIFF_COLOURS" },
    { type: "3_SAME_COLOUR" },
    {
      type: "WILDCARD",
      wildcardTargets: [
        Math.floor(Math.random() * 40) + 21, // 21–60
        Math.floor(Math.random() * 60) + 61, // 61–120
      ],
    },
  ]
  if (!random) return base
  // Fisher-Yates shuffle
  const arr = [...base]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true } })
  if (!user?.playerId) return NextResponse.json([])

  const sessions = await prisma.practiceSession.findMany({
    where: {
      OR: [
        // All in-progress sessions visible to everyone (for spectating)
        { status: "IN_PROGRESS" },
        // Completed sessions only for the user's own games
        { status: "COMPLETED", players: { some: { playerId: user.playerId } } },
      ],
    },
    include: {
      players: { include: { player: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { turnOrder: "asc" } },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  })

  return NextResponse.json(sessions.map((s) => ({
    ...s,
    players: s.players.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      name: p.player.name,
      avatarUrl: p.player.avatarUrl ?? null,
      turnOrder: p.turnOrder,
      finalScore: p.finalScore,
      isEliminated: p.isEliminated,
    })),
  })))
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    gameMode: string
    variant: string
    playerIds: string[]
    isLocal: boolean
  }

  const { gameMode, variant, playerIds, isLocal } = body
  if (!gameMode || !playerIds || playerIds.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const targetSequence =
    gameMode === "HALF_IT"
      ? JSON.stringify(generateHalfItSequence(variant === "RANDOM"))
      : null

  const session = await prisma.practiceSession.create({
    data: {
      gameMode,
      variant: variant ?? "STANDARD",
      isLocal: isLocal ?? false,
      targetSequence,
      players: {
        create: playerIds.map((pid, idx) => ({ playerId: pid, turnOrder: idx })),
      },
    },
    include: {
      players: { include: { player: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { turnOrder: "asc" } },
      rounds: true,
    },
  })

  // Push notifications — best-effort, non-blocking
  void (async () => {
    try {
      const creatorPlayer = await prisma.user.findUnique({
        where: { id: userId },
        select: { playerId: true, player: { select: { name: true } } },
      })
      const creatorName = creatorPlayer?.player?.name ?? "Someone"
      const gameModeLabel = MODE_LABELS[gameMode] ?? gameMode
      const participantPlayerIdSet = new Set(playerIds)

      // All subscribed users except the creator
      const targets = await prisma.user.findMany({
        where: { id: { not: userId }, pushSubscriptions: { some: {} } },
        select: { id: true, playerId: true },
      })

      await Promise.allSettled(
        targets.map((u) => {
          const role = u.playerId && participantPlayerIdSet.has(u.playerId) ? "participant" : "spectator"
          return sendPracticeSessionPush(u.id, creatorName, session.id, gameModeLabel, role)
        }),
      )
    } catch { /* notifications are best-effort */ }
  })()

  return NextResponse.json({
    ...session,
    targetSequence: session.targetSequence ? JSON.parse(session.targetSequence) : null,
    players: session.players.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      name: p.player.name,
      avatarUrl: p.player.avatarUrl ?? null,
      turnOrder: p.turnOrder,
      finalScore: p.finalScore ?? null,
      isEliminated: p.isEliminated,
    })),
  }, { status: 201 })
}
