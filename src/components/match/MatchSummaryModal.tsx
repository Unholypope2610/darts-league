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

function calcStats(m: MatchWithLegs, playerId: string) {
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
  return {
    dartsThrown: visits.reduce((s, v) => s + v.dartsUsed, 0),
    avg: formatAverage(calculateAverage(visits)),
    checkout: leg.winnerId === playerId
      ? (visits.find((v) => v.isCheckout)?.scoreThrown ?? "—")
      : "—",
  }
}

export function MatchSummaryModal({ matchId, onClose }: Props) {
  const [currentPage, setCurrentPage] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const { data: match, isLoading } = useQuery<MatchWithLegs>({
    queryKey: ["match", matchId],
    queryFn: () => fetch(`/api/matches/${matchId}`).then((r) => r.json()),
    enabled: !!matchId,
  })

  // Reset to overview whenever the modal opens for a different match
  useEffect(() => {
    setCurrentPage(0)
  }, [matchId])

  const open = !!matchId
  const totalPages = match ? 1 + match.legs.length : 1

  function goNext() { setCurrentPage((p) => Math.min(p + 1, totalPages - 1)) }
  function goPrev() { setCurrentPage((p) => Math.max(p - 1, 0)) }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (delta > 50) goNext()
    else if (delta < -50) goPrev()
    touchStartX.current = null
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Match Summary</DialogTitle>

        {isLoading || !match ? (
          <div className="p-6 flex flex-col gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Score header */}
            <div className="p-5 flex items-center justify-center gap-6 border-b border-border">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <PlayerAvatar name={match.playerA.name} avatarUrl={match.playerA.avatarUrl} size="lg" />
                <span className="font-bold text-sm text-center">{match.playerA.name}</span>
                {match.winnerId === match.playerAId && <span className="text-xs text-amber-400">🏆 Winner</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-score text-4xl font-black text-emerald-400">{match.playerAScore}</span>
                <span className="text-xl text-muted-foreground">–</span>
                <span className="font-score text-4xl font-black text-emerald-400">{match.playerBScore}</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <PlayerAvatar name={match.playerB.name} avatarUrl={match.playerB.avatarUrl} size="lg" />
                <span className="font-bold text-sm text-center">{match.playerB.name}</span>
                {match.winnerId === match.playerBId && <span className="text-xs text-amber-400">🏆 Winner</span>}
              </div>
            </div>

            {/* Navigation — only show if there are legs to view */}
            {match.legs.length > 0 && (
              <div className="flex items-center gap-1 border-b border-border px-2 py-2 bg-muted/30">
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

            {/* Content */}
            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="overflow-y-auto max-h-[60vh]"
            >
              {currentPage === 0 ? (
                // Overview stats
                (() => {
                  const aStats = calcStats(match, match.playerAId)
                  const bStats = calcStats(match, match.playerBId)
                  const totalPollVotes = (match.pollVotesA ?? 0) + (match.pollVotesB ?? 0)
                  const rows: { label: string; a: string | number; b: string | number }[] = [
                    { label: "Legs Won",        a: aStats.legsWon,      b: bStats.legsWon },
                    { label: "3-dart Average",  a: aStats.avg,           b: bStats.avg },
                    { label: "First 9 Avg",     a: aStats.first9,        b: bStats.first9 },
                    { label: "Doubles %",       a: aStats.dblPct,        b: bStats.dblPct },
                    { label: "Checkouts",       a: aStats.checkoutsStr,  b: bStats.checkoutsStr },
                    { label: "180s",            a: aStats.c180s,         b: bStats.c180s },
                    { label: "Highest Finish",  a: aStats.hiCO,          b: bStats.hiCO },
                    { label: "Highest Score",   a: aStats.hiScore,       b: bStats.hiScore },
                    { label: "Best Leg",        a: aStats.bestLeg,       b: bStats.bestLeg },
                    { label: "Worst Leg",       a: aStats.worstLeg,      b: bStats.worstLeg },
                    ...(totalPollVotes > 0
                      ? [{ label: "Spectator Poll", a: match.pollVotesA ?? 0, b: match.pollVotesB ?? 0 }]
                      : []),
                  ]
                  return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs truncate max-w-0">{match.playerA.name}</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs w-28">Stat</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs truncate max-w-0">{match.playerB.name}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.label} className="border-b border-border/50 last:border-0">
                            <td className={cn("px-3 py-2 text-right font-bold", row.label === "Spectator Poll" ? "text-muted-foreground text-xs" : "font-score")}>{row.a}</td>
                            <td className="px-3 py-2 text-center text-xs text-muted-foreground">{row.label}</td>
                            <td className={cn("px-3 py-2 text-left font-bold", row.label === "Spectator Poll" ? "text-muted-foreground text-xs" : "font-score")}>{row.b}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                })()
              ) : (
                // Per-leg view
                (() => {
                  const leg = match.legs[currentPage - 1]
                  const aLeg = calcLegStats(leg, match.playerAId)
                  const bLeg = calcLegStats(leg, match.playerBId)
                  const starterName = leg.starterId === match.playerAId ? match.playerA.name : match.playerB.name
                  const rows = [
                    { label: "Darts Thrown", a: aLeg.dartsThrown || "—", b: bLeg.dartsThrown || "—" },
                    { label: "Leg Average",  a: aLeg.avg,               b: bLeg.avg },
                    { label: "Checkout",     a: aLeg.checkout,           b: bLeg.checkout },
                  ]
                  return (
                    <div className="flex flex-col gap-4 p-4">
                      {/* Winner + first throw */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>🎯 {starterName} threw first</span>
                        {leg.winnerId && (
                          <span className="text-amber-400 font-semibold">
                            🏆 {leg.winnerId === match.playerAId ? match.playerA.name : match.playerB.name} won
                          </span>
                        )}
                      </div>

                      {/* Leg stats */}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs truncate max-w-0">{match.playerA.name}</th>
                            <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs w-28">Stat</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs truncate max-w-0">{match.playerB.name}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.label} className="border-b border-border/50 last:border-0">
                              <td className="px-3 py-2 text-right font-score font-bold">{row.a}</td>
                              <td className="px-3 py-2 text-center text-xs text-muted-foreground">{row.label}</td>
                              <td className="px-3 py-2 text-left font-score font-bold">{row.b}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Score log */}
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

            {/* Resume link for live matches */}
            {!match.completedAt && (
              <div className="p-4 border-t border-border">
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
