"use client"

import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { PracticePlayerMeta, PracticeSessionWithRounds, X01RoundData } from "@/types/api"

interface X01PracticeStore {
  sessionId: string | null
  players: PracticePlayerMeta[]
  currentPlayerIndex: number
  status: "IN_PROGRESS" | "COMPLETED"
  winnerId: string | null
  startingScore: number
  finishType: "DOUBLE_OUT" | "STRAIGHT_OUT"
  legsTarget: number
  currentLeg: number
  legsWon: Record<string, number>            // playerId → legs won
  remainders: Record<string, number>          // playerId → current remainder
  currentLegVisits: Record<string, X01RoundData[]>  // visits in the active leg
  allVisits: Record<string, X01RoundData[]>   // all visits across all legs
  dartInput: string
  isTransitioning: boolean                    // true during leg changeover animation
  lastRoundId: string | null
  visitRoundIds: Record<string, string[]>     // playerId → roundIds parallel to allVisits

  hydrate: (session: PracticeSessionWithRounds) => void
  inputDigit: (d: string) => void
  clearInput: () => void
  submitVisit: (scoreThrown: number, dartsUsed: number, doublesAttempted: number) => Promise<void>
  submitBust: () => Promise<void>
  undoLastVisit: () => Promise<void>
  editVisit: (roundId: string, newScore: number) => Promise<void>
  reset: () => void
}

function getNewRemainder(scoreThrown: number, currentRemainder: number, finishType: "DOUBLE_OUT" | "STRAIGHT_OUT"): number | null {
  const next = currentRemainder - scoreThrown
  if (next < 0) return null
  if (next === 1 && finishType === "DOUBLE_OUT") return null
  return next
}

