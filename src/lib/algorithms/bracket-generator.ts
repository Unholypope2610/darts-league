export interface BracketNodeInput {
  competitionId: string
  round: number
  position: number
  seedAId: string | null
  seedBId: string | null
  winnerNextNodeId: string | null
}

export interface StandingEntry {
  playerId: string
  points: number
  legDifference: number
  legsFor: number
  average: number
}

/**
 * Generates bracket nodes for a single-elimination tournament.
 * Supports 2 (final only), 4 (2 semis + final), or 8 players (4 quarters + 2 semis + final).
 */
export function generateBracket(
  competitionId: string,
  standings: StandingEntry[],
  topN: 2 | 4 | 8 = 4,
): Omit<BracketNodeInput, "winnerNextNodeId">[] {
  const qualified = standings.slice(0, topN)

  if (topN === 2) {
    return [
      {
        competitionId,
        round: 1,
        position: 0,
        seedAId: qualified[0]?.playerId ?? null,
        seedBId: qualified[1]?.playerId ?? null,
      },
    ]
  }

  if (topN === 4) {
    // Semi 1: seed 1 vs seed 4  (position 0)
    // Semi 2: seed 2 vs seed 3  (position 1)
    // Final:  winner of semi1 vs winner of semi2 (position 0)
    return [
      {
        competitionId,
        round: 2,
        position: 0,
        seedAId: qualified[0]?.playerId ?? null,
        seedBId: qualified[3]?.playerId ?? null,
      },
      {
        competitionId,
        round: 2,
        position: 1,
        seedAId: qualified[1]?.playerId ?? null,
        seedBId: qualified[2]?.playerId ?? null,
      },
      {
        competitionId,
        round: 1,
        position: 0,
        seedAId: null,
        seedBId: null,
      },
    ]
  }

  // 8-player bracket
  // Quarters: 1v8, 4v5, 2v7, 3v6
  // Semis feed from quarters
  // Final feeds from semis
  return [
    { competitionId, round: 4, position: 0, seedAId: qualified[0]?.playerId ?? null, seedBId: qualified[7]?.playerId ?? null },
    { competitionId, round: 4, position: 1, seedAId: qualified[3]?.playerId ?? null, seedBId: qualified[4]?.playerId ?? null },
    { competitionId, round: 4, position: 2, seedAId: qualified[1]?.playerId ?? null, seedBId: qualified[6]?.playerId ?? null },
    { competitionId, round: 4, position: 3, seedAId: qualified[2]?.playerId ?? null, seedBId: qualified[5]?.playerId ?? null },
    { competitionId, round: 2, position: 0, seedAId: null, seedBId: null },
    { competitionId, round: 2, position: 1, seedAId: null, seedBId: null },
    { competitionId, round: 1, position: 0, seedAId: null, seedBId: null },
  ]
}

export function seedLabel(round: number): string {
  switch (round) {
    case 1: return "Final"
    case 2: return "Semi-Final"
    case 4: return "Quarter-Final"
    default: return `Round of ${round * 2}`
  }
}
