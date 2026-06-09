"use client"

import { use, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, ArrowLeft, BarChart2, Bot } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { PracticeSessionWithRounds, Bobs27RoundData, CricketRoundData, HalfItRoundData, X01RoundData } from "@/types/api"

interface PageProps { params: Promise<{ sessionId: string }> }

const MODE_LABELS: Record<string, string> = { BOBS_27: "Bob's 27", CRICKET: "Cricket", HALF_IT: "Half It", X01: "x01" }

function halfItTargetLabel(t: { type: string; value?: number; wildcardTargets?: [number, number] }): string {
  if (t.type === "NUMBER") return String(t.value)
  if (t.type === "DOUBLES") return "Doubles"
  if (t.type === "TREBLES") return "Trebles"
  if (t.type === "BULL") return "Bull"
  if (t.type === "3_DIFF_COLOURS") return "3 Diff Colours"
  if (t.type === "3_SAME_COLOUR") return "3 Same Colour"
  if (t.type === "WILDCARD") return "Exact Number"
  return t.type
}

function Bobs27Summary({ session }: { session: PracticeSessionWithRounds }) {
  const playerRounds: Record<string, Bobs27RoundData[]> = {}
  for (const p of session.players) playerRounds[p.playerId] = []
  for (const r of session.rounds) {
    playerRounds[r.playerId] = playerRounds[r.playerId] ?? []
    playerRounds[r.playerId].push(r.data as Bobs27RoundData)
  }

  return (
    <div className="flex flex-col gap-4">
      {session.players.map((p) => {
        const pRounds = playerRounds[p.playerId] ?? []
        const finalScore = pRounds[pRounds.length - 1]?.runningScore ?? 27
        const hits = pRounds.filter((r) => r.dartsHit > 0).length
        const misses = pRounds.filter((r) => r.dartsHit === 0).length
        const perfects = pRounds.filter((r) => r.dartsHit === 3).length
        const isWinner = session.winnerId === p.playerId

        return (
          <div key={p.playerId} className={cn("rounded-xl border p-4 bg-card", isWinner ? "border-amber-500/40" : "border-border")}>
            <div className="flex items-center gap-3 mb-3">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="md" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{p.name}</p>
                  {isWinner && <Trophy className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="font-score text-2xl font-black text-primary">{finalScore}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[{ label: "Hits", value: hits }, { label: "Misses", value: misses }, { label: "Perfects", value: perfects }].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted p-2">
                  <p className="font-score font-bold text-lg">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CricketSummary({ session }: { session: PracticeSessionWithRounds }) {
  const points: Record<string, number> = {}
  const totalMarks: Record<string, number> = {}
  const totalDarts: Record<string, number> = {}
  for (const p of session.players) { points[p.playerId] = 0; totalMarks[p.playerId] = 0; totalDarts[p.playerId] = 0 }
  for (const r of session.rounds) {
    const d = r.data as CricketRoundData
    totalDarts[r.playerId] = (totalDarts[r.playerId] ?? 0) + d.darts.length
    for (const marks of Object.values(d.marksEarned)) totalMarks[r.playerId] = (totalMarks[r.playerId] ?? 0) + marks
    points[r.playerId] = (points[r.playerId] ?? 0) + d.totalPointsEarned
  }

  return (
    <div className="flex flex-col gap-4">
      {session.players.map((p) => {
        const mpd = totalDarts[p.playerId] > 0 ? (totalMarks[p.playerId] / totalDarts[p.playerId]).toFixed(2) : "0.00"
        const isWinner = session.winnerId === p.playerId
        return (
          <div key={p.playerId} className={cn("rounded-xl border p-4 bg-card", isWinner ? "border-amber-500/40" : "border-border")}>
            <div className="flex items-center gap-3 mb-3">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="md" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{p.name}</p>
                  {isWinner && <Trophy className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="text-sm text-muted-foreground">{points[p.playerId] ?? 0} pts · {totalDarts[p.playerId] ?? 0} darts</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[{ label: "Marks Per Dart", value: mpd }, { label: "Total Marks", value: totalMarks[p.playerId] ?? 0 }].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted p-2">
                  <p className="font-score font-bold text-lg">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HalfItSummary({ session }: { session: PracticeSessionWithRounds }) {
  const playerRounds: Record<string, HalfItRoundData[]> = {}
  for (const p of session.players) playerRounds[p.playerId] = []
  for (const r of session.rounds) {
    playerRounds[r.playerId] = playerRounds[r.playerId] ?? []
    playerRounds[r.playerId].push(r.data as HalfItRoundData)
  }

  // Per-round lookup: roundsByPlayer[playerId][roundIndex] = HalfItRoundData
  const roundsByPlayer: Record<string, Record<number, HalfItRoundData>> = {}
  for (const r of session.rounds) {
    roundsByPlayer[r.playerId] = roundsByPlayer[r.playerId] ?? {}
    roundsByPlayer[r.playerId][r.roundNumber - 1] = r.data as HalfItRoundData
  }

  return (
    <div className="flex flex-col gap-4">
      {session.players.map((p) => {
        const pRounds = playerRounds[p.playerId] ?? []
        const finalScore = pRounds[pRounds.length - 1]?.runningScore ?? 0
        const halves = pRounds.filter((r) => r.wasHalved).length
        const bestRound = Math.max(0, ...pRounds.map((r) => r.pointsScored))
        const isWinner = session.winnerId === p.playerId

        return (
          <div key={p.playerId} className={cn("rounded-xl border p-4 bg-card", isWinner ? "border-amber-500/40" : "border-border")}>
            <div className="flex items-center gap-3 mb-3">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="md" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{p.name}</p>
                  {isWinner && <Trophy className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="font-score text-2xl font-black text-primary">{finalScore}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[{ label: "Halved", value: halves }, { label: "Best Round", value: bestRound }, { label: "Rounds", value: pRounds.length }].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted p-2">
                  <p className="font-score font-bold text-lg">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Per-round breakdown */}
      {session.targetSequence && session.targetSequence.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-2 text-left text-muted-foreground font-semibold">Rnd</th>
                <th className="py-2 px-2 text-left text-muted-foreground font-semibold">Target</th>
                {session.players.map((p) => (
                  <th key={p.playerId} className="py-2 px-2 text-right text-muted-foreground font-semibold">{p.name.split(" ")[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {session.targetSequence.map((t, idx) => (
                <tr key={idx} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 px-2 text-muted-foreground font-semibold">{idx + 1}</td>
                  <td className="py-1.5 px-2 font-semibold">{halfItTargetLabel(t)}</td>
                  {session.players.map((p) => {
                    const pr = roundsByPlayer[p.playerId]?.[idx]
                    return (
                      <td key={p.playerId} className="py-1.5 px-2 text-right font-score">
                        {pr ? (
                          <span className={
                            pr.wasHalved ? "text-red-400"
                            : pr.pointsScored > 0 ? "text-emerald-400"
                            : "text-muted-foreground"
                          }>
                            {pr.wasHalved ? "÷2" : pr.pointsScored > 0 ? `+${pr.pointsScored}` : "0"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">─</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function calcX01Stats(visits: X01RoundData[]) {
  const totalScore = visits.reduce((s, v) => s + (v.isBust ? 0 : v.scoreThrown), 0)
  const totalDarts = visits.reduce((s, v) => s + v.dartsUsed, 0)
  const avg = totalDarts > 0 ? ((totalScore / totalDarts) * 3).toFixed(2) : "0.00"
  const checkouts = visits.filter((v) => v.isCheckout)
  const highestCO = checkouts.length > 0 ? Math.max(...checkouts.map((v) => v.scoreThrown)) : null
  const count180s = visits.filter((v) => !v.isBust && v.scoreThrown === 180).length
  const totalDA = visits.reduce((s, v) => s + (v.doublesAttempted ?? 0), 0)
  const doublesPct = totalDA > 0 ? `${Math.round((checkouts.length / totalDA) * 100)}%` : "—"

  // Build per-leg maps for best leg + first 9
  const legDartsMap: Record<number, { darts: number; won: boolean; visits: X01RoundData[] }> = {}
  for (const v of visits) {
    if (!legDartsMap[v.legNumber]) legDartsMap[v.legNumber] = { darts: 0, won: false, visits: [] }
    legDartsMap[v.legNumber].darts += v.dartsUsed
    legDartsMap[v.legNumber].visits.push(v)
    if (v.isCheckout) legDartsMap[v.legNumber].won = true
  }
  const wonLegDarts = Object.values(legDartsMap).filter((l) => l.won).map((l) => l.darts)
  const bestLeg = wonLegDarts.length > 0 ? Math.min(...wonLegDarts) : null

  let f9Score = 0, f9Count = 0
  for (const leg of Object.values(legDartsMap)) {
    for (let i = 0; i < Math.min(3, leg.visits.length); i++) {
      f9Score += leg.visits[i].isBust ? 0 : leg.visits[i].scoreThrown
      f9Count++
    }
  }
  const first9 = f9Count > 0 ? (f9Score / f9Count).toFixed(2) : "0.00"

  return { avg, first9, doublesPct, highestCO, count180s, bestLeg, totalDarts, legsWon: checkouts.length }
}

function X01Summary({ session }: { session: PracticeSessionWithRounds }) {
  const [currentPage, setCurrentPage] = useState(0)

  // Group all rounds by legNumber
  const legMap: Record<number, Array<{ playerId: string; roundNumber: number; data: X01RoundData }>> = {}
  for (const r of session.rounds) {
    const d = r.data as X01RoundData
    legMap[d.legNumber] = legMap[d.legNumber] ?? []
    legMap[d.legNumber].push({ playerId: r.playerId, roundNumber: r.roundNumber, data: d })
  }
  const legNums = Object.keys(legMap).map(Number).sort((a, b) => a - b)
  const totalPages = 1 + legNums.length

  // Per-player visits for overview
  const playerVisits: Record<string, X01RoundData[]> = {}
  for (const p of session.players) playerVisits[p.playerId] = []
  for (const r of session.rounds) {
    playerVisits[r.playerId] = playerVisits[r.playerId] ?? []
    playerVisits[r.playerId].push(r.data as X01RoundData)
  }

  const tabs = ["Overview", ...legNums.map((n) => `Leg ${n}`)]

  return (
    <div className="flex flex-col gap-4">
      {/* Tab navigation */}
      {legNums.length > 0 && (
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
          {tabs.map((label, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                i === currentPage
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground bg-muted/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Overview */}
      {currentPage === 0 && (
        <div className="flex flex-col gap-4">
          {session.players.map((p) => {
            const stats = calcX01Stats(playerVisits[p.playerId] ?? [])
            const isWinner = session.winnerId === p.playerId
            return (
              <div key={p.playerId} className={cn("rounded-xl border p-4 bg-card", isWinner ? "border-amber-500/40" : "border-border")}>
                <div className="flex items-center gap-3 mb-3">
                  {p.isBot
                    ? <div className="size-10 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center shrink-0"><Bot className="size-5 text-violet-400" /></div>
                    : <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="md" />
                  }
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{p.isBot ? "DartBot" : p.name}</p>
                      {isWinner && <Trophy className="w-4 h-4 text-amber-400" />}
                      {p.isBot && p.botLevel != null && <span className="text-xs text-violet-400">Lv.{p.botLevel}</span>}
                    </div>
                    <p className="font-score text-2xl font-black text-primary">{stats.legsWon} {stats.legsWon === 1 ? "leg" : "legs"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    { label: "Average", value: stats.avg },
                    { label: "First 9 Avg", value: stats.first9 },
                    { label: "Doubles %", value: stats.doublesPct },
                    { label: "Highest CO", value: stats.highestCO ?? "—" },
                    { label: "180s", value: stats.count180s },
                    { label: "Best Leg", value: stats.bestLeg != null ? `${stats.bestLeg}d` : "—" },
                    { label: "Total Darts", value: stats.totalDarts },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-muted p-2">
                      <p className="font-score font-bold text-lg">{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Per-leg view */}
      {currentPage > 0 && (() => {
        const legNum = legNums[currentPage - 1]
        const legRounds = legMap[legNum] ?? []
        const starterPlayerId = legRounds[0]?.playerId ?? null
        const winnerPlayerId = legRounds.find((r) => r.data.isCheckout)?.playerId ?? null
        const starterPlayer = session.players.find((p) => p.playerId === starterPlayerId)
        const winnerPlayer = session.players.find((p) => p.playerId === winnerPlayerId)

        // Per-player visits for this leg
        const legVisitsA = legRounds.filter((r) => r.playerId === session.players[0]?.playerId).map((r) => r.data)
        const legVisitsB = legRounds.filter((r) => r.playerId === session.players[1]?.playerId).map((r) => r.data)
        const playerA = session.players[0]
        const playerB = session.players[1]

        const statsA = calcX01Stats(legVisitsA)
        const statsB = calcX01Stats(legVisitsB)

        const maxLen = Math.max(legVisitsA.length, legVisitsB.length)

        const statRows = [
          { label: "Darts", a: statsA.totalDarts || "—", b: statsB.totalDarts || "—" },
          { label: "Average", a: statsA.avg, b: statsB.avg },
          { label: "First 9", a: statsA.first9, b: statsB.first9 },
          { label: "Doubles %", a: statsA.doublesPct, b: statsB.doublesPct },
          { label: "180s", a: statsA.count180s, b: statsB.count180s },
          { label: "Highest CO", a: statsA.highestCO ?? "—", b: statsB.highestCO ?? "—" },
        ]

        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>🎯 {starterPlayer ? (starterPlayer.isBot ? "DartBot" : starterPlayer.name) : "?"} threw first</span>
              {winnerPlayer && (
                <span className="text-amber-400 font-semibold">
                  🏆 {winnerPlayer.isBot ? "DartBot" : winnerPlayer.name} won
                </span>
              )}
            </div>

            {/* Stats comparison table */}
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground truncate">
                      {playerA ? (playerA.isBot ? "DartBot" : playerA.name.split(" ")[0]) : ""}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-24">Stat</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground truncate">
                      {playerB ? (playerB.isBot ? "DartBot" : playerB.name.split(" ")[0]) : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statRows.map((row) => (
                    <tr key={row.label} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 text-right font-score font-bold">{row.a}</td>
                      <td className="px-3 py-2 text-center text-xs text-muted-foreground">{row.label}</td>
                      <td className="px-3 py-2 text-left font-score font-bold">{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Visit history */}
            {maxLen > 0 && (
              <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                <div className="grid grid-cols-2 border-b border-border">
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground text-center truncate">
                    {playerA ? (playerA.isBot ? "DartBot" : playerA.name.split(" ")[0]) : ""}
                  </div>
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground text-center truncate border-l border-border">
                    {playerB ? (playerB.isBot ? "DartBot" : playerB.name.split(" ")[0]) : ""}
                  </div>
                </div>
                {Array.from({ length: maxLen }).map((_, i) => {
                  const va = legVisitsA[i]
                  const vb = legVisitsB[i]
                  return (
                    <div key={i} className="grid grid-cols-2 border-b border-border/50 last:border-0">
                      {[va, vb].map((v, col) => (
                        <div key={col} className={cn("px-3 py-2 flex items-center justify-between", col === 1 && "border-l border-border/50")}>
                          {v ? (
                            <>
                              <span className={cn("font-score text-sm font-bold",
                                v.isBust ? "text-red-500 line-through" : v.isCheckout ? "text-emerald-400" : "text-foreground"
                              )}>
                                {v.isBust ? "BUST" : v.scoreThrown}
                              </span>
                              <span className="font-score text-xs text-muted-foreground">{v.newRemainder}</span>
                            </>
                          ) : (
                            <span />
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

export default function SessionStatsPage({ params }: PageProps) {
  const { sessionId } = use(params)

  const { data: session, isLoading } = useQuery<PracticeSessionWithRounds>({
    queryKey: ["practice", sessionId],
    queryFn: () => fetch(`/api/practice/${sessionId}`).then((r) => r.json()),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    )
  }

  if (!session) return <p className="text-center text-muted-foreground p-8">Session not found.</p>

  const gameSlug = session.gameMode.toLowerCase().replace("_", "")

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3">
        <Link href="/practice" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-black">{MODE_LABELS[session.gameMode]} — Results</h1>
          <p className="text-xs text-muted-foreground">{new Date(session.startedAt).toLocaleString()}</p>
        </div>
      </div>

      {session.gameMode === "BOBS_27" && <Bobs27Summary session={session} />}
      {session.gameMode === "CRICKET" && <CricketSummary session={session} />}
      {session.gameMode === "HALF_IT" && <HalfItSummary session={session} />}
      {session.gameMode === "X01" && <X01Summary session={session} />}

      <Link
        href={session.isBotGame ? `/practice/stats/dartbot/${gameSlug}` : `/practice/stats/${gameSlug}`}
        className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:border-primary/30 hover:text-foreground transition-all"
      >
        <BarChart2 className="w-4 h-4" />
        View All-Time Stats
      </Link>

      <Link
        href="/practice"
        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold active:scale-95 transition-all"
      >
        Back to Practice Arena
      </Link>
    </div>
  )
}
