import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import {
  calculateAverage,
  doublesPercentage,
  count180s,
  count140Plus,
  count100Plus,
  highestCheckout,
  countCheckouts,
  bestLeg,
} from "@/lib/utils/stats"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { competitionId } = await params

  const [fixtureRows, bracketRows] = await Promise.all([
    prisma.fixture.findMany({
      where: { competitionId, status: "COMPLETED" },
      select: { matchId: true },
    }),
    prisma.bracketNode.findMany({
      where: { competitionId, matchId: { not: null } },
      select: { matchId: true },
    }),
  ])

  const allMatchIds = [
    ...new Set([
      ...fixtureRows.map((f) => f.matchId).filter((id): id is string => !!id),
      ...bracketRows.map((b) => b.matchId).filter((id): id is string => !!id),
    ]),
  ]

  if (allMatchIds.length === 0) {
    return NextResponse.json({ players: [], overview: { totalLegs: 0, total180s: 0, highestCheckout: null, bestLeg: null } })
  }

  const matches = await prisma.match.findMany({
    where: { id: { in: allMatchIds }, completedAt: { not: null } },
    include: {
      legs: { include: { visits: true } },
      playerA: true,
      playerB: true,
    },
  })

  // Collect per-player visits and legs
  const playerVisits = new Map<string, typeof matches[0]["legs"][0]["visits"]>()
  const playerLegs = new Map<string, typeof matches[0]["legs"]>()
  const playerMeta = new Map<string, { name: string; avatarUrl: string | null }>()

  for (const match of matches) {
    for (const p of [match.playerA, match.playerB]) {
      if (!playerMeta.has(p.id)) {
        playerMeta.set(p.id, { name: p.name, avatarUrl: p.avatarUrl })
        playerVisits.set(p.id, [])
        playerLegs.set(p.id, [])
      }
    }
    for (const leg of match.legs) {
      playerLegs.get(match.playerAId)?.push(leg)
      playerLegs.get(match.playerBId)?.push(leg)
      for (const visit of leg.visits) {
        playerVisits.get(visit.playerId)?.push(visit)
      }
    }
  }

  const players = Array.from(playerMeta.entries())
    .map(([playerId, meta]) => {
      const visits = playerVisits.get(playerId) ?? []
      const legs = playerLegs.get(playerId) ?? []
      return {
        playerId,
        name: meta.name,
        avatarUrl: meta.avatarUrl,
        average: parseFloat(calculateAverage(visits).toFixed(2)),
        doublesPercentage: doublesPercentage(visits),
        count180s: count180s(visits),
        count140Plus: count140Plus(visits),
        count100Plus: count100Plus(visits),
        highestCheckout: highestCheckout(visits),
        checkouts: countCheckouts(visits),
        bestLeg: bestLeg(legs, playerId),
      }
    })
    .sort((a, b) => b.average - a.average)

  // Tournament overview
  const totalLegs = matches.reduce((sum, m) => sum + m.legs.length, 0)
  const total180s = players.reduce((sum, p) => sum + p.count180s, 0)

  const topCheckout = players.reduce<{ score: number; playerName: string } | null>((best, p) => {
    if (p.highestCheckout > (best?.score ?? 0)) return { score: p.highestCheckout, playerName: p.name }
    return best
  }, null)

  const topBestLeg = players.reduce<{ darts: number; playerName: string } | null>((best, p) => {
    if (p.bestLeg !== null && (best === null || p.bestLeg < best.darts))
      return { darts: p.bestLeg, playerName: p.name }
    return best
  }, null)

  return NextResponse.json({
    players,
    overview: {
      totalLegs,
      total180s,
      highestCheckout: topCheckout,
      bestLeg: topBestLeg,
    },
  })
}
