"use client"

import { use } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { ArrowLeft, Target } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils/cn"

interface PageProps { params: Promise<{ gameMode: string }> }

const MODE_LABELS: Record<string, string> = { bobs27: "Bob's 27", cricket: "Cricket", halfit: "Half It" }

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

function CricketStats({ data }: { data: { games: number; wins: number; mpd: number; mpr: number; marksByTarget: Record<string, number> } }) {
  const TARGETS = ["20","19","18","17","16","15","BULL"]
  const totalMarks = Object.values(data.marksByTarget ?? {}).reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Games Played" value={data.games} />
        <StatCard label="Wins" value={data.wins} sub={data.games > 0 ? `${Math.round((data.wins / data.games) * 100)}% win rate` : undefined} />
        <StatCard label="Marks Per Dart" value={data.mpd} sub="Key performance metric" />
        <StatCard label="Total Marks" value={totalMarks} />
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

export default function HistoricalStatsPage({ params }: PageProps) {
  const { gameMode } = use(params)

  const { data, isLoading } = useQuery({
    queryKey: ["practice-stats", gameMode],
    queryFn: () => fetch(`/api/practice/stats/${gameMode}`).then((r) => r.json()),
  })

  const label = MODE_LABELS[gameMode] ?? gameMode

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3">
        <Link href="/practice" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-black">{label} — All-Time Stats</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : !data || data.games === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No completed {label} games yet. Play some games to see your stats!
        </div>
      ) : (
        <>
          {gameMode === "bobs27" && <Bobs27Stats data={data} />}
          {gameMode === "cricket" && <CricketStats data={data} />}
          {gameMode === "halfit" && <HalfItStats data={data} />}
        </>
      )}
    </div>
  )
}
