import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { sendPracticeSessionPush } from "@/lib/push"
import type { HalfItTarget } from "@/types/api"

const MODE_LABELS: Record<string, string> = {
  BOBS_27: "Bob's 27",
  CRICKET: "Cricket",
  HALF_IT: "Half It",
  X01: "x01",
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
        { status: "IN_PROGRESS" },
        { status: "COMPLETED" },
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
      isBot: p.isBot,
      botLevel: p.botLevel ?? null,
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
    isBotGame?: boolean
    botLevel?: number
    startingScore?: number
    legsTarget?: number
  }

  const { gameMode, variant, playerIds, isLocal, isBotGame, botLevel, startingScore, legsTarget } = body
  if (!gameMode || !playerIds || playerIds.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // For x01, finishType comes from variant field
  const finishType = gameMode === "X01" ? (variant ?? "DOUBLE_OUT") : "DOUBLE_OUT"

  const targetSequence =
    gameMode === "HALF_IT"
      ? JSON.stringify(generateHalfItSequence(variant === "RANDOM"))
      : null

  // Find or create sentinel bot player if this is a bot game
  let botPlayerId: string | null = null
  if (isBotGame) {
    let botPlayer = await prisma.player.findFirst({ where: { name: "DartBot" }, select: { id: true } })
    if (!botPlayer) {
      botPlayer = await prisma.player.create({ data: { name: "DartBot" }, select: { id: true } })
    }
    botPlayerId = botPlayer.id
  }

  // Build player create list
  const playerCreateList = [
    ...playerIds.map((pid, idx) => ({ playerId: pid, turnOrder: idx })),
    ...(isBotGame && botPlayerId
      ? [{ playerId: botPlayerId, turnOrder: playerIds.length, isBot: true, botLevel: botLevel ?? 5 }]
      : []),
  ]

  const session = await prisma.practiceSession.create({
    data: {
      gameMode,
      variant: variant ?? "STANDARD",
      isLocal: isLocal ?? false,
      targetSequence,
      isBotGame: isBotGame ?? false,
      startingScore: gameMode === "X01" ? (startingScore ?? 501) : null,
      finishType,
      legsTarget: gameMode === "X01" ? (legsTarget ?? 1) : null,
      players: { create: playerCreateList },
    },
    include: {
      players: { include: { player: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { turnOrder: "asc" } },
      rounds: true,
    },
  })

  // Push notifications — best-effort, non-blocking (skip for bot games)
  if (!isBotGame) {
    void (async () => {
      try {
        const creatorPlayer = await prisma.user.findUnique({
          where: { id: userId },
          select: { playerId: true, player: { select: { name: true } } },
        })
        const creatorName = creatorPlayer?.player?.name ?? "Someone"
        const gameModeLabel = MODE_LABELS[gameMode] ?? gameMode
        const participantPlayerIdSet = new Set(playerIds)

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
  }

  return NextResponse.json({
    ...session,
    targetSequence: session.targetSequence ? JSON.parse(session.targetSequence) : null,
    isBotGame: session.isBotGame,
    startingScore: session.startingScore,
    finishType: session.finishType,
    legsTarget: session.legsTarget,
    players: session.players.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      name: p.player.name,
      avatarUrl: p.player.avatarUrl ?? null,
      turnOrder: p.turnOrder,
      finalScore: p.finalScore ?? null,
      isEliminated: p.isEliminated,
      isBot: p.isBot,
      botLevel: p.botLevel ?? null,
    })),
  }, { status: 201 })
}
