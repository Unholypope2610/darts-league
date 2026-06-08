import type { CricketDart, HalfItTarget } from "@/types/api"

// ── Level names ───────────────────────────────────────────────────────────────

export const BOT_LEVEL_NAMES: Record<number, string> = {
  1: "Novice",
  2: "Beginner",
  3: "Improver",
  4: "Amateur",
  5: "Club",
  6: "Intermediate",
  7: "Advanced",
  8: "Semi-Pro",
  9: "Professional",
  10: "Elite",
}

// ── Shared probability helpers ────────────────────────────────────────────────

function roll(): number {
  return Math.random()
}

// Double hit probability for each level (Bob's 27 / x01 checkout doubles)
const DOUBLE_HIT_PROB = [0.08, 0.14, 0.20, 0.28, 0.37, 0.47, 0.58, 0.68, 0.78, 0.87]

// Triple hit probability for checkout attempts (separate from Gaussian scoring model —
// calibrated to realistic checkout triple success rates per level)
const CHECKOUT_TRIPLE_PROB = [0.04, 0.07, 0.11, 0.17, 0.24, 0.32, 0.41, 0.51, 0.60, 0.68]

// ── Physics-based Gaussian dart model (Tibshirani, Price & Taylor 2011) ──────
// Each dart lands at a 2D Gaussian offset from the aim point.
// σ (mm) is the skill parameter — calibrated to academic reference points:
// σ=17→professional county (~89 avg), σ=25→moderate, σ=60→fairly inaccurate.

