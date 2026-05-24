"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { calculateAverage, calculateFirst9Average, doublesPercentage, count180s, highestCheckout } from "@/lib/utils/stats"
import { formatAverage } from "@/lib/utils/format"
import type { MatchWithLegs } from "@/types/api"

interface Props {
  matchId: string | null
  onClose: () => void
}

export function MatchSummaryModal({ matchId, onClose }: Props) {
  const { data: match, isLoading } = useQuery<MatchWithLegs>({
    queryKey: ["match", matchId],
    queryFn: () => fetch(`/api/matches/${matchId}`).then((r) => r.json()),
    enabled: !!matchId,
  })

  const open = !!matchId

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

            {/* Stats comparison */}
            {(() => {
              const aStats = calcStats(match, match.playerAId)
              const bStats = calcStats(match, match.playerBId)
              const rows = [
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
                        <td className="px-3 py-2 text-right font-score font-bold">{row.a}</td>
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">{row.label}</td>
                        <td className="px-3 py-2 text-left font-score font-bold">{row.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            })()}

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
