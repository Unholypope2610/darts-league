import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId } = await params

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Find the active leg (no winner yet)
  const activeLeg = await prisma.leg.findFirst({
    where: { matchId, completedAt: null },
    include: { visits: { orderBy: { createdAt: "desc" } } },
  })
  if (!activeLeg || activeLeg.visits.length === 0) {
    return NextResponse.json({ error: "No visits to undo" }, { status: 400 })
  }

  const lastVisit = activeLeg.visits[0]
  await prisma.visit.delete({ where: { id: lastVisit.id } })

  // Recalculate remainders
  const remainingVisits = await prisma.visit.findMany({
    where: { legId: activeLeg.id },
    orderBy: { createdAt: "asc" },
  })

  const aVisits = remainingVisits.filter((v) => v.playerId === match.playerAId && !v.isBust)
  const bVisits = remainingVisits.filter((v) => v.playerId === match.playerBId && !v.isBust)

  const playerARemainder =
    aVisits.length > 0 ? aVisits[aVisits.length - 1].runningRemainder : match.startingScore
  const playerBRemainder =
    bVisits.length > 0 ? bVisits[bVisits.length - 1].runningRemainder : match.startingScore

  // Determine whose turn it is
  const lastRemaining = remainingVisits[remainingVisits.length - 1]
  const currentTurnPlayerId = lastRemaining
    ? lastRemaining.playerId === match.playerAId
      ? match.playerBId
      : match.playerAId
    : activeLeg.starterId

  return NextResponse.json({
    removedVisitId: lastVisit.id,
    playerARemainder,
    playerBRemainder,
    currentTurnPlayerId,
  })
}
