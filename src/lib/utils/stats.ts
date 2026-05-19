export interface VisitForStats {
  scoreThrown: number
  dartsUsed: number
  isBust: boolean
  isCheckout: boolean
  visitNumber: number
  playerId: string
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

export function checkoutPercentage(visits: VisitForStats[]): number {
  const checkouts = visits.filter((v) => v.isCheckout)
  if (visits.length === 0) return 0
  return (checkouts.length / visits.length) * 100
}
