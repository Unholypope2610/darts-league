import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { FinishType } from "@/lib/utils/darts"
import { getNewRemainder, isMatchOver, matchWinner } from "@/lib/utils/darts"
import type { MatchWithLegs, PlayerMeta, VisitRecord, RecordVisitResponse } from "@/types/api"
import { announceVisit, announceMatchWin } from "@/lib/utils/speech"
import { toast } from "sonner"
import { isPlayerCameraRecording, getAnyRecordingPlayerId } from "@/lib/replay-capture"

interface LiveMatchStore {
  // Match metadata
  matchId: string | null
  createdByUserId: string | null
  isLocal: boolean
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

  // UI state
  isLegWinAnimating: boolean
  legWinnerId: string | null
  pendingNextStarter: string | null   // loser ID queued to throw first next leg
  isMatchWon: boolean
  isMatchDraw: boolean
  winnerId: string | null
  isSubmitting: boolean
  error: string | null
  undoStack: string[]

  // Doubles tracking prompt
  pendingDoublesPrompt: { visitId: string; type: "checkout" | "doubles" } | null
  pendingCheckoutVisitId: string | null
  awaitingMatchWinReveal: boolean  // suppresses reveal on remote devices until doubles confirmed
  pendingTurnPlayerId: string | null  // holds next turn while doubles prompt is active (non-checkout)

  // Action replay prompt
  pendingReplay: {
    scoreThrown: number
    isCheckout: boolean
    remainder: number
    playerId: string
    scorerPlayerId: string
    opponentName: string
    playerLegsWon: number
    oppLegsWon: number
  } | null

  // Realtime broadcast injected by useLiveMatch hook
  _broadcast: ((event: string, payload: unknown) => void) | null

  // Actions
  hydrate: (match: MatchWithLegs) => void
  inputDigit: (digit: string) => void
  inputShortcut: (score: number) => void
  clearInput: () => void
  backspace: () => void
  submitVisit: () => Promise<void>
  submitBust: () => Promise<void>
  confirmDoublesPrompt: (dartsUsed: number | null, doublesAttempted: number) => Promise<void>
  applyDoublesConfirmed: (visitId: string, doublesAttempted: number, dartsUsed: number | null) => void
  undoLastVisit: () => Promise<void>
  dismissLegWin: () => void
  startNewLeg: (starterId: string) => Promise<void>
  applyRemoteVisit: (data: RecordVisitResponse) => void
  applyRemoteLeg: (legId: string, starterId: string, playerALegsWon?: number, playerBLegsWon?: number) => void
  applyRemoteEdit: (updatedVisits: VisitRecord[], legWinnerId?: string | null, matchWinnerId?: string | null, isMatchDraw?: boolean) => void
  editVisit: (visitId: string, newScore: number) => Promise<void>
  clearPendingReplay: () => void
  reset: () => void
}

const initialState = {
  matchId: null,
  createdByUserId: null,
  isLocal: false,
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
  isLegWinAnimating: false,
  legWinnerId: null,
  pendingNextStarter: null,
  isMatchWon: false,
  isMatchDraw: false,
  winnerId: null,
  isSubmitting: false,
  error: null,
  undoStack: [],
  pendingDoublesPrompt: null,
  pendingCheckoutVisitId: null,
  awaitingMatchWinReveal: false,
  pendingTurnPlayerId: null,
  pendingReplay: null,
  _broadcast: null,
}

