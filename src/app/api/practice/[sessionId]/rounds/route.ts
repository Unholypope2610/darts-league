import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

interface Params { params: Promise<{ sessionId: string }> }

export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  const body = await req.json() as { playerId: string; roundNumber: number; legNumber?: number; data: unknown }

  const round = await prisma.practiceRound.create({
    data: {
      sessionId,
      playerId: body.playerId,
      roundNumber: body.roundNumber,
      legNumber: body.legNumber ?? 1,
      data: body.data as object,
    },
  })

  return NextResponse.json(round, { status: 201 })
}

// DELETE — undo last round
export async function DELETE(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  const { roundId } = await req.json() as { roundId: string }

  await prisma.practiceRound.delete({ where: { id: roundId, sessionId } })
  return NextResponse.json({ ok: true })
}
