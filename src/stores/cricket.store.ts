"use client"

import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { PracticePlayerMeta, PracticeSessionWithRounds, CricketRoundData, CricketDart } from "@/types/api"

export const CRICKET_TARGETS = ["20", "19", "18", "17", "16", "15", "BULL"] as const
export type CricketTarget = typeof CRICKET_TARGETS[number]

function targetValue(target: CricketTarget): number {
  if (target === "BULL") return 25
  return parseInt(target, 10)
}

interface CricketStore {
  sessionId: string | null
  players: PracticePlayerMeta[]
  currentPlayerIndex: number
  marks: Record<string, Record<string, number>>  // playerId → target → marks
  points: Record<string, number>                  // playerId → total points
  turns: Record<string, CricketRoundData[]>
  status: "IN_PROGRESS" | "COMPLETED"
  winnerId: string | null
  lastRoundId: string | null
  _broadcast: ((event: string, payload: unknown) => void) | null

  hydrate: (session: PracticeSessionWithRounds) => void
  submitTurn: (darts: CricketDart[]) => Promise<void>
  applyRemoteTurn: (payload: {
    playerId: string; roundId: string; data: CricketRoundData
    marks: Record<string, Record<string, number>>
    points: Record<string, number>
    currentPlayerIndex: number; status: "IN_PROGRESS" | "COMPLETED"; winnerId: string | null
  }) => void
  undoLastRound: () => Promise<void>
  applyRemoteUndo: (payload: { previousPlayerIndex: number; playerId: string; marks: Record<string, Record<string, number>>; points: Record<string, number> }) => void
  reset: () => void
}

function computeTurnResult(
  darts: CricketDart[],
  allMarks: Record<string, Record<string, number>>,
  allPoints: Record<string, number>,
  activePlayerId: string,
  allPlayerIds: string[],
): { marksEarned: Record<string, number>; pointsEarned: Record<string, number>; totalPointsEarned: number; newMarks: Record<string, Record<string, number>>; newPoints: Record<string, number> } {
  const newMarks: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(allMarks))
  const newPoints: Record<string, number> = { ...allPoints }
  const marksEarned: Record<string, number> = {}
  const pointsEarned: Record<string, number> = {}
  let totalPointsEarned = 0

  for (const dart of darts) {
    const { target, multiplier } = dart
    const currentMarks = newMarks[activePlayerId]?.[target] ?? 0
    const marksToAdd = multiplier

    if (currentMarks >= 3) {
      // Already closed — check if we can score (opponents haven't all closed it)
      const opponentsAllClosed = allPlayerIds
        .filter((pid) => pid !== activePlayerId)
        .every((pid) => (newMarks[pid]?.[target] ?? 0) >= 3)

      if (!opponentsAllClosed) {
        const val = targetValue(target as CricketTarget) * multiplier
        newPoints[activePlayerId] = (newPoints[activePlayerId] ?? 0) + val
        pointsEarned[target] = (pointsEarned[target] ?? 0) + val
        totalPointsEarned += val
      }
      continue
    }

    const newTotal = currentMarks + marksToAdd
    marksEarned[target] = (marksEarned[target] ?? 0) + marksToAdd
    if (!newMarks[activePlayerId]) newMarks[activePlayerId] = {}
    newMarks[activePlayerId][target] = newTotal

    // Overflow marks → scoring
    if (newTotal > 3) {
      const overflow = newTotal - 3
      const opponentsAllClosed = allPlayerIds
        .filter((pid) => pid !== activePlayerId)
        .every((pid) => (newMarks[pid]?.[target] ?? 0) >= 3)
      if (!opponentsAllClosed) {
        const val = targetValue(target as CricketTarget) * overflow
        newPoints[activePlayerId] = (newPoints[activePlayerId] ?? 0) + val
        pointsEarned[target] = (pointsEarned[target] ?? 0) + val
        totalPointsEarned += val
      }
    }
  }

  return { marksEarned, pointsEarned, totalPointsEarned, newMarks, newPoints }
}

function checkWin(
  playerId: string,
  marks: Record<string, Record<string, number>>,
  points: Record<string, number>,
  allPlayerIds: string[],
): boolean {
  const playerMarks = marks[playerId] ?? {}
  const allClosed = CRICKET_TARGETS.every((t) => (playerMarks[t] ?? 0) >= 3)
  if (!allClosed) return false
  const myPoints = points[playerId] ?? 0
  return allPlayerIds.every((pid) => pid === playerId || (points[pid] ?? 0) <= myPoints)
}

