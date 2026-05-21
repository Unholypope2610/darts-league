export interface VisitForStats {
  scoreThrown: number
  dartsUsed: number
  doublesAttempted: number
  isBust: boolean
  isCheckout: boolean
  visitNumber: number
  playerId: string
  runningRemainder: number
}

export function calculateAverage(visits: VisitForStats[]): number {
  const valid = visits.filter((v) => !v.isBust)
  const totalScore = valid.reduce((sum, v) => sum + v.scoreThrown, 0)
  const totalDarts = valid.reduce((sum, v) => sum + v.dartsUsed, 0)
  if (totalDarts === 0) return 0
  return (totalScore / totalDarts) * 3
}

export function calculateFirst9Average(visits: VisitForStats[]): number {
  const valid = visits.filter((v) => !v.isBust).slice(0, 3)
  return calculateAverage(valid)
}

export function countScoreOrAbove(visits: VisitForStats[], threshold: number): number {
  return visits.filter((v) => !v.isBust && v.scoreThrown >= threshold).length
}

export function count180s(visits: VisitForStats[]): number {
  return countScoreOrAbove(visits, 180)
}

export function count140Plus(visits: VisitForStats[]): number {
  return countScoreOrAbove(visits, 140)
}

export function count100Plus(visits: VisitForStats[]): number {
  return countScoreOrAbove(visits, 100)
}

export function countCheckouts(visits: VisitForStats[]): number {
  return visits.filter((v) => v.isCheckout).length
}

export function highestCheckout(visits: VisitForStats[]): number {
  const checkouts = visits.filter((v) => v.isCheckout)
  if (checkouts.length === 0) return 0
  return Math.max(...checkouts.map((v) => v.scoreThrown))
}

export interface LegForStats {
  dartsThrown: number
  winnerId: string | null
  visits: VisitForStats[]
}

export function bestLeg(legs: LegForStats[], playerId: string): number | null {
  const won = legs.filter((l) => l.winnerId === playerId)
  if (won.length === 0) return null
  return Math.min(...won.map((l) => l.dartsThrown))
}

// Doubles % = successful checkouts / total darts thrown at finishing doubles (all visits)
export function doublesPercentage(visits: VisitForStats[]): number {
  const checkoutCount = visits.filter((v) => v.isCheckout).length
  if (checkoutCount === 0) return 0
  const totalDartsAtDouble = visits.reduce((sum, v) => sum + v.doublesAttempted, 0)
  if (totalDartsAtDouble === 0) return 0
  return Math.round((checkoutCount / totalDartsAtDouble) * 1000) / 10
}

export function top3Checkouts(visits: VisitForStats[]): number[] {
  return visits
    .filter((v) => v.isCheckout)
    .map((v) => v.scoreThrown)
    .sort((a, b) => b - a)
    .slice(0, 3)
}
