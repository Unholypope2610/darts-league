"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Crosshair, Clock, CheckCircle2, Plus, BarChart2, Target } from "lucide-react"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { PracticeSetupModal } from "@/components/practice/PracticeSetupModal"
import { cn } from "@/lib/utils/cn"

const MODE_LABELS: Record<string, string> = {
  BOBS_27: "Bob's 27",
  CRICKET: "Cricket",
  HALF_IT: "Half It",
}

const MODE_COLORS: Record<string, string> = {
  BOBS_27: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  CRICKET: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  HALF_IT: "text-violet-400 bg-violet-500/10 border-violet-500/30",
}

// ─── Stats display components ────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      <p className="font-score font-black text-3xl text-primary">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Bobs27Stats({ data }: { data: { games: number; averageScore: number; bestScore: number; perfectRounds: number; overallAvgDartsHit: number; hitsByDouble: Record<string, { hits0: number; hits1: number; hits2: number; hits3: number; attempts: number }> } }) {
  const DOUBLES = ["D1","D2","D3","D4","D5","D6","D7","D8","D9","D10","D11","D12","D13","D14","D15","D16","D17","D18","D19","D20","D25"]
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Games Played" value={data.games} />
        <StatCard label="Average Score" value={data.averageScore} />
        <StatCard label="Best Score" value={data.bestScore} />
        <StatCard label="Perfect Rounds" value={data.perfectRounds} />
        <StatCard label="Avg Darts Hit" value={(data.overallAvgDartsHit ?? 0).toFixed(1)} sub="Per turn, all doubles" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold mb-3">Hit Rate by Double</p>
        <div className="grid grid-cols-3 gap-1.5">
          {DOUBLES.map((d) => {
            const s = data.hitsByDouble[d]
            const total = s ? s.hits0 + s.hits1 + s.hits2 + s.hits3 : 0
            const rate = total > 0 ? Math.round(((s.hits1 + s.hits2 + s.hits3) / total) * 100) : 0
            const segments = [
              { count: s?.hits0 ?? 0, cls: "bg-red-500/70" },
              { count: s?.hits1 ?? 0, cls: "bg-amber-400/80" },
              { count: s?.hits2 ?? 0, cls: "bg-green-500/80" },
              { count: s?.hits3 ?? 0, cls: "bg-emerald-400" },
            ]
            return (
              <div key={d} className="flex flex-col items-center rounded-lg bg-muted p-2">
                <p className="text-xs font-semibold text-muted-foreground">{d}</p>
                <p className={cn("text-sm font-bold", rate >= 60 ? "text-emerald-400" : rate >= 30 ? "text-amber-400" : "text-muted-foreground")}>
                  {s ? `${rate}%` : "─"}
                </p>
                {total > 0 && (
                  <div className="flex w-full h-1.5 rounded-full overflow-hidden mt-1 gap-px">
                    {segments.map((seg, i) =>
                      seg.count > 0 && <div key={i} className={cn("rounded-sm", seg.cls)} style={{ flex: seg.count }} />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 justify-center">
          {[
            { cls: "bg-red-500/70", label: "0 hit" },
            { cls: "bg-amber-400/80", label: "1 hit" },
            { cls: "bg-green-500/80", label: "2 hit" },
            { cls: "bg-emerald-400", label: "3 hit" },
          ].map(({ cls, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={cn("w-2.5 h-2.5 rounded-sm", cls)} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CricketStats({ data }: { data: { games: number; wins: number; mpr: number; bestGameMpr: number; bestRoundMarks: number; tripleRate: number; threeInABed: number; totalRounds: number; marksByTarget: Record<string, number> } }) {
  const TARGETS = ["20","19","18","17","16","15","BULL"]
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Games Played" value={data.games} />
        <StatCard label="Wins" value={data.wins} sub={data.games > 0 ? `${Math.round((data.wins / data.games) * 100)}% win rate` : undefined} />
        <StatCard label="Marks Per Round" value={data.mpr} sub="Standard MPR metric" />
        <StatCard label="Best Game MPR" value={data.bestGameMpr} sub="Highest single game" />
        <StatCard label="Triple Rate" value={`${data.tripleRate}%`} sub="Triples among scoring darts" />
        <StatCard label="Three-in-a-Bed" value={data.threeInABed} sub="All 3 darts same triple" />
        <StatCard label="Best Single Round" value={data.bestRoundMarks} sub="Most marks in one visit" />
        <StatCard label="Total Rounds" value={data.totalRounds} sub="Turns played" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold mb-3">Marks by Number</p>
        <div className="flex flex-col gap-2">
          {TARGETS.map((t) => {
            const marks = data.marksByTarget?.[t] ?? 0
            const maxMarks = Math.max(1, ...Object.values(data.marksByTarget ?? {}))
            return (
              <div key={t} className="flex items-center gap-3">
                <span className="text-xs font-bold w-8 text-muted-foreground">{t === "BULL" ? "BL" : t}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(marks / maxMarks) * 100}%` }} />
                </div>
                <span className="text-xs font-bold w-8 text-right">{marks}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function HalfItStats({ data }: { data: { games: number; averageFinalScore: number; bestFinalScore: number; averageHalvesPerGame: number; bestRoundScore: number } }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Games Played" value={data.games} />
      <StatCard label="Best Final Score" value={data.bestFinalScore} />
      <StatCard label="Average Score" value={data.averageFinalScore} />
      <StatCard label="Avg Halves/Game" value={data.averageHalvesPerGame} sub="Lower is better" />
      <StatCard label="Best Round" value={data.bestRoundScore} />
    </div>
  )
}

// ─── Stats tab ───────────────────────────────────────────────────────────────

type ModeSlug = "bobs27" | "cricket" | "halfit"

function StatsTab() {
  const [modeTab, setModeTab] = useState<ModeSlug>("bobs27")
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)

  // Resolve own playerId so we can default-select the current user
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })
  const myPlayerId = me?.playerId ?? null
  const viewingPlayerId = selectedPlayerId ?? myPlayerId

  // All players for the selector
  const { data: players } = useQuery<{ id: string; name: string; avatarUrl: string | null }[]>({
    queryKey: ["players"],
    queryFn: () => fetch("/api/players").then((r) => r.json()),
  })

  const statsUrl = (slug: string) =>
    viewingPlayerId ? `/api/practice/stats/${slug}?playerId=${viewingPlayerId}` : `/api/practice/stats/${slug}`

  const { data: bobs27Data, isLoading: bobs27Loading } = useQuery({
    queryKey: ["practice-stats", "bobs27", viewingPlayerId],
    queryFn: () => fetch(statsUrl("bobs27")).then((r) => r.json()),
    enabled: !!viewingPlayerId,
  })
  const { data: cricketData, isLoading: cricketLoading } = useQuery({
    queryKey: ["practice-stats", "cricket", viewingPlayerId],
    queryFn: () => fetch(statsUrl("cricket")).then((r) => r.json()),
    enabled: !!viewingPlayerId,
  })
  const { data: halfitData, isLoading: halfitLoading } = useQuery({
    queryKey: ["practice-stats", "halfit", viewingPlayerId],
    queryFn: () => fetch(statsUrl("halfit")).then((r) => r.json()),
    enabled: !!viewingPlayerId,
  })

  const modeTabs: { key: ModeSlug; label: string }[] = [
    { key: "bobs27", label: "Bob's 27" },
    { key: "cricket", label: "Cricket" },
    { key: "halfit", label: "Half It" },
  ]

  const isLoading = modeTab === "bobs27" ? bobs27Loading : modeTab === "cricket" ? cricketLoading : halfitLoading
  const data = modeTab === "bobs27" ? bobs27Data : modeTab === "cricket" ? cricketData : halfitData
  const modeLabel = modeTabs.find((t) => t.key === modeTab)?.label ?? ""
  const viewingPlayer = players?.find((p) => p.id === viewingPlayerId)

  return (
    <div className="flex flex-col gap-4">
      {/* Player selector */}
      {players && players.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {players.map((p) => {
            const isSelected = (viewingPlayerId ?? myPlayerId) === p.id
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlayerId(p.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl border shrink-0 transition-all",
                  isSelected ? "border-primary/50 bg-primary/10" : "border-border bg-card hover:border-primary/30"
                )}
              >
                <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                <span className={cn("text-[10px] font-semibold", isSelected ? "text-primary" : "text-zinc-500")}>
                  {p.name.split(" ")[0]}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Viewing label */}
      {viewingPlayer && viewingPlayer.id !== myPlayerId && (
        <p className="text-xs text-zinc-500">Viewing <span className="font-semibold text-foreground">{viewingPlayer.name}</span></p>
      )}

      {/* Mode sub-tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-900 p-1">
        {modeTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setModeTab(key)}
            className={cn(
              "py-1.5 rounded-lg text-xs font-bold transition-all",
              modeTab === key ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : !data || data.games === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Target className="w-8 h-8 text-zinc-700" />
          <p className="text-zinc-500 text-sm">No completed {modeLabel} games yet.</p>
          <p className="text-zinc-600 text-xs">Play some games to see your stats!</p>
        </div>
      ) : (
        <>
          {modeTab === "bobs27" && <Bobs27Stats data={data} />}
          {modeTab === "cricket" && <CricketStats data={data} />}
          {modeTab === "halfit" && <HalfItStats data={data} />}
        </>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function PracticeLobbyPage() {
  const [setupOpen, setSetupOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"games" | "stats">("games")

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["practice-sessions"],
    queryFn: () => fetch("/api/practice").then((r) => r.json()),
    enabled: activeTab === "games",
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crosshair className="w-5 h-5 text-emerald-400" />
            <h1 className="text-3xl font-black text-white tracking-tight">Practice Arena</h1>
          </div>
          <p className="text-zinc-500">Alternative game modes for practice and fun</p>
        </div>
        <button
          onClick={() => setSetupOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-black transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 0 16px rgba(16,185,129,0.3)" }}
        >
          <Plus className="w-4 h-4" />
          New Game
        </button>
      </div>

      {/* Top-level tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-900 p-1">
        <button
          onClick={() => setActiveTab("games")}
          className={cn(
            "py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === "games" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          Recent Games
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === "stats" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          My Stats
        </button>
      </div>

      {/* Recent Games tab */}
      {activeTab === "games" && (
        <>
          {/* Game mode quick-links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { mode: "BOBS_27", desc: "Doubles practice game · 1–4 players · 21 rounds" },
              { mode: "CRICKET", desc: "Close numbers 15–20 & Bull · 2–4 players" },
              { mode: "HALF_IT", desc: "Score targets or your total is halved · 1–4 players · 12 rounds" },
            ].map(({ mode, desc }) => (
              <button
                key={mode}
                onClick={() => setSetupOpen(true)}
                className="group rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-primary/30 transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", MODE_COLORS[mode])}>
                    {MODE_LABELS[mode]}
                  </span>
                  <Plus className="w-3.5 h-3.5 text-zinc-600 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-xs text-zinc-500">{desc}</p>
              </button>
            ))}
          </div>

          {/* Recent sessions */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">Recent Games</h2>
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : !sessions?.length ? (
              <div className="text-center py-16 text-zinc-600 text-sm">
                No games yet — start one above!
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sessions.map((s: {
                  id: string
                  gameMode: string
                  status: string
                  startedAt: string
                  players: { playerId: string; name: string; avatarUrl?: string | null }[]
                }) => {
                  const isLive = s.status === "IN_PROGRESS"
                  return (
                    <Link
                      key={s.id}
                      href={isLive ? `/practice/${s.id}` : `/practice/${s.id}/stats`}
                      className="group rounded-xl border border-border bg-card p-4 flex items-center gap-4 hover:border-primary/30 transition-all"
                    >
                      <div className="flex -space-x-2 shrink-0">
                        {s.players.slice(0, 4).map((p) => (
                          <PlayerAvatar key={p.playerId} name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                        ))}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded border", MODE_COLORS[s.gameMode])}>
                            {MODE_LABELS[s.gameMode]}
                          </span>
                          {isLive && (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              In Progress
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">
                          {s.players.map((p) => p.name).join(" · ")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {isLive
                          ? <Clock className="w-4 h-4 text-emerald-400" />
                          : <CheckCircle2 className="w-4 h-4 text-zinc-600" />}
                        <p className="text-[10px] text-zinc-600 mt-1">
                          {new Date(s.startedAt).toLocaleDateString([], { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* Stats tab */}
      {activeTab === "stats" && <StatsTab />}

      <PracticeSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} />
    </div>
  )
}