export const useCricketStore = create<CricketStore>()(
  immer((set, get) => ({
    sessionId: null,
    players: [],
    currentPlayerIndex: 0,
    marks: {},
    points: {},
    turns: {},
    status: "IN_PROGRESS",
    winnerId: null,
    lastRoundId: null,
    _broadcast: null,

    hydrate(session) {
      set((s) => {
        s.sessionId = session.id
        s.players = session.players
        s.status = session.status as "IN_PROGRESS" | "COMPLETED"
        s.winnerId = session.winnerId

        const marks: Record<string, Record<string, number>> = {}
        const points: Record<string, number> = {}
        const turns: Record<string, CricketRoundData[]> = {}

        for (const p of session.players) {
          marks[p.playerId] = {}
          points[p.playerId] = 0
          turns[p.playerId] = []
        }

        const allPlayerIds = session.players.map((p) => p.playerId)

        for (const r of session.rounds) {
          const d = r.data as CricketRoundData
          turns[r.playerId] = turns[r.playerId] ?? []
          turns[r.playerId].push(d)
          const result = computeTurnResult(d.darts, marks, points, r.playerId, allPlayerIds)
          Object.assign(marks, result.newMarks)
          Object.assign(points, result.newPoints)
        }

        s.marks = marks
        s.points = points
        s.turns = turns
        s.currentPlayerIndex = session.rounds.length % session.players.length
      })
    },

    async submitTurn(darts) {
      const state = get()
      if (state.status !== "IN_PROGRESS") return

      const player = state.players[state.currentPlayerIndex]
      if (!player) return

      const allPlayerIds = state.players.map((p) => p.playerId)
      const { marksEarned, pointsEarned, totalPointsEarned, newMarks, newPoints } =
        computeTurnResult(darts, state.marks, state.points, player.playerId, allPlayerIds)

      const turnData: CricketRoundData = { darts, marksEarned, pointsEarned, totalPointsEarned }
      const roundNumber = (state.turns[player.playerId]?.length ?? 0) + 1

      const res = await fetch(`/api/practice/${state.sessionId}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.playerId, roundNumber, data: turnData }),
      })
      const saved = await res.json()

      const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length

      // Check win condition
      let newStatus: "IN_PROGRESS" | "COMPLETED" = "IN_PROGRESS"
      let newWinnerId: string | null = null
      if (checkWin(player.playerId, newMarks, newPoints, allPlayerIds)) {
        newStatus = "COMPLETED"
        newWinnerId = player.playerId
        const finalScores: Record<string, number> = {}
        for (const p of state.players) finalScores[p.id] = newPoints[p.playerId] ?? 0
        await fetch(`/api/practice/${state.sessionId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerId: newWinnerId, finalScores }),
        })
      }

      set((s) => {
        s.marks = newMarks
        s.points = newPoints
        s.turns[player.playerId] = [...(s.turns[player.playerId] ?? []), turnData]
        s.currentPlayerIndex = nextPlayerIndex
        s.status = newStatus
        s.winnerId = newWinnerId
        s.lastRoundId = saved.id ?? null
      })

      get()._broadcast?.("ROUND_SUBMITTED", {
        playerId: player.playerId,
        roundId: saved.id,
        data: turnData,
        marks: newMarks,
        points: newPoints,
        currentPlayerIndex: nextPlayerIndex,
        status: newStatus,
        winnerId: newWinnerId,
      })
    },

    applyRemoteTurn(payload) {
      set((s) => {
        s.marks = payload.marks
        s.points = payload.points
        s.turns[payload.playerId] = [...(s.turns[payload.playerId] ?? []), payload.data]
        s.currentPlayerIndex = payload.currentPlayerIndex
        s.status = payload.status
        s.winnerId = payload.winnerId
        s.lastRoundId = payload.roundId
      })
    },

    async undoLastRound() {
      const state = get()
      if (!state.lastRoundId || !state.sessionId) return

      let prevPlayerIndex = state.currentPlayerIndex - 1
      if (prevPlayerIndex < 0) prevPlayerIndex = state.players.length - 1
      const prevPlayer = state.players[prevPlayerIndex]
      if (!prevPlayer) return

      await fetch(`/api/practice/${state.sessionId}/rounds`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: state.lastRoundId }),
      })

      // Rebuild marks and points from remaining turns
      const newTurns: Record<string, CricketRoundData[]> = {}
      for (const p of state.players) {
        newTurns[p.playerId] = p.playerId === prevPlayer.playerId
          ? (state.turns[p.playerId] ?? []).slice(0, -1)
          : [...(state.turns[p.playerId] ?? [])]
      }

      const newMarks: Record<string, Record<string, number>> = {}
      const newPoints: Record<string, number> = {}
      for (const p of state.players) { newMarks[p.playerId] = {}; newPoints[p.playerId] = 0 }
      const allPlayerIds = state.players.map((p) => p.playerId)

      for (const p of state.players) {
        for (const t of (newTurns[p.playerId] ?? [])) {
          const r = computeTurnResult(t.darts, newMarks, newPoints, p.playerId, allPlayerIds)
          Object.assign(newMarks, r.newMarks)
          Object.assign(newPoints, r.newPoints)
        }
      }

      set((s) => {
        s.marks = newMarks
        s.points = newPoints
        s.turns = newTurns
        s.currentPlayerIndex = prevPlayerIndex
        s.status = "IN_PROGRESS"
        s.winnerId = null
        s.lastRoundId = null
      })

      get()._broadcast?.("ROUND_UNDONE", {
        previousPlayerIndex: prevPlayerIndex,
        playerId: prevPlayer.playerId,
        marks: newMarks,
        points: newPoints,
      })
    },

    applyRemoteUndo(payload) {
      set((s) => {
        s.marks = payload.marks
        s.points = payload.points
        s.currentPlayerIndex = payload.previousPlayerIndex
        s.status = "IN_PROGRESS"
        s.winnerId = null
        s.lastRoundId = null
        const pt = s.turns[payload.playerId]
        if (pt && pt.length > 0) s.turns[payload.playerId] = pt.slice(0, -1)
      })
    },

    reset() {
      set((s) => {
        s.sessionId = null
        s.players = []
        s.currentPlayerIndex = 0
        s.marks = {}
        s.points = {}
        s.turns = {}
        s.status = "IN_PROGRESS"
        s.winnerId = null
        s.lastRoundId = null
        s._broadcast = null
      })
    },
  }))
)
