import type { PlayerMeta, VisitRecord } from "./api"
import type { FinishType } from "@/lib/utils/darts"

export interface LiveMatchState {
  matchId: string | null
  playerA: PlayerMeta | null
  playerB: PlayerMeta | null
  startingScore: number
  bestOf: number
  finishType: FinishType
  isSets: boolean
  playerALegsWon: number
  playerBLegsWon: number
  currentLegId: string | null
  currentTurnPlayerId: string | null
  playerARemainder: number
  playerBRemainder: number
  visits: VisitRecord[]
  dartInput: string
  dartsUsedThisVisit: number
  isBustDialogOpen: boolean
  isLegWinAnimating: boolean
  legWinnerId: string | null
  isMatchWon: boolean
  winnerId: string | null
  isSubmitting: boolean
  error: string | null
  undoStack: string[]
}
