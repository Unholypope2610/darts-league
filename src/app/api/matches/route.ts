import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const matches = await prisma.match.findMany({
    where: { fixture: null, bracketNodeId: null },
    include: {
      playerA: { select: { id: true, name: true, avatarUrl: true } },
      playerB: { select: { id: true, name: true, avatarUrl: true } },
      winner: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  })

  return NextResponse.json(matches)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { playerAId, playerBId, bestOf, startingScore, finishType, startingPlayerId } = body

  if (!playerAId || !playerBId) {
    return NextResponse.json({ error: "Both players are required" }, { status: 400 })
  }

  const match = await prisma.$transaction(async (tx) => {
    const newMatch = await tx.match.create({
      data: {
        playerAId,
        playerBId,
        bestOf: bestOf ?? 7,
        startingScore: startingScore ?? 501,
        finishType: finishType ?? "DOUBLE_OUT",
      },
      include: {
        playerA: { select: { id: true, name: true, avatarUrl: true } },
        playerB: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    await tx.leg.create({
      data: {
        matchId: newMatch.id,
        legNumber: 1,
        starterId: startingPlayerId ?? playerAId,
      },
    })

    return newMatch
  })

  return NextResponse.json(match, { status: 201 })
}
