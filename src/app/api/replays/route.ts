import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createServerSupabaseClient } from "@/lib/supabase-server"

const BUCKET = "Replays"
const MAX_BYTES = 100 * 1024 * 1024 // 100 MB

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true } })
  if (!user?.playerId) return NextResponse.json({ error: "No player linked to account" }, { status: 403 })
  const playerId = user.playerId

  const formData = await req.formData()
  const video = formData.get("video")
  const matchId = formData.get("matchId")
  const scoreThrown = Number(formData.get("scoreThrown"))
  const isCheckout = formData.get("isCheckout") === "true"
  const remainder = Number(formData.get("remainder"))
  const opponentName = String(formData.get("opponentName") ?? "")
  const playerLegsWon = Number(formData.get("playerLegsWon"))
  const oppLegsWon = Number(formData.get("oppLegsWon"))
  const startingScore = Number(formData.get("startingScore"))

  if (!(video instanceof File) || !matchId || isNaN(scoreThrown)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  if (video.size > MAX_BYTES) {
    return NextResponse.json({ error: "Video too large" }, { status: 400 })
  }

  const path = `${playerId}/${Date.now()}.webm`
  const supabase = createServerSupabaseClient()

  const bytes = await video.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "video/webm", upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const replay = await prisma.replay.create({
    data: {
      playerId,
      matchId: String(matchId),
      scoreThrown,
      isCheckout,
      remainder,
      opponentName,
      playerLegsWon,
      oppLegsWon,
      startingScore,
      storageKey: path,
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

  // Only allow fetching own replays (or admin)
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
