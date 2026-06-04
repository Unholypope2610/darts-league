"use client"

import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { PracticePlayerMeta, PracticeSessionWithRounds, Bobs27RoundData } from "@/types/api"

const DOUBLES = [
  "D1","D2","D3","D4","D5","D6","D7","D8","D9","D10",
  "D11","D12","D13","D14","D15","D16","D17","D18","D19","D20","D25",
]

function doubleValue(target: string): number {
  const n = parseInt(target.replace("D", ""), 10)
  return n * 2
}

interface Bobs27Store {
  sessionId: string | null
  variant: "STANDARD" | "HARD"
  players: PracticePlayerMeta[]
  currentPlayerIndex: number
  currentRound: number // 1–21
  scores: Record<string, number>
  rounds: Record<string, Bobs27RoundData[]>
  eliminated: Record<string, boolean>
  status: "IN_PROGRESS" | "COMPLETED"
  winnerId: string | null
  lastRoundId: string | null // for undo
  _broadcast: ((event: string, payload: unknown) => void) | null

  hydrate: (session: PracticeSessionWithRounds) => void
  submitRound: (dartsHit: number) => Promise<void>
  applyRemoteRound: (payload: { playerId: string; roundNumber: number; roundId: string; data: Bobs27RoundData; scores: Record<string, number>; eliminated: Record<string, boolean>; currentPlayerIndex: number; currentRound: number; status: "IN_PROGRESS" | "COMPLETED"; winnerId: string | null }) => void
  undoLastRound: () => Promise<void>
  applyRemoteUndo: (payload: { previousPlayerIndex: number; previousRound: number; playerId: string; scores: Record<string, number> }) => void
  reset: () => void
}

