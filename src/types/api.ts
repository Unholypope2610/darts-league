export interface ApiError {
  error: string
}

export interface Competition {
  id: string
  name: string
  type: string
  season: string
  status: string
  startingScore: number
  bestOf: number
  finishType: string
  isSets: boolean
  legSize: number | null
  bracketBestOf: number | null
  bracketStartingScore: number | null
  bracketFinishType: string | null
  winnerId: string | null
  isRanked: boolean
  entrantCount: number | null
  hasLiveMatch: boolean
  liveMatches: { matchId: string | null; playerAName: string; playerBName: string; playerAScore: number; playerBScore: number }[]
  createdAt: string
  updatedAt: string
  divisions?: {
    id: string
    tier: number
    players: { playerId: string; player: { id: string; name: string } }[]
  }[]
}

export interface RankingEntry {
  playerId: string
  name: string
  avatarUrl: string | null
  points: number
  eventsEntered: number
  rankedTitles: number
  breakdown: { competitionId: string; competitionName: string; season: string; points: number; placementLabel: string; entrantCount: number; awardedAt: string; expiresAt: string }[]
}

export interface ChampionEntry {
  competitionName: string
  current: { competitionId: string; season: string; isRanked: boolean; entrantCount: number | null; winner: { id: string; name: string; avatarUrl: string | null } } | null
  past: { competitionId: string; season: string; isRanked: boolean; winner: { id: string; name: string; avatarUrl: string | null } }[]
}

export interface Player {
  id: string
  name: string
  nickname: string | null
  avatarUrl: string | null
  hand: string
  createdAt: string
  updatedAt: string
  won: number
  lost: number
  drawn: number
  average: number
  doublesPercentage: number
  count180s: number
  topCheckouts: number[]
  recentForm: ("W" | "D" | "L")[]
  titles: number
  rankedTitles: number
  first9Average: number
  bestLeg: number | null
  replayScoreThreshold: number
  replayCheckoutThreshold: number
  replayBobs27HitsThreshold: number
  replayMarksThreshold: number
}

export interface CareerStats {
  played: number
  won: number
  lost: number
  drawn: number
  average: number
  highest180s: number
  highestCheckout: number
  doublesPercentage: number
  top3Checkouts: { score: number; matchIds: string[] }[]
  recentForm: ("W" | "D" | "L")[]
  first9Average: number
  bestLeg: { darts: number; matchIds: string[] } | null
  averageHistory: { date: string; average: number }[]
  doublesHistory: { date: string; doublesPercentage: number }[]
}

export interface H2HRecord {
  opponent: PlayerMeta
  played: number
  won: number
  drawn: number
  lost: number
}

export interface PlayerDetail extends Player {
  careerStats: CareerStats
  h2h: H2HRecord[]
  competitionsWon: { id: string; name: string; season: string; type: string }[]
}

export interface LeagueTableRow {
  playerId: string
  name: string
  avatarUrl: string | null
  played: number
  won: number
  drawn: number
  lost: number
  legsFor: number
  legsAgainst: number
  legDifference: number
  average: number
  doublesPercentage: number
  points: number
  form: ("W" | "D" | "L")[]
}

export interface PlayerMeta {
  id: string
  name: string
  nickname: string | null
  avatarUrl: string | null
  hand: string
  replayScoreThreshold?: number
  replayCheckoutThreshold?: number
  replayBobs27HitsThreshold?: number
  replayMarksThreshold?: number
}

export interface MatchWithLegs {
  id: string
  createdByUserId?: string | null
  isLocal: boolean
  startingScore: number
  bestOf: number
  finishType: string
  isSets: boolean
  legSize: number | null
  playerAId: string
  playerBId: string
  playerA: PlayerMeta
  playerB: PlayerMeta
  playerAScore: number
  playerBScore: number
  winnerId: string | null
  pollVotesA: number | null
  pollVotesB: number | null
  startedAt: string
  completedAt: string | null
  legs: LegWithVisits[]
}

