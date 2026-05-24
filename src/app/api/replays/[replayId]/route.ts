import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createServerSupabaseClient } from "@/lib/supabase-server"

const BUCKET = "Replays"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ replayId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { replayId } = await params

  const replay = await prisma.replay.findUnique({ where: { id: replayId } })
  if (!replay) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true, role: true } })
  if (user?.role !== "ADMIN" && user?.playerId !== replay.playerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()
  await supabase.storage.from(BUCKET).remove([replay.storageKey])
  await prisma.replay.delete({ where: { id: replayId } })

  return NextResponse.json({ ok: true })
}
