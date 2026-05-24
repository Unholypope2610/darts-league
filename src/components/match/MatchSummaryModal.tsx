"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { LegHistory } from "@/components/match/LiveScoring/LegHistory"
import { calculateAverage, calculateFirst9Average, doublesPercentage, count180s, highestCheckout } from "@/lib/utils/stats"
import { formatAverage } from "@/lib/utils/format"
import { cn } from "@/lib/utils/cn"
import type { MatchWithLegs, LegWithVisits } from "@/types/api"

interface Props {
  matchId: string | null
  onClose: () => void
}

type StatRow = { label: string; a: string | number; b: string | number; muted?: boolean }

function calcMatchStats(m: MatchWithLegs, playerId: string) {
  const allVisits = m.legs.flatMap((l) => l.visits)
  const pVisits = allVisits.filter((v) => v.playerId === playerId)
  const pLegs = m.legs.filter((l) => l.winnerId === playerId)
  const checkoutVisits = pVisits.filter((v) => v.isCheckout)
  const totalDartsAtDouble = pVisits.reduce((sum, v) => sum + v.doublesAttempted, 0)

  return {
    legsWon: m.playerAId === playerId ? m.playerAScore : m.playerBScore,
    avg: formatAverage(calculateAverage(pVisits)),
    first9: formatAverage(calculateFirst9Average(pVisits)),
    dblPct: doublesPercentage(pVisits) > 0 ? `${doublesPercentage(pVisits).toFixed(1)}%` : "—",
    checkoutsStr: totalDartsAtDouble > 0 ? `${checkoutVisits.length}/${totalDartsAtDouble}` : "—",
    hiCO: highestCheckout(pVisits) > 0 ? String(highestCheckout(pVisits)) : "—",
    hiScore: pVisits.filter((v) => !v.isBust).reduce((max, v) => Math.max(max, v.scoreThrown), 0) || "—",
    c180s: count180s(pVisits),
    bestLeg: pLegs.length > 0 ? `${Math.min(...pLegs.map((l) => l.dartsThrown))} darts` : "—",
    worstLeg: pLegs.length > 0 ? `${Math.max(...pLegs.map((l) => l.dartsThrown))} darts` : "—",
  }
}

function calcLegStats(leg: LegWithVisits, playerId: string) {
  const visits = leg.visits.filter((v) => v.playerId === playerId)
  const checkoutVisits = visits.filter((v) => v.isCheckout)
  const totalDartsAtDouble = visits.reduce((sum, v) => sum + v.doublesAttempted, 0)

  return {
    dartsThrown: visits.reduce((s, v) => s + v.dartsUsed, 0),
    avg: formatAverage(calculateAverage(visits)),
    first9: formatAverage(calculateFirst9Average(visits)),
    dblPct: doublesPercentage(visits) > 0 ? `${doublesPercentage(visits).toFixed(1)}%` : "—",
    checkoutsStr: totalDartsAtDouble > 0 ? `${checkoutVisits.length}/${totalDartsAtDouble}` : "—",
    c180s: count180s(visits),
    hiCO: highestCheckout(visits) > 0 ? String(highestCheckout(visits)) : "—",
    hiScore: visits.filter((v) => !v.isBust).reduce((max, v) => Math.max(max, v.scoreThrown), 0) || "—",
  }
}