export interface LegWithVisits {
  id: string
  legNumber: number
  starterId: string
  winnerId: string | null
  dartsThrown: number
  visits: VisitRecord[]
}

export interface VisitRecord {
  id: string
  playerId: string
  visitNumber: number
  scoreThrown: number
  dartsUsed: number
  doublesAttempted: number
  runningRemainder: number
  isBust: boolean
  isCheckout: boolean
}

export interface RecordVisitResponse {
  visit: VisitRecord
  isBust: boolean
  isCheckout: boolean
  legWinnerId: string | null
  matchWinnerId: string | null
  isMatchDraw: boolean
  newRemainder: number
  setWinnerId?: string | null
  currentSetLegsA?: number
  currentSetLegsB?: number
}

// ── Practice Arena ────────────────────────────────────────────────────────────

export type GameMode = "BOBS_27" | "CRICKET" | "HALF_IT" | "X01"
export type PracticeVariant = "STANDARD" | "HARD" | "RANDOM" | "DOUBLE_OUT" | "STRAIGHT_OUT"
export type PracticeStatus = "IN_PROGRESS" | "COMPLETED"

export interface PracticePlayerMeta {
  id: string           // PracticePlayer.id
  playerId: string
  name: string
  avatarUrl: string | null
  turnOrder: number
  finalScore: number | null
  isEliminated: boolean
  isBot: boolean
  botLevel: number | null
  replayBobs27HitsThreshold?: number
  replayMarksThreshold?: number
}

// Round data shapes per game mode
export interface Bobs27RoundData {
  target: string       // "D1"–"D20" | "D25"
  dartsHit: number     // 0–3
  pointsChange: number // positive or negative
  runningScore: number
}

export interface CricketDart {
  target: string       // "20"|"19"|"18"|"17"|"16"|"15"|"BULL"
  multiplier: number   // 1|2|3
}

export interface CricketRoundData {
  darts: CricketDart[]
  marksEarned: Record<string, number>
  pointsEarned: Record<string, number>
  totalPointsEarned: number
}

export interface HalfItRoundData {
  target: string             // "20"|"16"|"DOUBLES"|"17"|"18"|"TREBLES"|"19"|"20"|"BULL"|"3_DIFF_COLOURS"|"3_SAME_COLOUR"|"WILDCARD"
  pointsScored: number
  wasHalved: boolean
  runningScore: number
  colourConditionMet?: boolean        // colour rounds
  wildcardTargets?: [number, number]  // wildcard round: [target1 (21-60), target2 (61-120)]  third is always 121+
  dartDetails?: { segment: "single"|"double"|"treble"|"bull"|"outer"; number: number }[] // colour rounds
}

export interface X01RoundData {
  legNumber: number
  scoreThrown: number
  dartsUsed: number
  doublesAttempted: number
  previousRemainder: number
  newRemainder: number
  isBust: boolean
  isCheckout: boolean
}

export type PracticeRoundData = Bobs27RoundData | CricketRoundData | HalfItRoundData | X01RoundData

export interface HalfItTarget {
  type: "NUMBER" | "DOUBLES" | "TREBLES" | "BULL" | "3_DIFF_COLOURS" | "3_SAME_COLOUR" | "WILDCARD"
  value?: number               // for NUMBER type
  wildcardTargets?: [number, number] // wildcard: [21-60 target, 61-120 target]; 121+ is implicit
}

export interface PracticeSessionWithRounds {
  id: string
  gameMode: GameMode
  variant: PracticeVariant
  isLocal: boolean
  status: PracticeStatus
  winnerId: string | null
  targetSequence: HalfItTarget[] | null
  isBotGame: boolean
  startingScore: number | null
  finishType: string
  legsTarget: number | null
  startedAt: string
  completedAt: string | null
  players: PracticePlayerMeta[]
  rounds: {
    id: string
    playerId: string
    roundNumber: number
    legNumber: number
    data: PracticeRoundData
    createdAt: string
  }[]
}
