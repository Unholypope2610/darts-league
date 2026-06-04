"use client"

import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { PracticePlayerMeta, PracticeSessionWithRounds, HalfItRoundData, HalfItTarget } from "@/types/api"

interface HalfItStore {
  sessionId: string | null
  variant: "STANDARD" | "RANDOM"
  targetSequence: HalfItTarget[]
  players: PracticePlayerMeta[]
  currentPlayerIndex: number
  currentRound: number // 1–12
  scores: Record<string, number>
  rounds: Record<string, HalfItRoundData[]>
  status: "IN_PROGRESS" | "COMPLETED"
  winnerId: string | null
  lastRoundId: string | null
  _broadcast: ((event: string, payload: unknown) => void) | null

  hydrate: (session: PracticeSessionWithRounds) => void
  submitRound: (pointsScored: number, wasHalved: boolean, extras?: { colourConditionMet?: boolean; dartDetails?: HalfItRoundData["dartDetails"]; wildcardTargets?: [number, number] }) => Promise<void>
  applyRemoteRound: (payload: {
    playerId: string; roundId: string; data: HalfItRoundData
    scores: Record<string, number>; currentPlayerIndex: number; currentRound: number
    status: "IN_PROGRESS" | "COMPLETED"; winnerId: string | null
  }) => void
  undoLastRound: () => Promise<void>
  applyRemoteUndo: (payload: { previousPlayerIndex: number; previousRound: number; playerId: string; scores: Record<string, number> }) => void
  reset: () => void
}

export const useHalfItStore = create<HalfItStore>()(
  immer((set, get) => ({
    sessionId: null,
    variant: "STANDARD",
    targetSequence: [],
    players: [],
    currentPlayerIndex: 0,
    currentRound: 1,
    scores: {},
    rounds: {},
    status: "IN_PROGRESS",
    winnerId: null,
    lastRoundId: null,
    _broadcast: null,

    hydrate(session) {
      set((s) => {
        s.sessionId = session.id
        s.variant = session.variant as "STANDARD" | "RANDOM"
        const rawSeq = session.targetSequence
        s.targetSequence = Array.isArray(rawSeq)
          ? rawSeq as HalfItTarget[]
          : typeof rawSeq === "string"
          ? JSON.parse(rawSeq) as HalfItTarget[]
          : []
        s.players = session.players
        s.status = session.status as "IN_PROGRESS" | "COMPLETED"
        s.winnerId = session.winnerId

        const scores: Record<string, number> = {}
        const playerRounds: Record<string, HalfItRoundData[]> = {}
        for (const p of session.players) {
          scores[p.playerId] = 0
          playerRounds[p.playerId] = []
        }

        for (const r of session.rounds) {
          const d = r.data as HalfItRoundData
          playerRounds[r.playerId] = playerRounds[r.playerId] ?? []
          playerRounds[r.playerId].push(d)
          scores[r.playerId] = d.runningScore
        }

        s.scores = scores
        s.rounds = playerRounds
        const totalSubmitted = session.rounds.length
        s.currentRound = Math.floor(totalSubmitted / session.players.length) + 1
        s.currentPlayerIndex = totalSubmitted % session.players.length
      })
    },

    async submitRound(pointsScored, wasHalved, extras = {}) {
      const state = get()
      if (state.status !== "IN_PROGRESS") return

      const player = state.players[state.currentPlayerIndex]
      if (!player) return

      const target = state.targetSequence[state.currentRound - 1]
      const currentScore = state.scores[player.playerId] ?? 0
      const newScore = wasHalved
        ? Math.floor(currentScore / 2)
        : currentScore + pointsScored

      const roundData: HalfItRoundData = {
        target: target?.type === "NUMBER" ? String(target.value) : (target?.type ?? ""),
        pointsScored,
        wasHalved,
        runningScore: newScore,
        ...extras,
      }

      const roundNumber = (state.rounds[player.playerId]?.length ?? 0) + 1
      const res = await fetch(`/api/practice/${state.sessionId}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.playerId, roundNumber, data: roundData }),
      })
      const saved = await res.json()

      const newScores = { ...state.scores, [player.playerId]: newScore }
      const isLastRound = state.currentRound === state.targetSequence.length
      const isLastPlayer = state.currentPlayerIndex === state.players.length - 1

      let newStatus: "IN_PROGRESS" | "COMPLETED" = "IN_PROGRESS"
      let newWinnerId: string | null = null
      let newPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length
      let newRound = state.currentRound

      if (isLastRound && isLastPlayer) {
        newStatus = "COMPLETED"
        newWinnerId = Object.entries(newScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        const finalScores: Record<string, number> = {}
        for (const p of state.players) finalScores[p.id] = newScores[p.playerId] ?? 0
        await fetch(`/api/practice/${state.sessionId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerId: newWinnerId, finalScores }),
        })
      } else {
        if (newPlayerIndex === 0) newRound++
      }

      set((s) => {
        s.scores = newScores
        s.rounds[player.playerId] = [...(s.rounds[player.playerId] ?? []), roundData]
        s.currentPlayerIndex = newPlayerIndex
        s.currentRound = newRound
        s.status = newStatus
        s.winnerId = newWinnerId
        s.lastRoundId = saved.id ?? null
      })

      get()._broadcast?.("ROUND_SUBMITTED", {
        playerId: player.playerId,
        roundId: saved.id,
        data: roundData,
        scores: newScores,
        currentPlayerIndex: newPlayerIndex,
        currentRound: newRound,
        status: newStatus,
        winnerId: newWinnerId,
      })
    },

    applyRemoteRound(payload) {
      set((s) => {
        s.scores = payload.scores
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

      let prevPlayerIndex = state.currentPlayerIndex - 1
      let prevRound = state.currentRound
      if (prevPlayerIndex < 0) {
        prevPlayerIndex = state.players.length - 1
        prevRound = Math.max(1, state.currentRound - 1)
      }

      const prevPlayer = state.players[prevPlayerIndex]
      if (!prevPlayer) return

      const prevRounds = (state.rounds[prevPlayer.playerId] ?? []).slice(0, -1)
      const prevScore = prevRounds.length > 0 ? prevRounds[prevRounds.length - 1].runningScore : 0

      await fetch(`/api/practice/${state.sessionId}/rounds`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: state.lastRoundId }),
      })

      const newScores = { ...state.scores, [prevPlayer.playerId]: prevScore }

      set((s) => {
        s.scores = newScores
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
        const pr = s.rounds[payload.playerId]
        if (pr && pr.length > 0) s.rounds[payload.playerId] = pr.slice(0, -1)
      })
    },

    reset() {
      set((s) => {
        s.sessionId = null
        s.variant = "STANDARD"
        s.targetSequence = []
        s.players = []
        s.currentPlayerIndex = 0
        s.currentRound = 1
        s.scores = {}
        s.rounds = {}
        s.status = "IN_PROGRESS"
        s.winnerId = null
        s.lastRoundId = null
        s._broadcast = null
      })
    },
  }))
)
