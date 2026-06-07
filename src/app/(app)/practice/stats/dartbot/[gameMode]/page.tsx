"use client"

import { use } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { ArrowLeft, Bot, Trophy, Target } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { BOT_LEVEL_NAMES } from "@/lib/bot/dartbot"
import { cn } from "@/lib/utils/cn"

interface PageProps { params: Promise<{ gameMode: string }> }

const MODE_LABELS: Record<string, string> = {
  bobs27: "Bob's 27",
  cricket: "Cricket",
  halfit: "Half It",
  x01: "x01",
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      <p className="font-score font-black text-3xl text-primary">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function WinLossCard({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 flex items-center gap-4">
      <div className="size-12 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
        <Bot className="size-6 text-violet-400" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">vs DartBot Record</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-emerald-400">{wins}</span>
          <span className="text-lg text-muted-foreground font-bold">–</span>
          <span className="text-3xl font-black text-red-400">{losses}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{total} games · {winPct}% win rate</p>
      </div>
    </div>
  )
}

function PerLevelTable({ perLevel }: { perLevel: Record<number, { wins: number; losses: number }> }) {
  const levels = Object.keys(perLevel).map(Number).sort((a, b) => a - b)
  if (levels.length === 0) return null
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold mb-3">Results by Difficulty</p>
      <div className="flex flex-col gap-1.5">
        {levels.map((lvl) => {
          const { wins, losses } = perLevel[lvl]
          const total = wins + losses
          const winPct = total > 0 ? Math.round((wins / total) * 100) : 0
          return (
            <div key={lvl} className="flex items-center gap-3">
              <span className="text-xs font-bold text-violet-400 w-6">L{lvl}</span>
              <span className="text-xs text-muted-foreground w-20">{BOT_LEVEL_NAMES[lvl]}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                {total > 0 && (
                  <div className="h-1.5 rounded-full bg-emerald-400 transition-all" style={{ width: `${winPct}%` }} />
                )}
              </div>
              <span className="text-xs font-bold text-emerald-400 w-6 text-right">{wins}</span>
              <span className="text-xs text-muted-foreground">–</span>
              <span className="text-xs font-bold text-red-400 w-6">{losses}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Bobs27Stats({ data }: { data: {
  games: number; wins: number; losses: number
  perLevel: Record<number, { wins: number; losses: number }>
  averageScore: number; bestScore: number; perfectRounds: number; overallAvgDartsHit: number
  hitsByDouble: Record<string, { hits0: number; hits1: number; hits2: number; hits3: number; attempts: number }>
}}) {
  const DOUBLES = ["D1","D2","D3","D4","D5","D6","D7","D8","D9","D10","D11","D12","D13","D14","D15","D16","D17","D18","D19","D20","D25"]
  return (
    <div className="flex flex-col gap-6">
      <WinLossCard wins={data.wins} losses={data.losses} />
      <PerLevelTable perLevel={data.perLevel} />
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Average Score" value={data.averageScore} />
        <StatCard label="Best Score" value={data.bestScore} />
        <StatCard label="Perfect Rounds" value={data.perfectRounds} />
        <StatCard label="Avg Darts Hit" value={(data.overallAvgDartsHit ?? 0).toFixed(1)} sub="Per turn" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold mb-3">Hit Rate by Double</p>
        <div className="grid grid-cols-3 gap-1.5">
          {DOUBLES.map((d) => {
            const s = data.hitsByDouble[d]
            const total = s ? s.hits0 + s.hits1 + s.hits2 + s.hits3 : 0
            const rate = total > 0 ? Math.round(((s.hits1 + s.hits2 + s.hits3) / total) * 100) : 0
            return (
              <div key={d} className="flex flex-col items-center rounded-lg bg-muted p-2">
                <p className="text-xs font-semibold text-muted-foreground">{d}</p>
                <p className={cn("text-sm font-bold", rate >= 60 ? "text-emerald-400" : rate >= 30 ? "text-amber-400" : "text-muted-foreground")}>
                  {s ? `${rate}%` : "─"}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CricketStats({ data }: { data: {
  games: number; wins: number; losses: number
  perLevel: Record<number, { wins: number; losses: number }>
  mpr: number; bestGameMpr: number; bestRoundMarks: number; tripleRate: number; threeInABed: number
  totalRounds: number; marksByTarget: Record<string, number>
}}) {
  const TARGETS = ["20","19","18","17","16","15","BULL"]
  return (
    <div className="flex flex-col gap-6">
      <WinLossCard wins={data.wins} losses={data.losses} />
      <PerLevelTable perLevel={data.perLevel} />
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Marks Per Round" value={data.mpr} sub="Standard MPR" />
        <StatCard label="Best Game MPR" value={data.bestGameMpr} />
        <StatCard label="Triple Rate" value={`${data.tripleRate}%`} />
        <StatCard label="Three-in-a-Bed" value={data.threeInABed} />
        <StatCard label="Best Round" value={data.bestRoundMarks} sub="Max marks per turn" />
        <StatCard label="Total Rounds" value={data.totalRounds} />
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

function HalfItStats({ data }: { data: {
  games: number; wins: number; losses: number
  perLevel: Record<number, { wins: number; losses: number }>
  averageFinalScore: number; bestFinalScore: number; averageHalvesPerGame: number; bestRoundScore: number
}}) {
  return (
    <div className="flex flex-col gap-6">
      <WinLossCard wins={data.wins} losses={data.losses} />
      <PerLevelTable perLevel={data.perLevel} />
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Average Score" value={data.averageFinalScore} />
        <StatCard label="Best Score" value={data.bestFinalScore} />
        <StatCard label="Avg Halves/Game" value={data.averageHalvesPerGame} sub="Lower is better" />
        <StatCard label="Best Round" value={data.bestRoundScore} />
      </div>
    </div>
  )
}

function X01Stats({ data }: { data: {
  games: number; wins: number; losses: number
  perLevel: Record<number, { wins: number; losses: number }>
  threedartAvg: number; doublesHitPct: number; highestCheckout: number | null
  count180s: number; bestLegDarts: number | null; worstLegDarts: number | null
  totalLegsWon: number; totalLegsLost: number
}}) {
  return (
    <div className="flex flex-col gap-6">
      <WinLossCard wins={data.wins} losses={data.losses} />
      <PerLevelTable perLevel={data.perLevel} />
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="3-Dart Avg" value={data.threedartAvg} />
        <StatCard label="Doubles %" value={`${data.doublesHitPct}%`} sub="Checkout conversion" />
        <StatCard label="Highest Checkout" value={data.highestCheckout ?? "─"} />
        <StatCard label="180s" value={data.count180s} />
        <StatCard label="Best Leg" value={data.bestLegDarts != null ? `${data.bestLegDarts} darts` : "─"} />
        <StatCard label="Legs Won / Lost" value={`${data.totalLegsWon} / ${data.totalLegsLost}`} />
      </div>
    </div>
  )
}

export default function BotStatsPage({ params }: PageProps) {
  const { gameMode } = use(params)

  const { data, isLoading } = useQuery({
    queryKey: ["practice-stats-bot", gameMode],
    queryFn: () => fetch(`/api/practice/stats/dartbot/${gameMode}`).then((r) => r.json()),
  })

  const label = MODE_LABELS[gameMode] ?? gameMode

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3">
        <Link href="/practice" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-400" />
          <h1 className="text-xl font-black">vs DartBot — {label}</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : !data || data.games === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Trophy className="w-8 h-8 text-zinc-700" />
          <p className="text-zinc-500 text-sm">No completed bot {label} games yet.</p>
          <p className="text-zinc-600 text-xs">Challenge DartBot to see your stats here!</p>
          <Link href="/practice" className="mt-2 px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-400 text-sm font-bold hover:bg-violet-500/20 transition-colors">
            Go to Practice Arena
          </Link>
        </div>
      ) : (
        <>
          {gameMode === "bobs27" && <Bobs27Stats data={data} />}
          {gameMode === "cricket" && <CricketStats data={data} />}
          {gameMode === "halfit" && <HalfItStats data={data} />}
          {gameMode === "x01" && <X01Stats data={data} />}
        </>
      )}
    </div>
  )
}
