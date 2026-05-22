"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { formatDistanceToNow } from "date-fns"
import { Swords, Trophy, Clock, RotateCcw, XCircle } from "lucide-react"
import { MatchSummaryModal } from "@/components/match/MatchSummaryModal"
import type { Player } from "@/types/api"

interface CasualMatch {
  id: string
  createdByUserId: string | null
  playerA: { id: string; name: string; avatarUrl: string | null }
  playerB: { id: string; name: string; avatarUrl: string | null }
  winner: { id: string; name: string } | null
  playerAScore: number
  playerBScore: number
  bestOf: number
  startingScore: number
  finishType: string
  startedAt: string
  completedAt: string | null
}

function NewMatchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: players } = useQuery<Player[]>({
    queryKey: ["players"],
    queryFn: () => fetch("/api/players").then((r) => r.json()),
  })

  const [playerAId, setPlayerAId] = useState("")
  const [playerBId, setPlayerBId] = useState("")
  const [startingPlayerId, setStartingPlayerId] = useState("")
  const [bestOf, setBestOf] = useState(7)
  const [startingScore, setStartingScore] = useState(501)
  const [finishType, setFinishType] = useState("DOUBLE_OUT")

  const { mutate: createMatch, isPending } = useMutation({
    mutationFn: () =>
      fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerAId, playerBId, bestOf, startingScore, finishType, startingPlayerId: startingPlayerId || playerAId }),
      }).then((r) => r.json()),
    onSuccess: (match) => {
      qc.invalidateQueries({ queryKey: ["casual-matches"] })
      toast.success("Match created!")
      onClose()
      router.push(`/matches/${match.id}/live`)
    },
    onError: () => toast.error("Failed to create match"),
  })

  const canStart = playerAId && playerBId && playerAId !== playerBId

  const starterOptions = [
    ...(playerAId ? [{ id: playerAId, name: players?.find((p) => p.id === playerAId)?.name ?? "Player 1" }] : []),
    ...(playerBId && playerBId !== playerAId ? [{ id: playerBId, name: players?.find((p) => p.id === playerBId)?.name ?? "Player 2" }] : []),
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white font-black text-lg">New Casual Match</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Player 1</label>
            <select
              value={playerAId}
              onChange={(e) => { if (e.target.value) setPlayerAId(e.target.value) }}
              className="w-full h-8 rounded-lg text-sm px-2.5 outline-none cursor-pointer appearance-none"
              style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", color: playerAId ? "#fff" : "#71717a" }}
            >
              <option value="" disabled>Select player...</option>
              {players?.map((p) => (
                <option key={p.id} value={p.id} style={{ background: "#1a1a1a", color: "#fff" }}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Player 2</label>
            <select
              value={playerBId}
              onChange={(e) => { if (e.target.value) setPlayerBId(e.target.value) }}
              className="w-full h-8 rounded-lg text-sm px-2.5 outline-none cursor-pointer appearance-none"
              style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", color: playerBId ? "#fff" : "#71717a" }}
            >
              <option value="" disabled>Select player...</option>
              {players?.map((p) => (
                <option key={p.id} value={p.id} style={{ background: "#1a1a1a", color: "#fff" }}>{p.name}</option>
              ))}
            </select>
          </div>

          {canStart && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Who Starts?</label>
              <select
                value={startingPlayerId || playerAId}
                onChange={(e) => { if (e.target.value) setStartingPlayerId(e.target.value) }}
                className="w-full h-8 rounded-lg text-sm px-2.5 outline-none cursor-pointer appearance-none"
                style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
              >
                {starterOptions.map((p) => (
                  <option key={p.id} value={p.id} style={{ background: "#1a1a1a" }}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Format</label>
              <Select value={String(bestOf)} onValueChange={(v) => { if (v) setBestOf(Number(v)) }}>
                <SelectTrigger style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">First to 1</SelectItem>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                    <SelectItem key={n} value={String(n)}>Best of {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Starting</label>
              <Select value={String(startingScore)} onValueChange={(v) => { if (v) setStartingScore(Number(v)) }}>
                <SelectTrigger style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[301, 501, 701].map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Finish</label>
            <Select value={finishType} onValueChange={(v) => { if (v) setFinishType(v) }}>
              <SelectTrigger style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DOUBLE_OUT">Double Out</SelectItem>
                <SelectItem value="STRAIGHT_OUT">Straight Out</SelectItem>
                <SelectItem value="MASTER_OUT">Master Out</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={() => createMatch()}
            disabled={!canStart || isPending}
            className="w-full py-3 rounded-xl font-black text-black text-sm uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02]"
            style={{ background: canStart ? "linear-gradient(135deg, #10b981, #059669)" : "#333", boxShadow: canStart ? "0 0 20px rgba(16,185,129,0.3)" : "none" }}
          >
            {isPending ? "Starting…" : "Start Match"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MatchCard({ match, myUserId, isAdmin, onSelect }: { match: CasualMatch; myUserId?: string; isAdmin?: boolean; onSelect?: (id: string) => void }) {
  const router = useRouter()
  const qc = useQueryClient()
  const isLive = !match.completedAt
  const winnerIsA = match.winner?.id === match.playerA.id
  const [confirm, setConfirm] = useState<"abandon" | "restart" | null>(null)

  const { mutate: abandon, isPending: isAbandoning } = useMutation({
    mutationFn: () =>
      fetch(`/api/matches/${match.id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casual-matches"] })
      toast.success("Match abandoned")
      setConfirm(null)
    },
    onError: () => toast.error("Failed to abandon match"),
  })

  const { mutate: restart, isPending: isRestarting } = useMutation({
    mutationFn: async () => {
      await fetch(`/api/matches/${match.id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerAId: match.playerA.id,
          playerBId: match.playerB.id,
          bestOf: match.bestOf,
          startingScore: match.startingScore,
          finishType: match.finishType,
          startingPlayerId: match.playerA.id,
        }),
      })
      return res.json()
    },
    onSuccess: (newMatch) => {
      qc.invalidateQueries({ queryKey: ["casual-matches"] })
      toast.success("Match restarted!")
      setConfirm(null)
      router.push(`/matches/${newMatch.id}/live`)
    },
    onError: () => toast.error("Failed to restart match"),
  })

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: isLive ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Confirm overlay for abandon / restart */}
      {confirm && (
        <div className="p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-white text-center">
            {confirm === "abandon" ? "Abandon this match?" : "Restart with the same settings?"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirm(null)}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => confirm === "abandon" ? abandon() : restart()}
              disabled={isAbandoning || isRestarting}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              style={{ background: confirm === "abandon" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)", color: confirm === "abandon" ? "#f87171" : "#fbbf24" }}
            >
              {isAbandoning || isRestarting ? "…" : confirm === "abandon" ? "Yes, abandon" : "Yes, restart"}
            </button>
          </div>
        </div>
      )}

      {/* Card content */}
      {!confirm && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          onClick={() => isLive ? router.push(`/matches/${match.id}/live`) : onSelect?.(match.id)}
          className="block p-4 hover:-translate-y-0.5 transition-all cursor-pointer"
        >
          {isLive && (
            <div className="flex items-center gap-1.5 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Live</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1 flex-1">
              <PlayerAvatar name={match.playerA.name} avatarUrl={match.playerA.avatarUrl} size="sm" />
              <span className={`text-sm font-bold ${winnerIsA && !isLive ? "text-emerald-400" : "text-white"}`}>
                {match.playerA.name}
              </span>
              {!isLive && winnerIsA && <Trophy className="w-3 h-3 text-amber-400" />}
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-black text-2xl text-white font-score">{match.playerAScore}</span>
                <span className="text-zinc-600 font-bold">–</span>
                <span className="font-black text-2xl text-white font-score">{match.playerBScore}</span>
              </div>
              <span className="text-xs text-zinc-600">Bo{match.bestOf} · {match.startingScore}</span>
            </div>

            <div className="flex flex-col items-center gap-1 flex-1">
              <PlayerAvatar name={match.playerB.name} avatarUrl={match.playerB.avatarUrl} size="sm" />
              <span className={`text-sm font-bold ${!winnerIsA && match.winner && !isLive ? "text-emerald-400" : "text-white"}`}>
                {match.playerB.name}
              </span>
              {!isLive && !winnerIsA && match.winner && <Trophy className="w-3 h-3 text-amber-400" />}
            </div>
          </div>

          <div className="flex items-center gap-1 mt-3 text-xs text-zinc-600">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(match.startedAt), { addSuffix: true })}
          </div>
        </div>
      )}

      {/* Abandon / Restart actions — live matches, admin or creator only */}
      {isLive && !confirm && (myUserId === match.createdByUserId || isAdmin) && (
        <div className="flex border-t border-white/5">
          <button
            onClick={() => setConfirm("abandon")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Abandon
          </button>
          <div className="w-px bg-white/5" />
          <button
            onClick={() => setConfirm("restart")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart
          </button>
        </div>
      )}
    </div>
  )
}

export default function CasualMatchesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const { data: matches, isLoading } = useQuery<CasualMatch[]>({
    queryKey: ["casual-matches"],
    queryFn: () => fetch("/api/matches").then((r) => r.json()),
    refetchInterval: 15000,
  })
  const { data: meData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })
  const myUserId: string | undefined = meData?.id
  const isAdmin: boolean = meData?.role === "ADMIN"

  const live = matches?.filter((m) => !m.completedAt) ?? []
  const recent = matches?.filter((m) => m.completedAt) ?? []

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Casual Matches</h1>
          <p className="text-zinc-500 mt-1">One-off games outside of competitions</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-black transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 0 16px rgba(16,185,129,0.3)" }}
        >
          <Swords className="w-4 h-4" />
          New Match
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      )}

      {/* Live matches */}
      {live.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-black text-white uppercase tracking-wider text-sm">In Progress</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {live.map((m) => <MatchCard key={m.id} match={m} myUserId={myUserId} isAdmin={isAdmin} onSelect={setSelectedMatchId} />)}
          </div>
        </section>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <section>
          <h2 className="font-black text-white uppercase tracking-wider text-sm mb-4">Recent Results</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recent.map((m) => <MatchCard key={m.id} match={m} myUserId={myUserId} isAdmin={isAdmin} onSelect={setSelectedMatchId} />)}
          </div>
        </section>
      )}

      {!isLoading && !matches?.length && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Swords className="w-12 h-12 text-zinc-700" />
          <p className="text-zinc-500 font-semibold">No casual matches yet</p>
          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 rounded-lg text-sm font-bold text-black"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
          >
            Start your first match
          </button>
        </div>
      )}

      <NewMatchModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <MatchSummaryModal matchId={selectedMatchId} onClose={() => setSelectedMatchId(null)} />
    </div>
  )
}