function StatsTable({ playerAName, playerBName, rows }: {
  playerAName: string
  playerBName: string
  rows: StatRow[]
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs truncate max-w-0">{playerAName}</th>
          <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs w-28">Stat</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs truncate max-w-0">{playerBName}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-border/50 last:border-0">
            <td className={cn("px-3 py-2 text-right font-bold", row.muted ? "text-muted-foreground text-xs" : "font-score")}>{row.a}</td>
            <td className="px-3 py-2 text-center text-xs text-muted-foreground">{row.label}</td>
            <td className={cn("px-3 py-2 text-left font-bold", row.muted ? "text-muted-foreground text-xs" : "font-score")}>{row.b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function MatchSummaryModal({ matchId, onClose }: Props) {
  const [currentPage, setCurrentPage] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const { data: match, isLoading } = useQuery<MatchWithLegs>({
    queryKey: ["match", matchId],
    queryFn: () => fetch(`/api/matches/${matchId}`).then((r) => r.json()),
    enabled: !!matchId,
  })

  useEffect(() => { setCurrentPage(0) }, [matchId])

  const open = !!matchId
  const totalPages = match ? 1 + match.legs.length : 1

  function goNext() { setCurrentPage((p) => Math.min(p + 1, totalPages - 1)) }
  function goPrev() { setCurrentPage((p) => Math.max(p - 1, 0)) }

  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (delta > 50) goNext()
    else if (delta < -50) goPrev()
    touchStartX.current = null
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden max-h-[90dvh] flex flex-col">
        <DialogTitle className="sr-only">Match Summary</DialogTitle>

        {isLoading || !match ? (
          <div className="p-6 flex flex-col gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Score header — fixed, does not scroll */}
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-center gap-4 border-b border-border">
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <PlayerAvatar name={match.playerA.name} avatarUrl={match.playerA.avatarUrl} size="md" />
                <span className="font-bold text-xs text-center truncate w-full">{match.playerA.name}</span>
                {match.winnerId === match.playerAId && <span className="text-[10px] text-amber-400">🏆 Winner</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-score text-3xl font-black text-emerald-400">{match.playerAScore}</span>
                <span className="text-lg text-muted-foreground">–</span>
                <span className="font-score text-3xl font-black text-emerald-400">{match.playerBScore}</span>
              </div>
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <PlayerAvatar name={match.playerB.name} avatarUrl={match.playerB.avatarUrl} size="md" />
                <span className="font-bold text-xs text-center truncate w-full">{match.playerB.name}</span>
                {match.winnerId === match.playerBId && <span className="text-[10px] text-amber-400">🏆 Winner</span>}
              </div>
            </div>

            {/* Navigation tabs — fixed, does not scroll */}
            {match.legs.length > 0 && (
              <div className="flex-shrink-0 flex items-center gap-1 border-b border-border px-2 py-1.5 bg-muted/30">
                <button
                  onClick={goPrev}
                  disabled={currentPage === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-20 transition-opacity flex-shrink-0"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="flex-1 overflow-x-auto flex gap-1 no-scrollbar">
                  {["Overview", ...match.legs.map((_, i) => `Leg ${i + 1}`)].map((label, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={cn(
                        "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all",
                        i === currentPage
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={goNext}
                  disabled={currentPage === totalPages - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-20 transition-opacity flex-shrink-0"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}

            {/* Scrollable content */}
            <div
              className="flex-1 min-h-0 overflow-y-auto"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {currentPage === 0 ? (
                // Overview
                (() => {
                  const a = calcMatchStats(match, match.playerAId)
                  const b = calcMatchStats(match, match.playerBId)
                  const totalPollVotes = (match.pollVotesA ?? 0) + (match.pollVotesB ?? 0)
                  const rows: StatRow[] = [
                    { label: "Legs Won",       a: a.legsWon,      b: b.legsWon },
                    { label: "3-dart Average", a: a.avg,           b: b.avg },
                    { label: "First 9 Avg",    a: a.first9,        b: b.first9 },
                    { label: "Doubles %",      a: a.dblPct,        b: b.dblPct },
                    { label: "Checkouts",      a: a.checkoutsStr,  b: b.checkoutsStr },
                    { label: "180s",           a: a.c180s,         b: b.c180s },
                    { label: "Highest Finish", a: a.hiCO,          b: b.hiCO },
                    { label: "Highest Score",  a: a.hiScore,       b: b.hiScore },
                    { label: "Best Leg",       a: a.bestLeg,       b: b.bestLeg },
                    { label: "Worst Leg",      a: a.worstLeg,      b: b.worstLeg },
                    ...(totalPollVotes > 0
                      ? [{ label: "Spectator Poll", a: match.pollVotesA ?? 0, b: match.pollVotesB ?? 0, muted: true }]
                      : []),
                  ]
                  return <StatsTable playerAName={match.playerA.name} playerBName={match.playerB.name} rows={rows} />
                })()
              ) : (
                // Per-leg view
                (() => {
                  const leg = match.legs[currentPage - 1]
                  const a = calcLegStats(leg, match.playerAId)
                  const b = calcLegStats(leg, match.playerBId)
                  const starterName = leg.starterId === match.playerAId ? match.playerA.name : match.playerB.name
                  const rows: StatRow[] = [
                    { label: "Darts Thrown",   a: a.dartsThrown || "—", b: b.dartsThrown || "—" },
                    { label: "Leg Average",    a: a.avg,                 b: b.avg },
                    { label: "First 9 Avg",    a: a.first9,              b: b.first9 },
                    { label: "Doubles %",      a: a.dblPct,              b: b.dblPct },
                    { label: "Checkouts",      a: a.checkoutsStr,        b: b.checkoutsStr },
                    { label: "180s",           a: a.c180s,               b: b.c180s },
                    { label: "Highest Finish", a: a.hiCO,                b: b.hiCO },
                    { label: "Highest Score",  a: a.hiScore,             b: b.hiScore },
                  ]
                  return (
                    <div className="flex flex-col gap-3 p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>🎯 {starterName} threw first</span>
                        {leg.winnerId && (
                          <span className="text-amber-400 font-semibold">
                            🏆 {leg.winnerId === match.playerAId ? match.playerA.name : match.playerB.name} won
                          </span>
                        )}
                      </div>
                      <StatsTable playerAName={match.playerA.name} playerBName={match.playerB.name} rows={rows} />
                      <LegHistory
                        visits={leg.visits}
                        playerAId={match.playerAId}
                        playerBId={match.playerBId}
                        playerAName={match.playerA.name}
                        playerBName={match.playerB.name}
                      />
                    </div>
                  )
                })()
              )}
            </div>

            {/* Resume link — fixed at bottom */}
            {!match.completedAt && (
              <div className="flex-shrink-0 p-4 border-t border-border">
                <Link
                  href={`/matches/${match.id}/live`}
                  className="block text-center text-sm font-bold px-4 py-2 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
                >
                  Resume →
                </Link>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
