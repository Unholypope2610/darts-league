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
  const { storageKey, matchId, scoreThrown, isCheckout, remainder, opponentName, playerLegsWon, oppLegsWon, startingScore } = body

  if (!storageKey || !matchId || typeof scoreThrown !== "number") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  // Verify the storage key belongs to this player
  if (!storageKey.startsWith(`${playerId}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageKey)

  const replay = await prisma.replay.create({
    data: {
      playerId,
      matchId,
      scoreThrown,
      isCheckout: Boolean(isCheckout),
      remainder: Number(remainder),
      opponentName: String(opponentName),
      playerLegsWon: Number(playerLegsWon),
      oppLegsWon: Number(oppLegsWon),
      startingScore: Number(startingScore),
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

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true, role: true } })
  if (user?.role !== "ADMIN" && user?.playerId !== playerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const replays = await prisma.replay.findMany({
    where: { playerId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(replays)
}
