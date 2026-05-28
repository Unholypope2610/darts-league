import { prisma } from "@/lib/prisma"
import { calculateAverage } from "@/lib/utils/stats"
import type { VisitForStats } from "@/lib/utils/stats"

export async function getLeagueWinner(
  competitionId: string,
  divisionId: string,
): Promise<string | null> {
  const fixtures = await prisma.fixture.findMany({
    where: { competitionId, divisionId, status: "COMPLETED" },
    include: {
      match: {
        select: {
          playerAId: true,
          playerBId: true,
          winnerId: true,
          playerAScore: true,
          playerBScore: true,
          legs: { select: { visits: true } },
        },
      },
    },
  })

  const points = new Map<string, number>()
  const legDiff = new Map<string, number>()
  const legsFor = new Map<string, number>()
  const visits = new Map<string, VisitForStats[]>()

  for (const fixture of fixtures) {
    if (!fixture.match) continue
    const { playerAId, playerBId, winnerId, playerAScore, playerBScore, legs } = fixture.match

    const aP = points.get(playerAId) ?? 0
    const bP = points.get(playerBId) ?? 0
    points.set(playerAId, aP + (winnerId === playerAId ? 2 : winnerId === playerBId ? 0 : 1))
    points.set(playerBId, bP + (winnerId === playerBId ? 2 : winnerId === playerAId ? 0 : 1))

    legDiff.set(playerAId, (legDiff.get(playerAId) ?? 0) + playerAScore - playerBScore)
    legDiff.set(playerBId, (legDiff.get(playerBId) ?? 0) + playerBScore - playerAScore)

    legsFor.set(playerAId, (legsFor.get(playerAId) ?? 0) + playerAScore)
    legsFor.set(playerBId, (legsFor.get(playerBId) ?? 0) + playerBScore)

    const allV = legs.flatMap((l) => l.visits as VisitForStats[])
    visits.set(playerAId, [...(visits.get(playerAId) ?? []), ...allV.filter((v) => v.playerId === playerAId)])
    visits.set(playerBId, [...(visits.get(playerBId) ?? []), ...allV.filter((v) => v.playerId === playerBId)])
  }

  if (points.size === 0) return null

  const sorted = [...points.entries()].sort(([aId, aP], [bId, bP]) => {
    if (bP !== aP) return bP - aP
    const aDiff = legDiff.get(aId) ?? 0
    const bDiff = legDiff.get(bId) ?? 0
    if (bDiff !== aDiff) return bDiff - aDiff
    const aFor = legsFor.get(aId) ?? 0
    const bFor = legsFor.get(bId) ?? 0
    if (bFor !== aFor) return bFor - aFor
    const aAvg = calculateAverage(visits.get(aId) ?? [])
    const bAvg = calculateAverage(visits.get(bId) ?? [])
    return bAvg - aAvg
  })

  return sorted[0][0]
}