function randn(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Dartboard numbers clockwise from top (index 0 = segment 20 at 0°, each span = 18°)
const BOARD_NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

// σ (mm) per level
const X01_SIGMA = [100, 80, 62, 48, 37, 28, 22, 17, 12, 8]

// Aim coordinates (mm from board centre, x=east, y=north). r=103 = treble ring midpoint.
// Angles clockwise from north: 20=0°, 19=198°, 18=36°
const AIM_T20 = { x: 0, y: 103 }
const AIM_T19 = { x: 103 * Math.sin((198 * Math.PI) / 180), y: 103 * Math.cos((198 * Math.PI) / 180) }
const AIM_T18 = { x: 103 * Math.sin((36  * Math.PI) / 180), y: 103 * Math.cos((36  * Math.PI) / 180) }

// Treble centre aim for each Cricket target (BULL aimed at board centre)
const CRICKET_AIMS: Record<string, { x: number; y: number }> = {
  "20":   AIM_T20,
  "19":   AIM_T19,
  "18":   { x: 103 * Math.sin((36  * Math.PI) / 180), y: 103 * Math.cos((36  * Math.PI) / 180) },
  "17":   { x: 103 * Math.sin((162 * Math.PI) / 180), y: 103 * Math.cos((162 * Math.PI) / 180) },
  "16":   { x: 103 * Math.sin((234 * Math.PI) / 180), y: 103 * Math.cos((234 * Math.PI) / 180) },
  "15":   { x: 103 * Math.sin((126 * Math.PI) / 180), y: 103 * Math.cos((126 * Math.PI) / 180) },
  "BULL": { x: 0, y: 0 },
}

function landingToScore(x: number, y: number): { score: number; segment: number } {
  const r = Math.sqrt(x * x + y * y)
  if (r > 170)  return { score: 0,  segment: 0  }
  if (r <= 6.35) return { score: 50, segment: 25 }
  if (r <= 15.9) return { score: 25, segment: 25 }
  const angleDeg = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360
  const idx = Math.round(angleDeg / 18) % 20
  const n = BOARD_NUMBERS[idx]
  const score = r <= 99 ? n : r <= 107 ? n * 3 : r <= 162 ? n : n * 2
  return { score, segment: n }
}

function throwDart(aimX: number, aimY: number, sigma: number): { score: number; segment: number; x: number; y: number } {
  const x = aimX + sigma * randn()
  const y = aimY + sigma * randn()
  return { ...landingToScore(x, y), x, y }
}

// ── Cricket ───────────────────────────────────────────────────────────────────

const CRICKET_PRIORITY = ["20", "19", "18", "17", "16", "15", "BULL"] as const
type CricketTarget = "20" | "19" | "18" | "17" | "16" | "15" | "BULL"

function chooseCricketTarget(
  level: number,
  myMarks: Record<string, number>,
  opponentMarks: Record<string, number>,
): CricketTarget {
  if (level <= 3) {
    // Random among unclosed targets
    const unclosed = CRICKET_PRIORITY.filter((t) => (myMarks[t] ?? 0) < 3)
    if (unclosed.length === 0) return "20"
    return unclosed[Math.floor(Math.random() * unclosed.length)]
  }

  // Strategic: score on targets I've closed that opponent hasn't (highest value first)
  for (const t of CRICKET_PRIORITY) {
    if ((myMarks[t] ?? 0) >= 3 && (opponentMarks[t] ?? 0) < 3) return t
  }
  // Otherwise attack highest unclosed target
  for (const t of CRICKET_PRIORITY) {
    if ((myMarks[t] ?? 0) < 3) return t
  }
  return "20"
}

function simulateCricketDart(level: number, target: CricketTarget): CricketDart | null {
  const aim = CRICKET_AIMS[target]
  const dart = throwDart(aim.x, aim.y, X01_SIGMA[level - 1])
  if (target === "BULL") {
    if (dart.segment !== 25) return null
    return { target, multiplier: dart.score === 50 ? 2 : 1 }
  }
  const n = parseInt(target, 10)
  if (dart.segment !== n) return null
  return { target, multiplier: (dart.score / n) as 1 | 2 | 3 }
}

export function computeBotCricketTurn(
  level: number,
  myMarks: Record<string, number>,
  opponentMarks: Record<string, number>,
): CricketDart[] {
  const target = chooseCricketTarget(level, myMarks, opponentMarks)
  const darts: CricketDart[] = []
  for (let i = 0; i < 3; i++) {
    const d = simulateCricketDart(level, target)
    if (d) darts.push(d)
  }
  return darts
}

// ── Bob's 27 ──────────────────────────────────────────────────────────────────

export function computeBotBobs27Turn(level: number): number {
  const p = DOUBLE_HIT_PROB[level - 1]
  let hits = 0
  for (let i = 0; i < 3; i++) {
    if (roll() < p) hits++
  }
  return hits
}

// ── Half It ───────────────────────────────────────────────────────────────────

// Base scoring probability per level (0–1 scale)
const HALF_IT_BASE_PROB = [0.10, 0.18, 0.27, 0.37, 0.47, 0.57, 0.67, 0.76, 0.84, 0.91]

// Difficulty multipliers per target type
const HALF_IT_MODIFIERS: Record<string, number> = {
  NUMBER: 1.0,
  "3_DIFF_COLOURS": 0.85,
  "3_SAME_COLOUR": 0.80,
  WILDCARD: 0.80,
  DOUBLES: 0.65,
  TREBLES: 0.55,
  BULL: 0.45,
}

// Approximate max score per round per type (used to pick a random score in range)
const HALF_IT_MAX_SCORE: Record<string, (level: number) => number> = {
  NUMBER: (l) => [20, 40, 60, 80, 100, 120, 140, 160, 180, 200][l - 1],
  DOUBLES: (l) => [8, 16, 24, 32, 40, 50, 60, 70, 80, 90][l - 1],
  TREBLES: (l) => [9, 18, 27, 36, 45, 57, 69, 81, 93, 105][l - 1],
  BULL: (l) => [25, 25, 50, 50, 50, 75, 75, 100, 100, 125][l - 1],
  "3_DIFF_COLOURS": (l) => [20, 40, 60, 80, 100, 120, 140, 160, 180, 200][l - 1],
  "3_SAME_COLOUR": (l) => [20, 40, 60, 80, 100, 120, 140, 160, 180, 200][l - 1],
  WILDCARD: (l) => [30, 60, 90, 120, 150, 180, 210, 240, 270, 300][l - 1],
}

export function computeBotHalfItTurn(
  level: number,
  target: HalfItTarget,
): { pointsScored: number; wasHalved: boolean } {
  const base = HALF_IT_BASE_PROB[level - 1]
  const mod = HALF_IT_MODIFIERS[target.type] ?? 1.0
  const hitChance = Math.min(0.97, base * mod)

  if (roll() >= hitChance) {
    return { pointsScored: 0, wasHalved: true }
  }

  const maxScore = HALF_IT_MAX_SCORE[target.type]?.(level) ?? 60
  const minScore = Math.max(1, Math.floor(maxScore * 0.2))
  const pointsScored = minScore + Math.floor(Math.random() * (maxScore - minScore + 1))
  return { pointsScored, wasHalved: false }
}

// ── x01 ───────────────────────────────────────────────────────────────────────

// Remainders impossible to finish on (Double Out)
const IMPOSSIBLE_DOUBLES_OUT = new Set([159, 162, 163, 165, 166, 168, 169])

// Full checkout route table — maps remainder → ordered list of dart targets
// Each string: "T20" | "D20" | "S20" | "Bull" etc.
type DartCode = string // e.g. "T20", "D20", "S5", "Bull"

const BOT_CHECKOUT_ROUTES: Record<number, DartCode[]> = {
  170: ["T20", "T20", "Bull"],
  167: ["T20", "T19", "Bull"],
  164: ["T19", "T19", "Bull"],
  161: ["T20", "T17", "Bull"],
  160: ["T20", "T20", "D20"],
  158: ["T20", "T20", "D19"],
  157: ["T19", "T20", "D20"],
  156: ["T20", "T20", "D18"],
  155: ["T20", "T19", "D19"],
  154: ["T20", "T18", "D20"],
  153: ["T20", "T19", "D18"],
  152: ["T20", "T20", "D16"],
  151: ["T20", "T17", "D20"],
  150: ["T20", "T18", "D18"],
  149: ["T20", "T19", "D16"],
  148: ["T20", "T20", "D14"],
  147: ["T20", "T17", "D18"],
  146: ["T20", "T18", "D16"],
  145: ["T20", "T15", "D20"],
  144: ["T20", "T20", "D12"],
  143: ["T20", "T17", "D16"],
  142: ["T20", "T14", "D20"],
  141: ["T20", "T15", "D18"],
  140: ["T20", "T16", "D16"],
  139: ["T20", "T13", "D20"],
  138: ["T20", "T16", "D15"],
  137: ["T18", "T17", "D16"],
  136: ["T20", "T20", "D8"],
  135: ["T20", "T13", "D18"],
  134: ["T20", "T14", "D16"],
  133: ["T20", "T19", "D8"],
  132: ["T20", "T16", "D12"],
  131: ["T20", "T13", "D16"],
  130: ["T20", "T18", "D8"],
  129: ["T19", "T16", "D12"],
  128: ["T20", "T20", "D4"],
  127: ["T20", "T17", "D8"],
  126: ["T19", "S19", "Bull"],
  125: ["T20", "T19", "D4"],
  124: ["T20", "T16", "D8"],
  123: ["T20", "T13", "D12"],
  122: ["T18", "S18", "Bull"],
  121: ["T19", "S14", "Bull"],
  120: ["T20", "S20", "D20"],
  119: ["T20", "S19", "D20"],
  118: ["T20", "S18", "D20"],
  117: ["T20", "S17", "D20"],
  116: ["T20", "S16", "D20"],
  115: ["T20", "S15", "D20"],
  114: ["T20", "S14", "D20"],
  113: ["T20", "S13", "D20"],
  112: ["T20", "S12", "D20"],
  111: ["T20", "S19", "D16"],
  110: ["T20", "S10", "D20"],
  109: ["T19", "S12", "D20"],
  108: ["T20", "S16", "D16"],
  107: ["T19", "S10", "D20"],
  106: ["T20", "S10", "D18"],
  105: ["T20", "S13", "D16"],
  104: ["T20", "S12", "D16"],
  103: ["T19", "S10", "D18"],
  102: ["T20", "S10", "D16"],
  101: ["T17", "S10", "D20"],
  100: ["T20", "D20"],
  99: ["T19", "S10", "D16"],
  98: ["T20", "D19"],
  97: ["T19", "D20"],
  96: ["T20", "D18"],
  95: ["T19", "D19"],
  94: ["T18", "D20"],
  93: ["T19", "D18"],
  92: ["T20", "D16"],
  91: ["T17", "D20"],
  90: ["T20", "D15"],
  89: ["T19", "D16"],
  88: ["T20", "D14"],
  87: ["T17", "D18"],
  86: ["T18", "D16"],
  85: ["T15", "D20"],
  84: ["T20", "D12"],
  83: ["T17", "D16"],
  82: ["Bull", "D16"],
  81: ["T19", "D12"],
  80: ["T20", "D10"],
  79: ["T19", "D11"],
  78: ["T18", "D12"],
  77: ["T19", "D10"],
  76: ["T20", "D8"],
  75: ["T17", "D12"],
  74: ["T14", "D16"],
  73: ["T19", "D8"],
  72: ["T16", "D12"],
  71: ["T13", "D16"],
  70: ["T18", "D8"],
  69: ["T19", "D6"],
  68: ["T20", "D4"],
  67: ["T17", "D8"],
  66: ["T14", "D12"],
  65: ["T19", "D4"],
  64: ["T16", "D8"],
  63: ["T13", "D12"],
  62: ["T10", "D16"],
  61: ["T15", "D8"],
  60: ["S20", "D20"],
  59: ["S19", "D20"],
  58: ["S18", "D20"],
  57: ["S17", "D20"],
  56: ["S16", "D20"],
  55: ["S15", "D20"],
  54: ["S14", "D20"],
  53: ["S13", "D20"],
  52: ["S20", "D16"],
  51: ["S19", "D16"],
  50: ["S18", "D16"],
  49: ["S17", "D16"],
  48: ["S16", "D16"],
  47: ["S7", "D20"],
  46: ["S6", "D20"],
  45: ["S13", "D16"],
  44: ["S4", "D20"],
  43: ["S3", "D20"],
  42: ["S10", "D16"],
  41: ["S9", "D16"],
  40: ["D20"],
  39: ["S7", "D16"],
  38: ["D19"],
  37: ["S5", "D16"],
  36: ["D18"],
  35: ["S3", "D16"],
  34: ["D17"],
  33: ["S1", "D16"],
  32: ["D16"],
  31: ["S15", "D8"],
  30: ["D15"],
  29: ["S13", "D8"],
  28: ["D14"],
  27: ["S11", "D8"],
  26: ["D13"],
  25: ["S9", "D8"],
  24: ["D12"],
  23: ["S7", "D8"],
  22: ["D11"],
  21: ["S5", "D8"],
  20: ["D10"],
  19: ["S3", "D8"],
  18: ["D9"],
  17: ["S9", "D4"],
  16: ["D8"],
  15: ["S7", "D4"],
  14: ["D7"],
  13: ["S5", "D4"],
  12: ["D6"],
  11: ["S3", "D4"],
  10: ["D5"],
  9: ["S1", "D4"],
  8: ["D4"],
  7: ["S3", "D2"],
  6: ["D3"],
  5: ["S1", "D2"],
  4: ["D2"],
  3: ["S1", "D1"],
  2: ["D1"],
}

interface DartTarget {
  type: "TRIPLE" | "DOUBLE" | "SINGLE" | "BULL"
  value: number // for TRIPLE/DOUBLE/SINGLE: the bed number; for BULL: 25
}

function parseDartCode(code: DartCode): DartTarget {
  if (code === "Bull") return { type: "BULL", value: 25 }
  if (code.startsWith("T")) return { type: "TRIPLE", value: parseInt(code.slice(1), 10) }
  if (code.startsWith("D")) return { type: "DOUBLE", value: parseInt(code.slice(1), 10) }
  if (code.startsWith("S")) return { type: "SINGLE", value: parseInt(code.slice(1), 10) }
  return { type: "SINGLE", value: parseInt(code, 10) }
}

function dartScore(target: DartTarget): number {
  if (target.type === "BULL") return 50
  if (target.type === "TRIPLE") return target.value * 3
  if (target.type === "DOUBLE") return target.value * 2
  return target.value
}

// Returns the board coordinates to aim at for a given checkout target.
// TRIPLE → treble ring midpoint (r=103), DOUBLE → double ring midpoint (r=166),
// SINGLE → outer single midpoint (r=134), BULL → board centre.
function aimForTarget(target: DartTarget): { x: number; y: number } {
  if (target.type === "BULL") return { x: 0, y: 0 }
  const idx = BOARD_NUMBERS.indexOf(target.value)
  const rad = idx * 18 * Math.PI / 180
  const r = target.type === "TRIPLE" ? 103 : target.type === "DOUBLE" ? 166 : 134
  return { x: r * Math.sin(rad), y: r * Math.cos(rad) }
}

// Hybrid checkout dart model.
// Uses calibrated hit probabilities (so checkout frequency stays realistic),
// but when a dart misses its intended target, the Gaussian model determines
// where it actually landed — giving realistic partial scores (e.g. missed D20
// might hit S20, clip D18, or fly off the board).
function simulateDartAtTarget(level: number, target: DartTarget): { score: number; isDouble: boolean } {
  let hitIntended: boolean
  switch (target.type) {
    case "DOUBLE": hitIntended = roll() < DOUBLE_HIT_PROB[level - 1]; break
    case "TRIPLE": hitIntended = roll() < CHECKOUT_TRIPLE_PROB[level - 1]; break
    case "BULL":   hitIntended = roll() < DOUBLE_HIT_PROB[level - 1] * 0.75; break
    case "SINGLE": hitIntended = roll() < 0.95; break
  }

  if (hitIntended) {
    const score = dartScore(target)
    const isDouble = target.type === "DOUBLE" || target.type === "BULL"
    return { score, isDouble }
  }

  // Missed — use Gaussian to find actual landing
  const landing = throwDart(aimForTarget(target).x, aimForTarget(target).y, X01_SIGMA[level - 1])
  const isDouble = landing.score > 0 && (landing.score === landing.segment * 2 || landing.score === 50)
  return { score: landing.score, isDouble }
}

// Board management aims, in order of fallback: T20 → T19 → T18
function nextBoardAim(current: { x: number; y: number }): { x: number; y: number } {
  if (current === AIM_T20) return AIM_T19
  if (current === AIM_T19) return AIM_T18
  return AIM_T18 // already on T18, stay
}

function simulateScoringVisit(level: number, startRemainder: number): number {
  const sigma = X01_SIGMA[level - 1]
  let aim = AIM_T20
  let total = 0
  let runningRem = startRemainder

  for (let i = 0; i < 3; i++) {
    // Smart opening: if T20 would leave an impossible double-out remainder, use T19 instead.
    // Only matters when still aiming T20 and level is high enough to think ahead.
    if (level >= 5 && aim === AIM_T20 && runningRem - 60 > 0 && IMPOSSIBLE_DOUBLES_OUT.has(runningRem - 60)) {
      aim = AIM_T19
    }

    const dart = throwDart(aim.x, aim.y, sigma)
    total += dart.score
    runningRem -= dart.score

    if (i < 2) {
      if (level >= 4 && (dart.segment === 1 || dart.segment === 5)) {
        // Adjacent miss — hit the 1 or 5 bed. Variable probability switch (avg ~28%).
        if (roll() < roll() * 0.55) aim = nextBoardAim(aim)
      } else if (level >= 5) {
        // Physical blocker: dart landed within 22mm of the current aim centre.
        const dx = dart.x - aim.x
        const dy = dart.y - aim.y
        const distToAim = Math.sqrt(dx * dx + dy * dy)
        if (distToAim < 22) {
          // Strategy check: would switching leave a reachable checkout remainder?
          const nextAim = nextBoardAim(aim)
          const nextAimScore = nextAim === AIM_T19 ? 57 : nextAim === AIM_T18 ? 54 : 0
          const remIfNext = runningRem - nextAimScore
          const strategicSwitch = nextAimScore > 0
            && remIfNext > 0
            && remIfNext <= 110
            && !IMPOSSIBLE_DOUBLES_OUT.has(remIfNext)

          if (level >= 7) {
            if (strategicSwitch && roll() < 0.85) aim = nextBoardAim(aim)
          } else {
            // L5–6: strategic switch + small pure-obstruction chance
            if (strategicSwitch && roll() < 0.50) aim = nextBoardAim(aim)
            else if (roll() < 0.12) aim = nextBoardAim(aim)
          }
        }
      }
    }
  }
  return total
}

export interface BotX01VisitResult {
  scoreThrown: number
  dartsUsed: number
  doublesAttempted: number
  isBust: boolean
  isCheckout: boolean
}

export function computeBotX01Visit(
  level: number,
  remainder: number,
  finishType: "DOUBLE_OUT" | "STRAIGHT_OUT",
): BotX01VisitResult {
  // Smart T19 targeting for levels 6-10 when remainder mod 100 === 1
  // (e.g. 101, 201 → T20 leaves 41, T19 leaves 42 which is a cleaner checkout)
  // Handled implicitly by the checkout route table for exact remainders.

  const route = BOT_CHECKOUT_ROUTES[remainder]
  const isCheckoutRange = remainder >= 2 && remainder <= 170
  const isImpossible = finishType === "DOUBLE_OUT" && IMPOSSIBLE_DOUBLES_OUT.has(remainder)

  // Decide whether to attempt checkout or score
  if (!isCheckoutRange || isImpossible || !route) {
    // Pure scoring visit
    const score = simulateScoringVisit(level, remainder)
    const newRemainder = remainder - score
    if (newRemainder < 0 || newRemainder === 1) {
      return { scoreThrown: 0, dartsUsed: 3, doublesAttempted: 0, isBust: true, isCheckout: false }
    }
    if (newRemainder === 0) {
      if (finishType === "DOUBLE_OUT") {
        // Scoring visits don't end on doubles — treat as bust
        return { scoreThrown: 0, dartsUsed: 3, doublesAttempted: 0, isBust: true, isCheckout: false }
      }
      return { scoreThrown: score, dartsUsed: 3, doublesAttempted: 0, isBust: false, isCheckout: true }
    }
    return { scoreThrown: score, dartsUsed: 3, doublesAttempted: 0, isBust: false, isCheckout: false }
  }

  // Checkout attempt — dart by dart
  const targets = route.map(parseDartCode)
  let runningRemainder = remainder
  let scoreThrown = 0
  let dartsUsed = 0
  let doublesAttempted = 0

  for (let i = 0; i < targets.length && dartsUsed < 3; i++) {
    const target = targets[i]
    dartsUsed++
    if (target.type === "DOUBLE") doublesAttempted++

    const landing = simulateDartAtTarget(level, target)
    const newRem = runningRemainder - landing.score

    if (newRem < 0) {
      return { scoreThrown: 0, dartsUsed, doublesAttempted, isBust: true, isCheckout: false }
    }
    if (newRem === 0) {
      if (finishType === "DOUBLE_OUT" && !landing.isDouble) {
        return { scoreThrown: 0, dartsUsed, doublesAttempted, isBust: true, isCheckout: false }
      }
      return { scoreThrown: scoreThrown + landing.score, dartsUsed, doublesAttempted, isBust: false, isCheckout: true }
    }
    if (newRem === 1 && finishType === "DOUBLE_OUT") {
      return { scoreThrown: 0, dartsUsed, doublesAttempted, isBust: true, isCheckout: false }
    }

    scoreThrown += landing.score
    runningRemainder = newRem
  }

  // Route exhausted (or missed all darts) — remaining darts fill with scoring attempts
  while (dartsUsed < 3) {
    dartsUsed++
    const dart = throwDart(AIM_T20.x, AIM_T20.y, X01_SIGMA[level - 1])
    const newRem = runningRemainder - dart.score
    if (newRem < 0 || newRem === 1) {
      return { scoreThrown: 0, dartsUsed, doublesAttempted, isBust: true, isCheckout: false }
    }
    if (newRem === 0) {
      if (finishType === "STRAIGHT_OUT") {
        return { scoreThrown: scoreThrown + dart.score, dartsUsed, doublesAttempted, isBust: false, isCheckout: true }
      }
      return { scoreThrown: 0, dartsUsed, doublesAttempted, isBust: true, isCheckout: false }
    }
    scoreThrown += dart.score
    runningRemainder = newRem
  }

  return { scoreThrown, dartsUsed, doublesAttempted, isBust: false, isCheckout: false }
}
