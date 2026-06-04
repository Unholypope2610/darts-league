import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createServerSupabaseClient } from "@/lib/supabase-server"

const BUCKET = "Replays"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true } })
  if (!user?.playerId) return NextResponse.json({ error: "No player linked to account" }, { status: 403 })
  const playerId = user.playerId

  const body = await req.json()
  const {
    storageKey, matchId, practiceSessionId, gameMode, practiceContext,
    scoreThrown, isCheckout, remainder, opponentName, playerLegsWon, oppLegsWon,
    startingScore, durationMs, scorerPlayerId,
  } = body

  const isPractice = !matchId && !!practiceSessionId
  if (!storageKey || (!matchId && !practiceSessionId) || typeof scoreThrown !== "number") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  let targetPlayerId = playerId
  if (!isPractice && scorerPlayerId && scorerPlayerId !== playerId) {
    // In local play the scorer may differ from the authenticated user — verify they share a local match
    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        isLocal: true,
        OR: [{ playerAId: playerId }, { playerBId: playerId }],
      },
      select: { playerAId: true, playerBId: true },
    })
    if (!match || (match.playerAId !== scorerPlayerId && match.playerBId !== scorerPlayerId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    targetPlayerId = scorerPlayerId
  }

  // Verify the storage key belongs to the target player
  if (!storageKey.startsWith(`${targetPlayerId}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageKey)

  const replay = await prisma.replay.create({
    data: {
      playerId: targetPlayerId,
      matchId: matchId ?? null,
      practiceSessionId: practiceSessionId ?? null,
      gameMode: gameMode ?? null,
      practiceContext: practiceContext ?? null,
      scoreThrown,
      isCheckout: Boolean(isCheckout),
      remainder: Number(remainder) || 0,
      opponentName: String(opponentName ?? ""),
      playerLegsWon: Number(playerLegsWon) || 0,
      oppLegsWon: Number(oppLegsWon) || 0,
      startingScore: Number(startingScore) || 0,
      durationMs: Number(durationMs) || 0,
      storageKey,
      storageUrl: publicUrl,
    },
  })

  return NextResponse.json({ id: replay.id, storageUrl: publicUrl })
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const playerId = searchParams.get("playerId")
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 })

  const replays = await prisma.replay.findMany({
    where: { playerId },
    orderBy: { createdAt: "desc" },
  })

  // Generate signed download URLs (1 hour) so the video loads regardless of bucket privacy
  const supabase = createServerSupabaseClient()
  const keys = replays.map((r) => r.storageKey)
  const { data: signed } = keys.length
    ? await supabase.storage.from(BUCKET).createSignedUrls(keys, 3600)
    : { data: [] }

  const signedMap = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))

  const result = replays.map((r) => ({
    ...r,
    viewUrl: signedMap.get(r.storageKey) ?? r.storageUrl,
  }))

  return NextResponse.json(result)
}
