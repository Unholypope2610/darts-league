import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

interface Params { params: Promise<{ sessionId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params

  const session = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: {
      players: {
        include: { player: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { turnOrder: "asc" },
      },
      rounds: { orderBy: { createdAt: "asc" } },
    },
  })

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    ...session,
    targetSequence: session.targetSequence ? JSON.parse(session.targetSequence) : null,
    players: session.players.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      name: p.player.name,
      avatarUrl: p.player.avatarUrl ?? null,
      turnOrder: p.turnOrder,
      finalScore: p.finalScore,
      isEliminated: p.isEliminated,
    })),
  })
}