export const useX01PracticeStore = create<X01PracticeStore>()(
  immer((set, get) => ({
    sessionId: null,
    players: [],
    currentPlayerIndex: 0,
    status: "IN_PROGRESS",
    winnerId: null,
    startingScore: 501,
    finishType: "DOUBLE_OUT",
    legsTarget: 1,
    currentLeg: 1,
    legsWon: {},
    remainders: {},
    currentLegVisits: {},
    allVisits: {},
    dartInput: "0",
    isTransitioning: false,
    lastRoundId: null,
    visitRoundIds: {},

    hydrate(session) {
      set((s) => {
        s.sessionId = session.id
        s.players = session.players
        s.status = session.status as "IN_PROGRESS" | "COMPLETED"
        s.winnerId = session.winnerId
        s.startingScore = session.startingScore ?? 501
        s.finishType = (session.finishType ?? "DOUBLE_OUT") as "DOUBLE_OUT" | "STRAIGHT_OUT"
        s.legsTarget = session.legsTarget ?? 1

        const starting = session.startingScore ?? 501
        const remainders: Record<string, number> = {}
        const legsWon: Record<string, number> = {}
        const allVisits: Record<string, X01RoundData[]> = {}
        const currentLegVisits: Record<string, X01RoundData[]> = {}

        const visitRoundIds: Record<string, string[]> = {}
        for (const p of session.players) {
          remainders[p.playerId] = starting
          legsWon[p.playerId] = 0
          allVisits[p.playerId] = []
          currentLegVisits[p.playerId] = []
          visitRoundIds[p.playerId] = []
        }

        // Replay rounds to rebuild state
        let currentLeg = 1
        const legFirstPlayer: Record<number, number> = { 1: 0 } // leg → starting playerIndex

        for (const r of session.rounds) {
          const d = r.data as X01RoundData
          allVisits[r.playerId] = allVisits[r.playerId] ?? []
          allVisits[r.playerId].push(d)
          visitRoundIds[r.playerId] = visitRoundIds[r.playerId] ?? []
          visitRoundIds[r.playerId].push(r.id)

          if (d.legNumber === currentLeg) {
            currentLegVisits[r.playerId] = currentLegVisits[r.playerId] ?? []
            currentLegVisits[r.playerId].push(d)
          }

          remainders[r.playerId] = d.newRemainder

          if (d.isCheckout) {
            legsWon[r.playerId] = (legsWon[r.playerId] ?? 0) + 1
            currentLeg++
            // Reset remainders for new leg
            for (const p of session.players) {
              remainders[p.playerId] = starting
              currentLegVisits[p.playerId] = []
            }
            // Next leg starts with the player who LOST (not the winner)
            const winnerIdx = session.players.findIndex((p) => p.playerId === r.playerId)
            const loserIdx = (winnerIdx + 1) % session.players.length
            legFirstPlayer[currentLeg] = loserIdx
          }
        }

        s.currentLeg = currentLeg
        s.legsWon = legsWon
        s.remainders = remainders
        s.allVisits = allVisits
        s.currentLegVisits = currentLegVisits
        s.visitRoundIds = visitRoundIds

        // Determine whose turn it is
        // Count visits in current leg to find position
        const visitsThisLeg = session.rounds.filter((r) => (r.data as X01RoundData).legNumber === currentLeg)
        const startingPlayerIdx = legFirstPlayer[currentLeg] ?? 0
        s.currentPlayerIndex = (startingPlayerIdx + visitsThisLeg.length) % session.players.length
      })
    },

    inputDigit(d) {
      set((s) => {
        if (s.dartInput === "0") {
          s.dartInput = d
        } else {
          const next = s.dartInput + d
          if (parseInt(next, 10) > 180) return
          s.dartInput = next
        }
      })
    },

    clearInput() {
      set((s) => { s.dartInput = "0" })
    },

    async submitVisit(scoreThrown, dartsUsed, doublesAttempted) {
      const state = get()
      if (state.status !== "IN_PROGRESS" || state.isTransitioning) return

      const player = state.players[state.currentPlayerIndex]
      if (!player) return

      const previousRemainder = state.remainders[player.playerId] ?? state.startingScore
      const newRemRaw = getNewRemainder(scoreThrown, previousRemainder, state.finishType)
      const isBust = newRemRaw === null
      const newRemainder = isBust ? previousRemainder : (newRemRaw as number)
      const isCheckout = !isBust && newRemainder === 0

      const roundData: X01RoundData = {
        legNumber: state.currentLeg,
        scoreThrown: isBust ? 0 : scoreThrown,
        dartsUsed,
        doublesAttempted,
        previousRemainder,
        newRemainder,
        isBust,
        isCheckout,
      }

      const visitNumber = (state.allVisits[player.playerId]?.length ?? 0) + 1
      const res = await fetch(`/api/practice/${state.sessionId}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: player.playerId,
          roundNumber: visitNumber,
          legNumber: state.currentLeg,
          data: roundData,
        }),
      })
      const saved = await res.json()

      const newLegsWon = { ...state.legsWon }
      let newStatus: "IN_PROGRESS" | "COMPLETED" = "IN_PROGRESS"
      let newWinnerId: string | null = null

      if (isCheckout) {
        newLegsWon[player.playerId] = (newLegsWon[player.playerId] ?? 0) + 1

        if (newLegsWon[player.playerId] >= state.legsTarget) {
          newStatus = "COMPLETED"
          newWinnerId = player.playerId
          const finalScores: Record<string, number> = {}
          for (const p of state.players) finalScores[p.id] = newLegsWon[p.playerId] ?? 0
          await fetch(`/api/practice/${state.sessionId}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ winnerId: newWinnerId, finalScores }),
          })
        }
      }

      // Calculate next player index
      const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length

      set((s) => {
        s.remainders[player.playerId] = newRemainder
        s.allVisits[player.playerId] = [...(s.allVisits[player.playerId] ?? []), roundData]
        s.currentLegVisits[player.playerId] = [...(s.currentLegVisits[player.playerId] ?? []), roundData]
        s.dartInput = "0"
        s.lastRoundId = saved.id ?? null
        if (saved.id) {
          s.visitRoundIds[player.playerId] = [...(s.visitRoundIds[player.playerId] ?? []), saved.id]
        }

        if (isCheckout) {
          s.legsWon = newLegsWon
          if (newStatus === "COMPLETED") {
            s.status = newStatus
            s.winnerId = newWinnerId
            s.isTransitioning = true
          } else {
            // Leg transition — set transitioning flag to block bot turns
            s.isTransitioning = true
          }
        } else {
          s.currentPlayerIndex = nextPlayerIndex
        }
        s.status = newStatus
        s.winnerId = newWinnerId
      })

      // Handle leg transition after a delay
      if (isCheckout && newStatus !== "COMPLETED") {
        setTimeout(() => {
          const st = get()
          const winnerIdx = st.players.findIndex((p) => p.playerId === player.playerId)
          const loserIdx = (winnerIdx + 1) % st.players.length
          const newLeg = st.currentLeg + 1
          const resetRemainders: Record<string, number> = {}
          const resetLegVisits: Record<string, X01RoundData[]> = {}
          for (const p of st.players) {
            resetRemainders[p.playerId] = st.startingScore
            resetLegVisits[p.playerId] = []
          }
          set((s) => {
            s.currentLeg = newLeg
            s.remainders = resetRemainders
            s.currentLegVisits = resetLegVisits
            s.currentPlayerIndex = loserIdx
            s.isTransitioning = false
          })
        }, 1800)
      } else if (newStatus === "COMPLETED") {
        // Keep transitioning = true so bot doesn't fire; redirect handles cleanup
      }
    },

    async submitBust() {
      return get().submitVisit(0, 3, 0)
    },

    async undoLastVisit() {
      const state = get()
      if (!state.lastRoundId || !state.sessionId) return

      let prevIdx = state.currentPlayerIndex - 1
      if (prevIdx < 0) prevIdx = state.players.length - 1
      const prevPlayer = state.players[prevIdx]
      if (!prevPlayer) return

      await fetch(`/api/practice/${state.sessionId}/rounds`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: state.lastRoundId }),
      })

      // Find the visit we're reverting
      const prevVisits = (state.allVisits[prevPlayer.playerId] ?? []).slice(0, -1)
      const lastVisit = prevVisits[prevVisits.length - 1]
      const restoredRemainder = lastVisit ? lastVisit.newRemainder : state.startingScore

      set((s) => {
        s.remainders[prevPlayer.playerId] = restoredRemainder
        s.allVisits[prevPlayer.playerId] = prevVisits
        s.visitRoundIds[prevPlayer.playerId] = (s.visitRoundIds[prevPlayer.playerId] ?? []).slice(0, -1)
        const legVisits = (s.currentLegVisits[prevPlayer.playerId] ?? []).slice(0, -1)
        s.currentLegVisits[prevPlayer.playerId] = legVisits
        s.currentPlayerIndex = prevIdx
        s.status = "IN_PROGRESS"
        s.winnerId = null
        s.lastRoundId = null
        s.isTransitioning = false
      })
    },

    async editVisit(roundId: string, newScore: number) {
      const state = get()
      if (!state.sessionId) return
      await fetch(`/api/practice/${state.sessionId}/rounds`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId, newScore }),
      })
      // Re-fetch and re-hydrate to rebuild full chain
      const session = await fetch(`/api/practice/${state.sessionId}`).then((r) => r.json())
      get().hydrate(session)
    },

    reset() {
      set((s) => {
        s.sessionId = null
        s.players = []
        s.currentPlayerIndex = 0
        s.status = "IN_PROGRESS"
        s.winnerId = null
        s.startingScore = 501
        s.finishType = "DOUBLE_OUT"
        s.legsTarget = 1
        s.currentLeg = 1
        s.legsWon = {}
        s.remainders = {}
        s.currentLegVisits = {}
        s.allVisits = {}
        s.visitRoundIds = {}
        s.dartInput = "0"
        s.isTransitioning = false
        s.lastRoundId = null
      })
    },
  }))
)
