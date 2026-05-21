import { prisma } from "@/lib/prisma"

export async function getLeagueWinner(
  competitionId: string,
  divisionId: string,
): Promise<string | null> {
  const fixtures = await prisma.fixture.findMany({
    where: { competitionId, divisionId, status: "COMPLETED" },
    include: {
      match: {
        select: { playerAId: true, playerBId: true, winnerId: true, playerAScore: true, playerBScore: true },
      },
    },
  })

  const points = new Map<string, number>()
  const legDiff = new Map<string, number>()

  for (const fixture of fixtures) {
    if (!fixture.match) continue
    const { playerAId, playerBId, winnerId, playerAScore, playerBScore } = fixture.match

    const aPoints = points.get(playerAId) ?? 0
    const bPoints = points.get(playerBId) ?? 0
    points.set(playerAId, aPoints + (winnerId === playerAId ? 2 : winnerId === playerBId ? 0 : 1))
    points.set(playerBId, bPoints + (winnerId === playerBId ? 2 : winnerId === playerAId ? 0 : 1))

    legDiff.set(playerAId, (legDiff.get(playerAId) ?? 0) + playerAScore - playerBScore)
    legDiff.set(playerBId, (legDiff.get(playerBId) ?? 0) + playerBScore - playerAScore)
  }

  if (points.size === 0) return null

  const sorted = [...points.entries()].sort(([aId, aP], [bId, bP]) => {
    if (bP !== aP) return bP - aP
    return (legDiff.get(bId) ?? 0) - (legDiff.get(aId) ?? 0)
  })

  return sorted[0][0]
}
