import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { FinishType } from "@/lib/utils/darts"
import { getNewRemainder, isMatchOver, matchWinner } from "@/lib/utils/darts"
import type { MatchWithLegs, PlayerMeta, VisitRecord, RecordVisitResponse } from "@/types/api"
import { announceVisit, announceMatchWin } from "@/lib/utils/speech"
import { toast } from "sonner"

interface LiveMatchStore {
  // Match metadata
  matchId: string | null
  playerA: PlayerMeta | null
  playerB: PlayerMeta | null
  startingScore: number
  bestOf: number
  finishType: FinishType
  isSets: boolean
  playerALegsWon: number
  playerBLegsWon: number

  // Current leg
  currentLegId: string | null
  currentTurnPlayerId: string | null
  playerARemainder: number
  playerBRemainder: number
  visits: VisitRecord[]       // current leg only
  allVisits: VisitRecord[]    // all legs — used for match average

  // Keypad
  dartInput: string
  dartsUsedThisVisit: number

  // UI state
  isBustDialogOpen: boolean
  isLegWinAnimating: boolean
  legWinnerId: string | null
  pendingNextStarter: string | null   // loser ID queued to throw first next leg
  isMatchWon: boolean
  winnerId: string | null
  isSubmitting: boolean
  error: string | null
  undoStack: string[]

  // Actions
  hydrate: (match: MatchWithLegs) => void
  inputDigit: (digit: string) => void
  inputShortcut: (score: number, dartsUsed?: number) => void
  clearInput: () => void
  backspace: () => void
  setDartsUsed: (n: number) => void
  submitVisit: () => Promise<void>
  undoLastVisit: () => Promise<void>
  confirmBust: () => void
  dismissLegWin: () => void
  startNewLeg: (starterId: string) => Promise<void>
  reset: () => void
}

const initialState = {
  matchId: null,
  playerA: null,
  playerB: null,
  startingScore: 501,
  bestOf: 7,
  finishType: "DOUBLE_OUT" as FinishType,
  isSets: false,
  playerALegsWon: 0,
  playerBLegsWon: 0,
  currentLegId: null,
  currentTurnPlayerId: null,
  playerARemainder: 501,
  playerBRemainder: 501,
  visits: [],
  allVisits: [],
  dartInput: "",
  dartsUsedThisVisit: 3,
  isBustDialogOpen: false,
  isLegWinAnimating: false,
  legWinnerId: null,
  pendingNextStarter: null,
  isMatchWon: false,
  winnerId: null,
  isSubmitting: false,
  error: null,
  undoStack: [],
}

