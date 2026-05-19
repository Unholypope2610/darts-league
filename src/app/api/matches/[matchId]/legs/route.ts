import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId } = await params
  const body = await req.json()
  const { starterId } = body as { starterId: string }
  if (!starterId) return NextResponse.json({ error: "starterId required" }, { status: 400 })

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const legCount = await prisma.leg.count({ where: { matchId } })

  const leg = await prisma.leg.create({
    data: {
      matchId,
      legNumber: legCount + 1,
      starterId,
    },
  })

  return NextResponse.json(leg, { status: 201 })
}
