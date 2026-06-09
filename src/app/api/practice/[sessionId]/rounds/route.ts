import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import type { X01RoundData } from "@/types/api"

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

// PATCH — edit a round's score, recalculating the remainder chain from that point
export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  const { roundId, newScore } = await req.json() as { roundId: string; newScore: number }

  const session = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    select: { finishType: true, rounds: { orderBy: { roundNumber: "asc" } } },
  })
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const target = session.rounds.find((r) => r.id === roundId)
  if (!target) return NextResponse.json({ error: "Round not found" }, { status: 404 })

  const targetData = target.data as X01RoundData
  if (targetData.isCheckout) return NextResponse.json({ error: "Cannot edit checkout" }, { status: 400 })

  const finishType = (session.finishType ?? "DOUBLE_OUT") as "DOUBLE_OUT" | "STRAIGHT_OUT"

  // All rounds for this player in this leg, from the edited round onwards
  const chain = session.rounds.filter(
    (r) => r.playerId === target.playerId &&
      (r.data as X01RoundData).legNumber === targetData.legNumber &&
      r.roundNumber >= target.roundNumber,
  )

  let prevRem = targetData.previousRemainder
  const updates: Array<{ id: string; data: X01RoundData }> = []

  for (const r of chain) {
    const d = r.data as X01RoundData
    const score = r.id === roundId ? newScore : d.scoreThrown
    const rawNew = prevRem - score
    const isBust = rawNew < 0 || (rawNew === 1 && finishType === "DOUBLE_OUT")
    const newRemainder = isBust ? prevRem : rawNew
    const isCheckout = !isBust && rawNew === 0
    updates.push({
      id: r.id,
      data: { ...d, scoreThrown: isBust ? 0 : score, previousRemainder: prevRem, newRemainder, isBust, isCheckout },
    })
    prevRem = newRemainder
  }

  await Promise.all(updates.map((u) => prisma.practiceRound.update({ where: { id: u.id }, data: { data: u.data as object } })))
  return NextResponse.json({ ok: true })
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
