import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ranked = new URL(req.url).searchParams.get("ranked") === "true"
  const compFilter = ranked ? { isRanked: true } : {}

  const [allVisits, allLegs, allMatches, titlesLeaderboard] = await Promise.all([
    prisma.visit.findMany({
      where: {
        isBust: false,
        ...(ranked ? { leg: { match: { fixture: { competition: compFilter } } } } : {}),
      },
      include: {
        player: { select: { id: true, name: true, avatarUrl: true } },
        leg: {
          include: {
            match: {
              include: {
                fixture: { include: { competition: { select: { id: true, name: true, season: true } } } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.leg.findMany({
      where: {
        winnerId: { not: null },
        ...(ranked ? { match: { fixture: { competition: compFilter } } } : {}),
      },
      include: {
        match: {
          include: {
            playerA: { select: { id: true, name: true, avatarUrl: true } },
            playerB: { select: { id: true, name: true, avatarUrl: true } },
            fixture: { include: { competition: { select: { id: true, name: true, season: true } } } },
          },
        },
      },
    }),
    prisma.match.findMany({
      where: {
        completedAt: { not: null },
        ...(ranked ? { fixture: { competition: compFilter } } : {}),
      },
      include: {
        playerA: { select: { id: true, name: true, avatarUrl: true } },
        playerB: { select: { id: true, name: true, avatarUrl: true } },
        legs: { include: { visits: true } },
        fixture: { include: { competition: { select: { id: true, name: true, season: true } } } },
      },
    }),
    prisma.player.findMany({
      where: { competitionsWon: { some: ranked ? { isRanked: true } : {} } },
      select: {
        id: true, name: true, avatarUrl: true,
        _count: { select: { competitionsWon: { where: ranked ? { isRanked: true } : {} } } },
        competitionsWon: { where: ranked ? { isRanked: true } : {}, select: { id: true, name: true, season: true, type: true } },
      },
      orderBy: { competitionsWon: { _count: "desc" } },
    }),
  ])

  // Highest checkout
  const checkoutVisits = allVisits
    .filter((v) => v.isCheckout)
    .sort((a, b) => b.scoreThrown - a.scoreThrown)
  const highestCheckout = checkoutVisits[0]
    ? {
        player: checkoutVisits[0].player,
        score: checkoutVisits[0].scoreThrown,
        matchId: checkoutVisits[0].leg.match.id,
        date: checkoutVisits[0].createdAt,
        competition: checkoutVisits[0].leg.match.fixture?.competition ?? null,
      }
    : null

  // Best leg (fewest darts to finish) — 501 legs only
  const completedLegs = allLegs.filter(
    (l) => l.winnerId && l.dartsThrown > 0 && l.match.startingScore === 501
  )
  completedLegs.sort((a, b) => a.dartsThrown - b.dartsThrown)
  const bestLegEntry = completedLegs[0]
  const bestLeg = bestLegEntry
    ? {
        player: bestLegEntry.winnerId === bestLegEntry.match.playerAId
          ? bestLegEntry.match.playerA
          : bestLegEntry.match.playerB,
        darts: bestLegEntry.dartsThrown,
        matchId: bestLegEntry.match.id,
        date: bestLegEntry.createdAt,
        competition: bestLegEntry.match.fixture?.competition ?? null,
      }
    : null

  // Most 180s all-time per player
  const s180Counts: Record<string, { player: { id: string; name: string; avatarUrl: string | null }; count: number }> = {}
  for (const v of allVisits) {
    if (v.scoreThrown === 180) {
      if (!s180Counts[v.playerId]) s180Counts[v.playerId] = { player: v.player, count: 0 }
      s180Counts[v.playerId].count++
    }
  }
  const most180s = Object.values(s180Counts).sort((a, b) => b.count - a.count).slice(0, 10)

  // Highest match average + best first 9 per match
  type MatchAvgEntry = {
    player: { id: string; name: string; avatarUrl: string | null }
    average: number
    matchId: string
    competition: { id: string; name: string; season: string } | null
    date: Date
  }
  let highestAverage: MatchAvgEntry | null = null
  let bestFirst9: MatchAvgEntry | null = null
  for (const match of allMatches) {
    for (const pId of [match.playerAId, match.playerBId]) {
      const player = pId === match.playerAId ? match.playerA : match.playerB
      const playerVisits = match.legs.flatMap((l) => l.visits).filter((v) => v.playerId === pId && !v.isBust)
      const totalDarts = playerVisits.reduce((a, v) => a + v.dartsUsed, 0)
      const totalScore = playerVisits.reduce((a, v) => a + v.scoreThrown, 0)
      if (totalDarts === 0) continue
      const avg = (totalScore / totalDarts) * 3
      if (!highestAverage || avg > highestAverage.average) {
        highestAverage = {
          player,
          average: avg,
          matchId: match.id,
          competition: match.fixture?.competition ?? null,
          date: match.startedAt,
        }
      }

      const f9Visits = playerVisits.filter((v) => v.visitNumber <= 3)
      const f9Darts = f9Visits.reduce((a, v) => a + v.dartsUsed, 0)
      const f9Score = f9Visits.reduce((a, v) => a + v.scoreThrown, 0)
      if (f9Darts > 0) {
        const f9avg = (f9Score / f9Darts) * 3
        if (!bestFirst9 || f9avg > bestFirst9.average) {
          bestFirst9 = { player, average: f9avg, matchId: match.id, competition: match.fixture?.competition ?? null, date: match.startedAt }
        }
      }
    }
  }

  // Top career averages
  const careerStats: Record<string, { player: { id: string; name: string; avatarUrl: string | null }; totalScore: number; totalDarts: number }> = {}
  for (const v of allVisits) {
    if (!careerStats[v.playerId]) careerStats[v.playerId] = { player: v.player, totalScore: 0, totalDarts: 0 }
    careerStats[v.playerId].totalScore += v.scoreThrown
    careerStats[v.playerId].totalDarts += v.dartsUsed
  }
  const topAverages = Object.values(careerStats)
    .filter((s) => s.totalDarts > 0)
    .map((s) => ({ player: s.player, average: (s.totalScore / s.totalDarts) * 3 }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 10)

  const mostTitles = titlesLeaderboard.map((p) => ({
    player: { id: p.id, name: p.name, avatarUrl: p.avatarUrl },
    count: p._count.competitionsWon,
    competitionsWon: p.competitionsWon,
  }))

  return NextResponse.json({
    highestCheckout,
    bestLeg,
    most180s,
    highestAverage,
    bestFirst9,
    topAverages,
    mostTitles,
  })
}
