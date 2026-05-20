export type FinishType = "DOUBLE_OUT" | "MASTER_OUT" | "STRAIGHT_OUT"

export function isValidScore(score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= 180
}

export function isBust(
  scoreThrown: number,
  currentRemainder: number,
  finishType: FinishType,
): boolean {
  const newRemainder = currentRemainder - scoreThrown
  if (newRemainder < 0) return true
  if (newRemainder === 1) return true
  if (newRemainder === 0) {
    if (finishType === "STRAIGHT_OUT") return false
    // DOUBLE_OUT and MASTER_OUT: can't verify without per-dart info here;
    // the API handles the full per-dart check. This is a quick pre-check.
    return false
  }
  return false
}

export function isCheckout(
  scoreThrown: number,
  currentRemainder: number,
): boolean {
  return currentRemainder - scoreThrown === 0
}

export function getNewRemainder(
  scoreThrown: number,
  currentRemainder: number,
  finishType: FinishType,
): number | null {
  const newRemainder = currentRemainder - scoreThrown
  if (newRemainder < 0) return null
  if (newRemainder === 1) return null
  return newRemainder
}

export function legsToWin(bestOf: number): number {
  // Math.floor(n/2)+1 equals Math.ceil(n/2) for odd n, but for even n
  // it requires one more leg to win — enabling a draw at n/2 each.
  return Math.floor(bestOf / 2) + 1
}

export function isMatchDraw(
  playerALegs: number,
  playerBLegs: number,
  bestOf: number,
): boolean {
  return bestOf % 2 === 0 && playerALegs + playerBLegs === bestOf && playerALegs === playerBLegs
}

export function isMatchOver(
  playerALegs: number,
  playerBLegs: number,
  bestOf: number,
): boolean {
  const needed = legsToWin(bestOf)
  return playerALegs >= needed || playerBLegs >= needed || isMatchDraw(playerALegs, playerBLegs, bestOf)
}

export function matchWinner(
  playerALegs: number,
  playerBLegs: number,
  bestOf: number,
  playerAId: string,
  playerBId: string,
): string | null {
  const needed = legsToWin(bestOf)
  if (playerALegs >= needed) return playerAId
  if (playerBLegs >= needed) return playerBId
  return null  // draw — null winner
}

// Highest score achievable in one visit
export const MAX_VISIT_SCORE = 180

// Scores that cannot be finished (no valid combination of darts)
const UNFINISHABLE = new Set([163, 166, 168, 169])

export function isFinishable(remainder: number, finishType: FinishType): boolean {
  if (remainder > 170) return false
  if (finishType === "DOUBLE_OUT" && UNFINISHABLE.has(remainder)) return false
  if (finishType === "DOUBLE_OUT" && remainder === 1) return false
  return remainder > 0
}
