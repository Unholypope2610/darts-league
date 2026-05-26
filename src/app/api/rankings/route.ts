import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

  const points = await prisma.rankingPoint.findMany({
    where: { awardedAt: { gte: since } },
    include: {
      player: { select: { id: true, name: true, avatarUrl: true } },
      competition: { select: { name: true, season: true } },
    },
    orderBy: { awardedAt: "desc" },
  })

  // Group by player
  const playerMap = new Map<string, {
    playerId: string
    name: string
    avatarUrl: string | null
    points: number
    eventsEntered: number
    breakdown: {
      competitionId: string
      competitionName: string
      season: string
      points: number
      placementLabel: string
      entrantCount: number
      awardedAt: string
      expiresAt: string
    }[]
  }>()

  for (const rp of points) {
    const existing = playerMap.get(rp.playerId) ?? {
      playerId: rp.playerId,
      name: rp.player.name,
      avatarUrl: rp.player.avatarUrl,
      points: 0,
      eventsEntered: 0,
      breakdown: [] as { competitionId: string; competitionName: string; season: string; points: number; placementLabel: string; entrantCount: number; awardedAt: string; expiresAt: string }[],
    }
    existing.points += rp.points
    existing.eventsEntered += 1
    const expiry = new Date(rp.awardedAt)
    expiry.setFullYear(expiry.getFullYear() + 1)
    existing.breakdown.push({
      competitionId: rp.competitionId,
      competitionName: rp.competition.name,
      season: rp.competition.season,
      points: rp.points,
      placementLabel: rp.placementLabel,
      entrantCount: rp.entrantCount,
      awardedAt: rp.awardedAt.toISOString(),
      expiresAt: expiry.toISOString(),
    })
    playerMap.set(rp.playerId, existing)
  }

  // Fetch ranked title counts
  const rankedTitleCounts = await prisma.competition.groupBy({
    by: ["winnerId"],
    where: { isRanked: true, status: "COMPLETED", winnerId: { not: null } },
    _count: { winnerId: true },
  })
  const titleMap = new Map(rankedTitleCounts.map((r) => [r.winnerId!, r._count.winnerId]))

  const leaderboard = [...playerMap.values()]
    .map((p) => ({ ...p, rankedTitles: titleMap.get(p.playerId) ?? 0 }))
    .sort((a, b) => b.points - a.points)

  return NextResponse.json(leaderboard)
}