export const useBobs27Store = create<Bobs27Store>()(
  immer((set, get) => ({
    sessionId: null,
    variant: "STANDARD",
    players: [],
    currentPlayerIndex: 0,
    currentRound: 1,
    scores: {},
    rounds: {},
    eliminated: {},
    status: "IN_PROGRESS",
    winnerId: null,
    lastRoundId: null,
    _broadcast: null,

    hydrate(session) {
      set((s) => {
        s.sessionId = session.id
        s.variant = session.variant as "STANDARD" | "HARD"
        s.players = session.players
        s.status = session.status as "IN_PROGRESS" | "COMPLETED"
        s.winnerId = session.winnerId

        // Rebuild scores and eliminated from persisted rounds
        const scores: Record<string, number> = {}
        const eliminated: Record<string, boolean> = {}
        const playerRounds: Record<string, Bobs27RoundData[]> = {}

        for (const p of session.players) {
          scores[p.playerId] = 27
          eliminated[p.playerId] = p.isEliminated
          playerRounds[p.playerId] = []
        }
        for (const r of session.rounds) {
          const d = r.data as Bobs27RoundData
          playerRounds[r.playerId] = playerRounds[r.playerId] ?? []
          playerRounds[r.playerId].push(d)
          scores[r.playerId] = d.runningScore
        }
        s.scores = scores
        s.eliminated = eliminated
        s.rounds = playerRounds

        // Determine current position from submitted rounds
        const totalSubmitted = session.rounds.length
        const nPlayers = session.players.filter((p) => !eliminated[p.playerId]).length || session.players.length
        s.currentRound = Math.floor(totalSubmitted / nPlayers) + 1
        s.currentPlayerIndex = totalSubmitted % session.players.length
      })
    },

    async submitRound(dartsHit) {
      const state = get()
      if (state.status !== "IN_PROGRESS") return

      const player = state.players[state.currentPlayerIndex]
      if (!player) return

      const target = DOUBLES[state.currentRound - 1]
      const val = doubleValue(target)
      const pointsChange = dartsHit === 0 ? -val : val * dartsHit
      const currentScore = state.scores[player.playerId] ?? 27
      const newScore = currentScore + pointsChange

      const roundData: Bobs27RoundData = {
        target,
        dartsHit,
        pointsChange,
        runningScore: newScore,
      }

      // Persist
      const res = await fetch(`/api/practice/${state.sessionId}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.playerId, roundNumber: state.currentRound, data: roundData }),
      })
      const saved = await res.json()

      // Advance turn
      let newPlayerIndex = state.currentPlayerIndex
      let newRound = state.currentRound
      const newEliminated = { ...state.eliminated }
      const newScores = { ...state.scores, [player.playerId]: newScore }
      let newStatus: "IN_PROGRESS" | "COMPLETED" = "IN_PROGRESS"
      let newWinnerId: string | null = null

      // Hard mode: eliminate player if score < 0
      if (state.variant === "HARD" && newScore < 0) {
        newEliminated[player.playerId] = true
        await fetch(`/api/practice/${state.sessionId}/rounds`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: player.playerId, isEliminated: true }),
        }).catch(() => {})
      }

      const activePlayers = state.players.filter((p) => !newEliminated[p.playerId])

      // Check game over
      const isLastRound = state.currentRound === 21
      const isLastPlayer = state.currentPlayerIndex === state.players.length - 1

      if (state.variant === "HARD") {
        if (activePlayers.length <= 1) {
          newStatus = "COMPLETED"
          newWinnerId = activePlayers[0]?.playerId ?? null
        } else {
          // Advance to next non-eliminated player
          let next = (state.currentPlayerIndex + 1) % state.players.length
          while (newEliminated[state.players[next].playerId] && next !== state.currentPlayerIndex) {
            next = (next + 1) % state.players.length
          }
          if (next <= state.currentPlayerIndex) newRound++
          newPlayerIndex = next
        }
      } else {
        // Standard mode
        if (isLastRound && isLastPlayer) {
          newStatus = "COMPLETED"
          // Winner = highest score
          newWinnerId = Object.entries(newScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        } else {
          newPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length
          if (newPlayerIndex === 0) newRound++
        }
      }

      if (newStatus === "COMPLETED") {
        const finalScores: Record<string, number> = {}
        for (const p of state.players) {
          const pp = state.players.find((x) => x.playerId === p.playerId)
          if (pp) finalScores[pp.id] = newScores[p.playerId] ?? 27
        }
        await fetch(`/api/practice/${state.sessionId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerId: newWinnerId, finalScores }),
        })
      }

      set((s) => {
        s.scores = newScores
        s.eliminated = newEliminated
        s.rounds[player.playerId] = [...(s.rounds[player.playerId] ?? []), roundData]
        s.currentPlayerIndex = newPlayerIndex
        s.currentRound = newRound
        s.status = newStatus
        s.winnerId = newWinnerId
        s.lastRoundId = saved.id ?? null
      })

      get()._broadcast?.("ROUND_SUBMITTED", {
        playerId: player.playerId,
        roundNumber: state.currentRound,
        roundId: saved.id,
        data: roundData,
        scores: newScores,
        eliminated: newEliminated,
        currentPlayerIndex: newPlayerIndex,
        currentRound: newRound,
        status: newStatus,
        winnerId: newWinnerId,
      })
    },

    applyRemoteRound(payload) {
      set((s) => {
        s.scores[payload.playerId] = payload.data.runningScore
        s.eliminated = payload.eliminated
        s.rounds[payload.playerId] = [...(s.rounds[payload.playerId] ?? []), payload.data]
        s.currentPlayerIndex = payload.currentPlayerIndex
        s.currentRound = payload.currentRound
        s.status = payload.status
        s.winnerId = payload.winnerId
        s.lastRoundId = payload.roundId
      })
    },

    async undoLastRound() {
      const state = get()
      if (!state.lastRoundId || !state.sessionId) return

      // Find previous player
      let prevPlayerIndex = state.currentPlayerIndex - 1
      let prevRound = state.currentRound
      if (prevPlayerIndex < 0) {
        prevPlayerIndex = state.players.length - 1
        prevRound = Math.max(1, state.currentRound - 1)
      }

      const prevPlayer = state.players[prevPlayerIndex]
      if (!prevPlayer) return

      // Revert score
      const prevRounds = (state.rounds[prevPlayer.playerId] ?? []).slice(0, -1)
      const prevScore = prevRounds.length > 0
        ? prevRounds[prevRounds.length - 1].runningScore
        : 27

      await fetch(`/api/practice/${state.sessionId}/rounds`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: state.lastRoundId }),
      })

      const newScores = { ...state.scores, [prevPlayer.playerId]: prevScore }
      const newEliminated = { ...state.eliminated, [prevPlayer.playerId]: false }

      set((s) => {
        s.scores = newScores
        s.eliminated = newEliminated
        s.rounds[prevPlayer.playerId] = prevRounds
        s.currentPlayerIndex = prevPlayerIndex
        s.currentRound = prevRound
        s.status = "IN_PROGRESS"
        s.winnerId = null
        s.lastRoundId = null
      })

      get()._broadcast?.("ROUND_UNDONE", {
        previousPlayerIndex: prevPlayerIndex,
        previousRound: prevRound,
        playerId: prevPlayer.playerId,
        scores: newScores,
      })
    },

    applyRemoteUndo(payload) {
      set((s) => {
        s.scores = payload.scores
        s.currentPlayerIndex = payload.previousPlayerIndex
        s.currentRound = payload.previousRound
        s.status = "IN_PROGRESS"
        s.winnerId = null
        s.lastRoundId = null
        // Remove last round from that player
        const pr = s.rounds[payload.playerId]
        if (pr && pr.length > 0) s.rounds[payload.playerId] = pr.slice(0, -1)
      })
    },

    reset() {
      set((s) => {
        s.sessionId = null
        s.variant = "STANDARD"
        s.players = []
        s.currentPlayerIndex = 0
        s.currentRound = 1
        s.scores = {}
        s.rounds = {}
        s.eliminated = {}
        s.status = "IN_PROGRESS"
        s.winnerId = null
        s.lastRoundId = null
        s._broadcast = null
      })
    },
  }))
)
