import { prisma } from "@/lib/prisma"

function calcPoints(championPts: number, pct: number): number {
  return Math.round(championPts * pct)
}

function leaguePlacements(sorted: string[]): { playerId: string; label: string; pct: number }[] {
  const labels = ["Champion", "Runner-up", "3rd Place", "4th Place"]
  return sorted.map((playerId, i) => ({
    playerId,
    label: labels[i] ?? `${i + 1}th Place`,
    pct: i === 0 ? 0.85 : i === 1 ? 0.55 : i === 2 ? 0.35 : i === 3 ? 0.20 : 0.06,
  }))
}

async function getLeagueStandings(competitionId: string, divisionId: string): Promise<string[]> {
  const fixtures = await prisma.fixture.findMany({
    where: { competitionId, divisionId, status: "COMPLETED" },
    include: {
      match: { select: { playerAId: true, playerBId: true, winnerId: true, playerAScore: true, playerBScore: true } },
    },
  })

  const pts = new Map<string, number>()
  const legDiff = new Map<string, number>()

  for (const f of fixtures) {
    if (!f.match) continue
    const { playerAId, playerBId, winnerId, playerAScore, playerBScore } = f.match
    pts.set(playerAId, (pts.get(playerAId) ?? 0) + (winnerId === playerAId ? 2 : winnerId === playerBId ? 0 : 1))
    pts.set(playerBId, (pts.get(playerBId) ?? 0) + (winnerId === playerBId ? 2 : winnerId === playerAId ? 0 : 1))
    legDiff.set(playerAId, (legDiff.get(playerAId) ?? 0) + playerAScore - playerBScore)
    legDiff.set(playerBId, (legDiff.get(playerBId) ?? 0) + playerBScore - playerAScore)
  }

  return [...pts.entries()]
    .sort(([aId, aP], [bId, bP]) => bP !== aP ? bP - aP : (legDiff.get(bId) ?? 0) - (legDiff.get(aId) ?? 0))
    .map(([id]) => id)
}

export async function awardRankingPoints(competitionId: string): Promise<void> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      divisions: { include: { players: true }, orderBy: { tier: "asc" } },
      bracketNodes: true,
    },
  })

  if (!competition || !competition.isRanked) return

  // Count total entrants across all divisions
  const allPlayerIds = [
    ...new Set(competition.divisions.flatMap((d) => d.players.map((p) => p.playerId))),
  ]
  const entrantCount = allPlayerIds.length
  if (entrantCount < 4) return

  // Snapshot entrantCount
  await prisma.competition.update({ where: { id: competitionId }, data: { entrantCount } })

  const championPts = Math.min(50 + entrantCount * 5, 500)
  const hasBracket = competition.bracketNodes.length > 0

  // Collect entries to insert
  const entries: { playerId: string; points: number; placementLabel: string }[] = []

  if (hasBracket) {
    // --- KNOCKOUT / HYBRID ---
    // Determine bracket participants by round
    const nodes = competition.bracketNodes

    // Champion: round=1 winner
    const finalNode = nodes.find((n) => n.round === 1 && n.winnerId)
    const champion = finalNode?.winnerId ?? null

    // Runner-up: the non-winner seed in the final
    const runnerUp = finalNode
      ? (finalNode.seedAId === champion ? finalNode.seedBId : finalNode.seedAId)
      : null

    // SF losers: non-winners in round=2 nodes
    const sfLosers = nodes
      .filter((n) => n.round === 2 && n.winnerId)
      .flatMap((n) => {
        const loser = n.seedAId === n.winnerId ? n.seedBId : n.seedAId
        return loser ? [loser] : []
      })

    // QF losers: non-winners in round=4 nodes
    const qfLosers = nodes
      .filter((n) => n.round === 4 && n.winnerId)
      .flatMap((n) => {
        const loser = n.seedAId === n.winnerId ? n.seedBId : n.seedAId
        return loser ? [loser] : []
      })

    // All bracket participants
    const bracketParticipants = new Set<string>(
      nodes.flatMap((n) => [n.seedAId, n.seedBId].filter(Boolean) as string[]),
    )

    if (champion) entries.push({ playerId: champion, points: calcPoints(championPts, 1.0), placementLabel: "Champion" })
    if (runnerUp) entries.push({ playerId: runnerUp, points: calcPoints(championPts, 0.6), placementLabel: "Runner-up" })
    sfLosers.forEach((id) => entries.push({ playerId: id, points: calcPoints(championPts, 0.38), placementLabel: "Semi-final" }))
    qfLosers.forEach((id) => entries.push({ playerId: id, points: calcPoints(championPts, 0.22), placementLabel: "Quarter-final" }))

    // Everyone else in the bracket (first-round exits)
    const accounted = new Set([champion, runnerUp, ...sfLosers, ...qfLosers].filter(Boolean) as string[])
    bracketParticipants.forEach((id) => {
      if (!accounted.has(id)) entries.push({ playerId: id, points: calcPoints(championPts, 0.08), placementLabel: "First Round" })
    })

    // Non-bracket participants (hybrid only) — use league standings
    const nonBracket = allPlayerIds.filter((id) => !bracketParticipants.has(id))
    if (nonBracket.length > 0 && competition.divisions[0]) {
      const standings = await getLeagueStandings(competitionId, competition.divisions[0].id)
      // Filter to non-bracket players and re-rank them
      const nonBracketStandings = standings.filter((id) => nonBracket.includes(id))
      leaguePlacements(nonBracketStandings).forEach(({ playerId, label, pct }) => {
        entries.push({ playerId, points: calcPoints(championPts, pct), placementLabel: `League: ${label}` })
      })
      // Non-bracket players not in any completed fixture get 8% participation
      nonBracket
        .filter((id) => !nonBracketStandings.includes(id))
        .forEach((id) => entries.push({ playerId: id, points: calcPoints(championPts, 0.08), placementLabel: "Participant" }))
    }
  } else {
    // --- LEAGUE ONLY ---
    const div = competition.divisions[0]
    if (!div) return
    const standings = await getLeagueStandings(competitionId, div.id)

    // Players in standings get league placements; remaining get 6%
    const standingSet = new Set(standings)
    leaguePlacements(standings).forEach(({ playerId, label, pct }) => {
      entries.push({ playerId, points: calcPoints(championPts, pct), placementLabel: label })
    })
    allPlayerIds
      .filter((id) => !standingSet.has(id))
      .forEach((id) => entries.push({ playerId: id, points: calcPoints(championPts, 0.06), placementLabel: "Participant" }))
  }

  if (entries.length === 0) return

  // Upsert guard: delete any existing points for this competition first (idempotent)
  await prisma.rankingPoint.deleteMany({ where: { competitionId } })
  await prisma.rankingPoint.createMany({
    data: entries.map((e) => ({
      playerId: e.playerId,
      competitionId,
      points: e.points,
      placementLabel: e.placementLabel,
      entrantCount,
    })),
  })
}
