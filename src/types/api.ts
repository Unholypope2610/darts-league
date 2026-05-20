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