export const useLiveMatchStore = create<LiveMatchStore>()(
  immer((set, get) => ({
    ...initialState,

    hydrate: (match: MatchWithLegs) => {
      if (!match?.id || !match?.legs) return
      set((state) => {
        state.matchId = match.id
        state.createdByUserId = match.createdByUserId ?? null
        state.isLocal = match.isLocal ?? false
        state.playerA = match.playerA
        state.playerB = match.playerB
        state.startingScore = match.startingScore
        state.bestOf = match.bestOf
        state.finishType = match.finishType as FinishType
        state.isSets = match.isSets
        state.playerALegsWon = match.playerAScore
        state.playerBLegsWon = match.playerBScore
        state.winnerId = match.winnerId
        state.isMatchWon = match.completedAt !== null
        state.isMatchDraw = match.completedAt !== null && match.winnerId === null

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

    inputShortcut: (score: number) => {
      set((state) => {
        state.dartInput = score.toString()
      })
    },

    clearInput: () => {
      set((state) => {
        state.dartInput = ""
      })
    },

    backspace: () => {
      set((state) => {
        state.dartInput = state.dartInput.slice(0, -1)
      })
    },

    submitVisit: async () => {
      const state = get()
      if (!state.matchId || !state.currentLegId || !state.currentTurnPlayerId) return
      if (state.dartInput === "" || state.isSubmitting) return

      const score = parseInt(state.dartInput, 10)
      if (isNaN(score)) return

      // Capture previous remainder before any state changes
      const isCurrentPlayerA = state.currentTurnPlayerId === state.playerA?.id
      const previousRemainder = isCurrentPlayerA ? state.playerARemainder : state.playerBRemainder

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
            dartsUsed: 3,
            doublesAttempted: 0,
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

        const needsDoublesPrompt =
          !data.isCheckout && (
            data.isBust ||
            (previousRemainder <= 50 && previousRemainder % 2 === 0) ||
            (previousRemainder < 40 && previousRemainder % 2 !== 0) ||
            (!data.isBust && previousRemainder > 50 && data.newRemainder > 0 && data.newRemainder <= 50)
          )

        // Announce the visit
        const otherRemainder = isCurrentPlayerA ? state.playerBRemainder : state.playerARemainder
        const otherPlayerName = isCurrentPlayerA
          ? (state.playerB?.name ?? "")
          : (state.playerA?.name ?? "")
        announceVisit(score, otherRemainder, otherPlayerName, data.isCheckout, data.isBust)

        set((s) => {
          s.dartInput = ""
          s.isSubmitting = false
          s.visits.push(data.visit)
          s.allVisits.push(data.visit)
          s.undoStack.push(data.visit.id)

          if (!data.isBust) {
            if (isCurrentPlayerA) s.playerARemainder = data.newRemainder
            else s.playerBRemainder = data.newRemainder
          }

          // Swap turn — hold if doubles prompt is needed (non-checkout)
          const nextPlayerId =
            state.currentTurnPlayerId === state.playerA?.id
              ? state.playerB?.id ?? null
              : state.playerA?.id ?? null
          if (needsDoublesPrompt) {
            s.pendingTurnPlayerId = nextPlayerId
          } else {
            s.currentTurnPlayerId = nextPlayerId
          }

          if (data.legWinnerId) {
            s.legWinnerId = data.legWinnerId
            s.isLegWinAnimating = true
            if (data.legWinnerId === state.playerA?.id) s.playerALegsWon += 1
            else s.playerBLegsWon += 1
            // Alternate starters: next leg goes to whoever did NOT start this one
            const thisLegStarterId = state.visits[0]?.playerId ?? state.currentTurnPlayerId
            s.pendingNextStarter = thisLegStarterId === state.playerA?.id
              ? (state.playerB?.id ?? null)
              : (state.playerA?.id ?? null)
          }

          if (data.matchWinnerId || data.isMatchDraw) {
            s.winnerId = data.matchWinnerId
            s.isMatchWon = true
            s.isMatchDraw = data.isMatchDraw
          }
        })

        // Queue doubles prompt
        if (data.isCheckout) {
          set((s) => { s.pendingCheckoutVisitId = data.visit.id })
        } else if (needsDoublesPrompt) {
          set((s) => { s.pendingDoublesPrompt = { visitId: data.visit.id, type: "doubles" } })
        }

        // Trigger action replay prompt if camera is recording and score qualifies
        const scorer = state.currentTurnPlayerId === state.playerA?.id ? state.playerA : state.playerB
        const opponent = state.currentTurnPlayerId === state.playerA?.id ? state.playerB : state.playerA
        const qualifies =
          (data.isCheckout && data.visit.scoreThrown >= (scorer?.replayCheckoutThreshold ?? 69)) ||
          (!data.isCheckout && !data.isBust && data.visit.scoreThrown >= (scorer?.replayScoreThreshold ?? 100))
        if (qualifies && scorer && opponent) {
          // In local play one camera covers both players — fall back to any recording camera
          const cameraPlayerId = isPlayerCameraRecording(scorer.id)
            ? scorer.id
            : (state.isLocal ? getAnyRecordingPlayerId() : null)
          if (!cameraPlayerId) return
          const isPlayerA = scorer.id === state.playerA?.id
          // Read fresh state so leg counts reflect the just-completed checkout
          const fresh = get()
          set((s) => {
            s.pendingReplay = {
              scoreThrown: data.visit.scoreThrown,
              isCheckout: data.isCheckout,
              remainder: data.visit.runningRemainder,
              playerId: cameraPlayerId,
              scorerPlayerId: scorer.id,
              opponentName: opponent.name,
              playerLegsWon: isPlayerA ? fresh.playerALegsWon : fresh.playerBLegsWon,
              oppLegsWon: isPlayerA ? fresh.playerBLegsWon : fresh.playerALegsWon,
            }
          })
        }

        get()._broadcast?.("VISIT_RECORDED", data)

        if (data.matchWinnerId) {
          const winnerName =
            data.matchWinnerId === state.playerA?.id ? state.playerA?.name : state.playerB?.name
          if (winnerName) setTimeout(() => announceMatchWin(winnerName), 2400)
        }
      } catch {
        set((s) => { s.error = "Network error"; s.isSubmitting = false })
      }
    },

    submitBust: async () => {
      const state = get()
      if (!state.matchId || !state.currentLegId || !state.currentTurnPlayerId) return
      if (state.isSubmitting) return

      const scoreThrown = state.dartInput ? (parseInt(state.dartInput, 10) || 0) : 0

      set((s) => { s.isSubmitting = true; s.error = null })

      try {
        const res = await fetch(`/api/matches/${state.matchId}/visits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legId: state.currentLegId,
            playerId: state.currentTurnPlayerId,
            scoreThrown,
            dartsUsed: 3,
            doublesAttempted: 0,
            forceBust: true,
          }),
        })

        if (!res.ok) {
          const err = await res.json()
          const msg = err.error ?? "Failed to record bust"
          set((s) => { s.error = msg; s.isSubmitting = false })
          toast.error(msg)
          return
        }

        const data: RecordVisitResponse = await res.json()

        const isCurrentPlayerA = state.currentTurnPlayerId === state.playerA?.id
        const otherRemainder = isCurrentPlayerA ? state.playerBRemainder : state.playerARemainder
        const otherPlayerName = isCurrentPlayerA ? (state.playerB?.name ?? "") : (state.playerA?.name ?? "")
        announceVisit(scoreThrown, otherRemainder, otherPlayerName, false, true)

        set((s) => {
          s.dartInput = ""
          s.isSubmitting = false
          s.visits.push(data.visit)
          s.allVisits.push(data.visit)
          s.undoStack.push(data.visit.id)

          // Hold turn — bust always triggers doubles prompt; turn advances on confirm
          s.pendingTurnPlayerId =
            state.currentTurnPlayerId === state.playerA?.id
              ? state.playerB?.id ?? null
              : state.playerA?.id ?? null

          // Prompt immediately — bust always means possible dart at double
          s.pendingDoublesPrompt = { visitId: data.visit.id, type: "doubles" }
        })

        get()._broadcast?.("VISIT_RECORDED", data)
      } catch {
        set((s) => { s.error = "Network error"; s.isSubmitting = false })
      }
    },

    confirmDoublesPrompt: async (dartsUsed: number | null, doublesAttempted: number) => {
      const state = get()
      const { visitId, type } = state.pendingDoublesPrompt ?? {}
      if (!visitId || !state.matchId) return

      const body: Record<string, number> = { doublesAttempted }
      if (dartsUsed !== null) body.dartsUsed = dartsUsed

      await fetch(`/api/matches/${state.matchId}/visits/${visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const id = visitId
      set((s) => {
        s.visits = s.visits.map((v) => {
          if (v.id !== id) return v
          return { ...v, doublesAttempted, ...(dartsUsed !== null ? { dartsUsed } : {}) }
        })
        s.allVisits = s.allVisits.map((v) => {
          if (v.id !== id) return v
          return { ...v, doublesAttempted, ...(dartsUsed !== null ? { dartsUsed } : {}) }
        })
        s.pendingDoublesPrompt = null
        if (type === "doubles" && s.pendingTurnPlayerId) {
          s.currentTurnPlayerId = s.pendingTurnPlayerId
          s.pendingTurnPlayerId = null
        }
      })

      if (type === "checkout") {
        const { pendingNextStarter, isMatchWon } = get()
        if (isMatchWon) {
          // Broadcast so remote devices can update their visit data and show the reveal
          get()._broadcast?.("DOUBLES_CONFIRMED", { visitId: id, doublesAttempted, dartsUsed: dartsUsed ?? null })
        } else if (pendingNextStarter) {
          set((s) => { s.pendingNextStarter = null })
          get().startNewLeg(pendingNextStarter)
        }
      } else if (type === "doubles") {
        // Broadcast so remote devices can also advance their held turn
        get()._broadcast?.("DOUBLES_CONFIRMED", { visitId: id, doublesAttempted, dartsUsed: null })
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
          s.pendingDoublesPrompt = null
          s.pendingCheckoutVisitId = null
        })
      } catch {
        set((s) => { s.isSubmitting = false })
      }
    },

    dismissLegWin: () => {
      const { pendingCheckoutVisitId } = get()
      set((state) => {
        state.isLegWinAnimating = false
        state.legWinnerId = null
      })

      if (pendingCheckoutVisitId) {
        // Scoring device: show doubles prompt; startNewLeg fires from confirmDoubles
        // pendingNextStarter is intentionally kept — confirmDoubles reads it
        set((s) => {
          s.pendingDoublesPrompt = { visitId: pendingCheckoutVisitId, type: "checkout" }
          s.pendingCheckoutVisitId = null
        })
      }
      // Remote devices: do nothing — they receive LEG_STARTED broadcast → applyRemoteLeg
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

        get()._broadcast?.("LEG_STARTED", {
          legId: leg.id,
          starterId,
          playerALegsWon: get().playerALegsWon,
          playerBLegsWon: get().playerBLegsWon,
        })

      } catch {
        set((s) => { s.isSubmitting = false })
      }
    },

    applyRemoteVisit: (data: RecordVisitResponse) => {
      const preState = get()
      if (preState.visits.some((v) => v.id === data.visit.id)) return

      const isPlayerA = data.visit.playerId === preState.playerA?.id
      const previousRemainder = isPlayerA ? preState.playerARemainder : preState.playerBRemainder
      const otherRemainder = isPlayerA ? preState.playerBRemainder : preState.playerARemainder
      const otherPlayerName = isPlayerA ? (preState.playerB?.name ?? "") : (preState.playerA?.name ?? "")

      const needsDoublesPrompt =
        !data.isCheckout && (
          data.isBust ||
          (previousRemainder <= 50 && previousRemainder % 2 === 0) ||
          (previousRemainder < 40 && previousRemainder % 2 !== 0) ||
          (!data.isBust && previousRemainder > 50 && data.newRemainder > 0 && data.newRemainder <= 50)
        )

      set((state) => {
        state.visits.push(data.visit)
        state.allVisits.push(data.visit)

        if (!data.isBust) {
          if (isPlayerA) state.playerARemainder = data.newRemainder
          else state.playerBRemainder = data.newRemainder
        }

        const nextPlayerId =
          data.visit.playerId === state.playerA?.id
            ? state.playerB?.id ?? null
            : state.playerA?.id ?? null

        if (needsDoublesPrompt) {
          state.pendingTurnPlayerId = nextPlayerId
        } else {
          state.currentTurnPlayerId = nextPlayerId
        }

        if (data.legWinnerId) {
          state.legWinnerId = data.legWinnerId
          state.isLegWinAnimating = true
          if (data.legWinnerId === state.playerA?.id) state.playerALegsWon += 1
          else state.playerBLegsWon += 1
          // Alternate starters: next leg goes to whoever did NOT start this one
          const thisLegStarterId = preState.visits[0]?.playerId ?? data.visit.playerId
          state.pendingNextStarter = thisLegStarterId === state.playerA?.id
            ? (state.playerB?.id ?? null)
            : (state.playerA?.id ?? null)
        }

        if (data.matchWinnerId || data.isMatchDraw) {
          state.winnerId = data.matchWinnerId
          state.isMatchWon = true
          state.isMatchDraw = data.isMatchDraw
          // Suppress reveal until DOUBLES_CONFIRMED arrives from the submitting device
          state.awaitingMatchWinReveal = true
        }
      })

      announceVisit(data.visit.scoreThrown, otherRemainder, otherPlayerName, data.isCheckout, data.isBust)
    },

    applyDoublesConfirmed: (visitId: string, doublesAttempted: number, dartsUsed: number | null) => {
      set((s) => {
        const update = (v: VisitRecord) => {
          if (v.id !== visitId) return v
          return { ...v, doublesAttempted, ...(dartsUsed !== null ? { dartsUsed } : {}) }
        }
        s.visits = s.visits.map(update)
        s.allVisits = s.allVisits.map(update)
        s.awaitingMatchWinReveal = false
        if (s.pendingTurnPlayerId) {
          s.currentTurnPlayerId = s.pendingTurnPlayerId
          s.pendingTurnPlayerId = null
        }
      })
    },

    editVisit: async (visitId: string, newScore: number) => {
      const { matchId } = get()
      if (!matchId) return
      const res = await fetch(`/api/matches/${matchId}/visits/${visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoreThrown: newScore }),
      })
      if (!res.ok) return
      const data: {
        updatedVisits: VisitRecord[]
        legWinnerId: string | null
        matchWinnerId: string | null
        isMatchDraw: boolean
      } = await res.json()
      get().applyRemoteEdit(data.updatedVisits, data.legWinnerId, data.matchWinnerId, data.isMatchDraw)
      get()._broadcast?.("SCORE_EDITED", {
        updatedVisits: data.updatedVisits,
        legWinnerId: data.legWinnerId,
        matchWinnerId: data.matchWinnerId,
        isMatchDraw: data.isMatchDraw,
      })
    },

    applyRemoteEdit: (
      updatedVisits: VisitRecord[],
      legWinnerId?: string | null,
      matchWinnerId?: string | null,
      isMatchDraw?: boolean,
    ) => {
      const updatedMap = new Map(updatedVisits.map((v) => [v.id, v]))
      set((s) => {
        s.visits = s.visits.map((v) => { const u = updatedMap.get(v.id); return u ? { ...v, ...u } : v })
        s.allVisits = s.allVisits.map((v) => { const u = updatedMap.get(v.id); return u ? { ...v, ...u } : v })
        const aLast = [...s.visits].reverse().find((v) => v.playerId === s.playerA?.id && !v.isBust)
        const bLast = [...s.visits].reverse().find((v) => v.playerId === s.playerB?.id && !v.isBust)
        if (aLast) s.playerARemainder = aLast.runningRemainder
        if (bLast) s.playerBRemainder = bLast.runningRemainder

        if (legWinnerId) {
          s.legWinnerId = legWinnerId
          s.isLegWinAnimating = true
          if (legWinnerId === s.playerA?.id) s.playerALegsWon += 1
          else s.playerBLegsWon += 1
          s.pendingNextStarter = legWinnerId === s.playerA?.id
            ? (s.playerB?.id ?? null)
            : (s.playerA?.id ?? null)
        }
        if (matchWinnerId || isMatchDraw) {
          s.winnerId = matchWinnerId ?? null
          s.isMatchWon = true
          s.isMatchDraw = isMatchDraw ?? false
        }
      })
    },

    applyRemoteLeg: (legId: string, starterId: string, playerALegsWon?: number, playerBLegsWon?: number) => {
      set((state) => {
        if (state.currentLegId === legId) return
        state.currentLegId = legId
        state.currentTurnPlayerId = starterId
        state.playerARemainder = state.startingScore
        state.playerBRemainder = state.startingScore
        state.visits = []
        state.undoStack = []
        state.isLegWinAnimating = false
        state.legWinnerId = null
        // Apply authoritative counts from the throwing device — heals any missed VISIT_RECORDED broadcasts
        if (playerALegsWon !== undefined) state.playerALegsWon = playerALegsWon
        if (playerBLegsWon !== undefined) state.playerBLegsWon = playerBLegsWon
      })
    },

    clearPendingReplay: () => set((s) => { s.pendingReplay = null }),

    reset: () => set(() => ({ ...initialState })),
  }))
)
