"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Crosshair, Clock, CheckCircle2, Plus, BarChart2 } from "lucide-react"
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

export default function PracticeLobbyPage() {
  const [setupOpen, setSetupOpen] = useState(false)

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["practice-sessions"],
    queryFn: () => fetch("/api/practice").then((r) => r.json()),
  })

  return (
    <div className="flex flex-col gap-8">
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

      {/* Game mode quick-links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { mode: "BOBS_27", desc: "Doubles practice game · 1–4 players · 21 rounds", href: "/practice/stats/bobs27" },
          { mode: "CRICKET", desc: "Close numbers 15–20 & Bull · 2–4 players", href: "/practice/stats/cricket" },
          { mode: "HALF_IT", desc: "Score targets or your total is halved · 1–4 players · 12 rounds", href: "/practice/stats/halfit" },
        ].map(({ mode, desc, href }) => (
          <Link
            key={mode}
            href={href}
            className="group rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-primary/30 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", MODE_COLORS[mode])}>
                {MODE_LABELS[mode]}
              </span>
              <BarChart2 className="w-3.5 h-3.5 text-zinc-600 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs text-zinc-500">{desc}</p>
          </Link>
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

      <PracticeSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} />
    </div>
  )
}
