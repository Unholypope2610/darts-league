import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createServerSupabaseClient } from "@/lib/supabase-server"

const BUCKET = "Replays"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true } })
  if (!user?.playerId) return NextResponse.json({ error: "No player linked" }, { status: 403 })

  let targetPlayerId = user.playerId

  let mimeType = "video/webm"
  try {
    const body = await req.json() as { scorerPlayerId?: string; matchId?: string; mimeType?: string }
    if (body.mimeType) mimeType = body.mimeType
    if (body.scorerPlayerId && body.scorerPlayerId !== user.playerId && body.matchId) {
      const match = await prisma.match.findFirst({
        where: {
          id: body.matchId,
          isLocal: true,
          OR: [{ playerAId: user.playerId }, { playerBId: user.playerId }],
        },
        select: { playerAId: true, playerBId: true },
      })
      if (match && (match.playerAId === body.scorerPlayerId || match.playerBId === body.scorerPlayerId)) {
        targetPlayerId = body.scorerPlayerId
      }
    }
  } catch { /* no body — use auth user's player */ }

  const ext = mimeType.includes("mp4") ? "mp4" : "webm"
  const path = `${targetPlayerId}/${Date.now()}.${ext}`
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create upload URL" }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path })
}
