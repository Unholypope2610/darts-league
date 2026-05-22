import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { updatePlayerSchema } from "@/lib/validations/player.schema"
import { calculateAverage, count180s, highestCheckout, doublesPercentage, top3Checkouts, bestLeg } from "@/lib/utils/stats"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { playerId } = await params

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      _count: { select: { competitionsWon: true } },
      competitionsWon: { select: { id: true, name: true, season: true, type: true } },
      matchesAsA: {
        include: {
          legs: { include: { visits: true } },
          playerB: { select: { id: true, name: true, nickname: true, avatarUrl: true, hand: true } },
        },
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
      },
      matchesAsB: {
        include: {
          legs: { include: { visits: true } },
          playerA: { select: { id: true, name: true, nickname: true, avatarUrl: true, hand: true } },
        },
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
      },
    },
  })

  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const allMatches = [
    ...player.matchesAsA.map((m) => ({ ...m, side: "A" as const })),
    ...player.matchesAsB.map((m) => ({ ...m, side: "B" as const })),
  ].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  const allVisits = allMatches.flatMap((m) =>
    m.legs.flatMap((l) => l.visits.filter((v) => v.playerId === playerId)),
  )

  const first9Visits = allVisits.filter((v) => v.visitNumber <= 3)
  const allLegs = allMatches.filter((m) => m.startingScore === 501).flatMap((m) => m.legs)
  const bestLegDarts = bestLeg(allLegs, playerId)

  const averageHistory = [...allMatches]
    .reverse()
    .map((m) => {
      const matchVisits = m.legs.flatMap((l) => l.visits.filter((v) => v.playerId === playerId))
      const avg = calculateAverage(matchVisits)
      return { date: (m.completedAt ?? m.startedAt).toISOString(), average: parseFloat(avg.toFixed(2)) }
    })
    .filter((e) => e.average > 0)

  const careerStats = {
    played: allMatches.length,
    won: allMatches.filter((m) => m.winnerId === playerId).length,
    lost: allMatches.filter((m) => m.completedAt && m.winnerId !== null && m.winnerId !== playerId).length,
    drawn: allMatches.filter((m) => m.completedAt && m.winnerId === null).length,
    average: calculateAverage(allVisits),
    highest180s: count180s(allVisits),
    highestCheckout: highestCheckout(allVisits),
    doublesPercentage: doublesPercentage(allVisits),
    top3Checkouts: top3Checkouts(allVisits),
    recentForm: allMatches.slice(0, 5).map((m) =>
      m.winnerId === playerId ? "W" : m.winnerId === null ? "D" : "L"
    ) as ("W" | "D" | "L")[],
    first9Average: calculateAverage(first9Visits),
    bestLeg: bestLegDarts,
    averageHistory,
  }

  // Compute H2H records grouped by opponent
  const opponentMap = new Map<string, { opponent: { id: string; name: string; nickname: string | null; avatarUrl: string | null; hand: string }; won: number; drawn: number; lost: number }>()
  for (const m of allMatches) {
    const opponent = m.side === "A" ? m.playerB : m.playerA
    const entry = opponentMap.get(opponent.id) ?? { opponent, won: 0, drawn: 0, lost: 0 }
    if (m.winnerId === playerId) entry.won++
    else if (m.winnerId === null) entry.drawn++
    else entry.lost++
    opponentMap.set(opponent.id, entry)
  }
  const h2h = [...opponentMap.values()]
    .map((e) => ({ ...e, played: e.won + e.drawn + e.lost }))
    .sort((a, b) => b.played - a.played)

  const { matchesAsA: _a, matchesAsB: _b, _count, competitionsWon, ...playerBase } = player
  return NextResponse.json({ ...playerBase, careerStats, h2h, titles: _count.competitionsWon, competitionsWon })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { playerId } = await params
  const body = await req.json()
  const parsed = updatePlayerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const player = await prisma.player.update({
    where: { id: playerId },
    data: parsed.data,
  })
  return NextResponse.json(player)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { playerId } = await params
  await prisma.player.delete({ where: { id: playerId } })
  return new NextResponse(null, { status: 204 })
}