export const useLiveMatchStore = create<LiveMatchStore>()(
  immer((set, get) => ({
    ...initialState,

    hydrate: (match: MatchWithLegs) => {
      if (!match?.id || !match?.legs) return
      set((state) => {
        state.matchId = match.id
        state.playerA = match.playerA
        state.playerB = match.playerB
        state.startingScore = match.startingScore
        state.bestOf = match.bestOf
        state.finishType = match.finishType as FinishType
        state.isSets = match.isSets
        state.playerALegsWon = match.playerAScore
        state.playerBLegsWon = match.playerBScore
        state.winnerId = match.winnerId
        state.isMatchWon = match.winnerId !== null

        // All visits across every leg for match average
        state.allVisits = match.legs.flatMap((l) => l.visits)

        // Find the active leg (last leg without a winner)
        const activeLeg = match.legs.find((l) => !l.winnerId)
        if (activeLeg) {
          state.currentLegId = activeLeg.id

          // Calculate remainders from visits
          let aRemainder = match.startingScore
          let bRemainder = match.startingScore
          for (const v of activeLeg.visits) {
            if (!v.isBust) {
              if (v.playerId === match.playerAId) aRemainder = v.runningRemainder
              else bRemainder = v.runningRemainder
            }
          }
          state.playerARemainder = aRemainder
          state.playerBRemainder = bRemainder
          state.visits = activeLeg.visits

          // Determine whose turn it is based on visit count
          const lastVisit = activeLeg.visits[activeLeg.visits.length - 1]
          if (!lastVisit) {
            state.currentTurnPlayerId = activeLeg.starterId
          } else {
            state.currentTurnPlayerId =
              lastVisit.playerId === match.playerAId ? match.playerBId : match.playerAId
          }
        } else {
          state.playerARemainder = match.startingScore
          state.playerBRemainder = match.startingScore
        }
      })
    },

    inputDigit: (digit: string) => {
      set((state) => {
        if (state.dartInput.length >= 3) return
        const next = state.dartInput + digit
        const value = parseInt(next, 10)
        if (value > 180) return
        state.dartInput = next
      })
    },

    inputShortcut: (score: number, dartsUsed = 3) => {
      set((state) => {
        state.dartInput = score.toString()
        state.dartsUsedThisVisit = dartsUsed
      })
    },

    clearInput: () => {
      set((state) => {
        state.dartInput = ""
        state.dartsUsedThisVisit = 3
      })
    },

    backspace: () => {
      set((state) => {
        state.dartInput = state.dartInput.slice(0, -1)
      })
    },

    setDartsUsed: (n: number) => {
      set((state) => {
        state.dartsUsedThisVisit = n
      })
    },

    submitVisit: async () => {
      const state = get()
      if (!state.matchId || !state.currentLegId || !state.currentTurnPlayerId) return
      if (state.dartInput === "" || state.isSubmitting) return

      const score = parseInt(state.dartInput, 10)
      if (isNaN(score)) return

      set((s) => {
        s.isSubmitting = true
        s.error = null
      })

      try {
        const res = await fetch(`/api/matches/${state.matchId}/visits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legId: state.currentLegId,
            playerId: state.currentTurnPlayerId,
            scoreThrown: score,
            dartsUsed: state.dartsUsedThisVisit,
          }),
        })

        if (!res.ok) {
          const err = await res.json()
          const msg = err.error ?? "Failed to record visit"
          set((s) => { s.error = msg; s.isSubmitting = false })
          toast.error(msg)
          return
        }

        const data: RecordVisitResponse = await res.json()

        // Announce the visit — "requires X" is the OTHER player's remainder (they throw next)
        const isCurrentPlayerA = state.currentTurnPlayerId === state.playerA?.id
        const otherRemainder = isCurrentPlayerA ? state.playerBRemainder : state.playerARemainder
        const otherPlayerName = isCurrentPlayerA
          ? (state.playerB?.name ?? "")
          : (state.playerA?.name ?? "")
        announceVisit(score, otherRemainder, otherPlayerName, data.isCheckout, data.isBust)

        set((s) => {
          s.dartInput = ""
          s.dartsUsedThisVisit = 3
          s.isSubmitting = false
          s.visits.push(data.visit)
          s.allVisits.push(data.visit)
          s.undoStack.push(data.visit.id)

          if (data.isBust) {
            s.isBustDialogOpen = true
            return
          }

          // Update remainder
          const isPlayerA = state.currentTurnPlayerId === state.playerA?.id
          if (isPlayerA) s.playerARemainder = data.newRemainder
          else s.playerBRemainder = data.newRemainder

          // Swap turn
          s.currentTurnPlayerId =
            state.currentTurnPlayerId === state.playerA?.id
              ? state.playerB?.id ?? null
              : state.playerA?.id ?? null

          if (data.legWinnerId) {
            s.legWinnerId = data.legWinnerId
            s.isLegWinAnimating = true
            if (data.legWinnerId === state.playerA?.id) {
              s.playerALegsWon += 1
              s.pendingNextStarter = state.playerB?.id ?? null  // loser throws first
            } else {
              s.playerBLegsWon += 1
              s.pendingNextStarter = state.playerA?.id ?? null
            }
          }

          if (data.matchWinnerId) {
            s.winnerId = data.matchWinnerId
            s.isMatchWon = true
          }
        })

        // Announce match win after the leg animation plays out
        if (data.matchWinnerId) {
          const winnerName =
            data.matchWinnerId === state.playerA?.id ? state.playerA?.name : state.playerB?.name
          if (winnerName) setTimeout(() => announceMatchWin(winnerName), 2400)
        }
      } catch {
        set((s) => { s.error = "Network error"; s.isSubmitting = false })
      }
    },

    undoLastVisit: async () => {
      const state = get()
      if (!state.matchId || state.undoStack.length === 0 || state.isSubmitting) return

      set((s) => { s.isSubmitting = true })

      try {
        const res = await fetch(`/api/matches/${state.matchId}/undo`, {
          method: "POST",
        })

        if (!res.ok) {
          set((s) => { s.isSubmitting = false })
          return
        }

        const data = await res.json()

        set((s) => {
          s.isSubmitting = false
          s.undoStack.pop()
          s.visits = s.visits.filter((v) => v.id !== data.removedVisitId)
          s.allVisits = s.allVisits.filter((v) => v.id !== data.removedVisitId)
          s.playerARemainder = data.playerARemainder
          s.playerBRemainder = data.playerBRemainder
          s.currentTurnPlayerId = data.currentTurnPlayerId
          s.isBustDialogOpen = false
        })
      } catch {
        set((s) => { s.isSubmitting = false })
      }
    },

    confirmBust: () => {
      set((state) => {
        state.isBustDialogOpen = false
        // Swap turn (bust = turn over)
        state.currentTurnPlayerId =
          state.currentTurnPlayerId === state.playerA?.id
            ? state.playerB?.id ?? null
            : state.playerA?.id ?? null
      })
    },

    dismissLegWin: () => {
      const { pendingNextStarter, isMatchWon } = get()
      set((state) => {
        state.isLegWinAnimating = false
        state.legWinnerId = null
        state.pendingNextStarter = null
      })
      if (!isMatchWon && pendingNextStarter) {
        get().startNewLeg(pendingNextStarter)
      }
    },

    startNewLeg: async (starterId: string) => {
      const state = get()
      if (!state.matchId) return

      set((s) => { s.isSubmitting = true })

      try {
        const res = await fetch(`/api/matches/${state.matchId}/legs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ starterId }),
        })

        if (!res.ok) {
          set((s) => { s.isSubmitting = false })
          return
        }

        const leg = await res.json()

        set((s) => {
          s.isSubmitting = false
          s.currentLegId = leg.id
          s.currentTurnPlayerId = starterId
          s.playerARemainder = s.startingScore
          s.playerBRemainder = s.startingScore
          s.visits = []
          s.undoStack = []
          s.isLegWinAnimating = false
          s.legWinnerId = null
        })
      } catch {
        set((s) => { s.isSubmitting = false })
      }
    },

    reset: () => set(() => ({ ...initialState })),
  }))
)
