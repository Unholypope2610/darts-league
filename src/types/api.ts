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
  createdAt: string
  updatedAt: string
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
  first9Average: number
  bestLeg: number | null
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
}
