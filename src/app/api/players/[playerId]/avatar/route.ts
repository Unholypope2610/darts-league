import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { canEditPlayer } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const BUCKET = "avatars"
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export async function POST(
  req: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await params

  if (!(await canEditPlayer(playerId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 2 MB" }, { status: 400 })
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const path = `${playerId}/${Date.now()}.${ext}`

  const supabase = createServerSupabaseClient()

  // Ensure bucket exists (noop if already created)
  await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES })

  // Delete old file if it was previously stored in this bucket
  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { avatarUrl: true } })
  if (player?.avatarUrl?.includes(`/${BUCKET}/`)) {
    const oldPath = player.avatarUrl.split(`/${BUCKET}/`)[1]?.split("?")[0]
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath])
  }

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  await prisma.player.update({ where: { id: playerId }, data: { avatarUrl: publicUrl } })

  return NextResponse.json({ avatarUrl: publicUrl })
}
