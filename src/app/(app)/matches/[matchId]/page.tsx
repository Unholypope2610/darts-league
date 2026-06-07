"use client"

import { use } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAverage } from "@/lib/utils/format"
import { calculateAverage, calculateFirst9Average, doublesPercentage, count180s, highestCheckout } from "@/lib/utils/stats"
import type { MatchWithLegs } from "@/types/api"

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default function MatchSummaryPage({ params }: PageProps) {
  const { matchId } = use(params)
  const { data: match, isLoading } = useQuery<MatchWithLegs>({
    queryKey: ["match", matchId],
    queryFn: () => fetch(`/api/matches/${matchId}`).then((r) => r.json()),
  })

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />
  if (!match) return <p className="text-muted-foreground">Match not found.</p>

  const m = match
  const allVisits = m.legs.flatMap((l) => l.visits)

  function calcStats(playerId: string) {
    const pVisits = allVisits.filter((v) => v.playerId === playerId)
    const pLegs = m.legs.filter((l) => l.winnerId === playerId)

    const avg = formatAverage(calculateAverage(pVisits))
    const first9 = formatAverage(calculateFirst9Average(pVisits))
    const dblPct = doublesPercentage(pVisits)
    const checkoutVisits = pVisits.filter((v) => v.isCheckout)
    const totalDartsAtDouble = checkoutVisits.reduce((sum, v) => sum + v.doublesAttempted, 0)
    const checkoutsStr =
      totalDartsAtDouble > 0 ? `${checkoutVisits.length}/${totalDartsAtDouble}` : "—"
    const hiCO = highestCheckout(pVisits)
    const hiScore = pVisits.filter((v) => !v.isBust).reduce((max, v) => Math.max(max, v.scoreThrown), 0)
    const c180s = count180s(pVisits)
    const legsWon = m.playerAId === playerId ? m.playerAScore : m.playerBScore
    const bestLeg = pLegs.length > 0 ? Math.min(...pLegs.map((l) => l.dartsThrown)) : null
    const worstLeg = pLegs.length > 0 ? Math.max(...pLegs.map((l) => l.dartsThrown)) : null

    return {
      legsWon,
      avg,
      first9,
      dblPct: dblPct > 0 ? `${dblPct.toFixed(1)}%` : "—",
      checkoutsStr,
      hiCO: hiCO > 0 ? String(hiCO) : "—",
      hiScore: hiScore > 0 ? String(hiScore) : "—",
      c180s,
      bestLeg: bestLeg !== null ? `${bestLeg} darts` : "—",
      worstLeg: worstLeg !== null ? `${worstLeg} darts` : "—",
    }
  }

  const aStats = calcStats(match.playerAId)
  const bStats = calcStats(match.playerBId)
  const isLive = !match.completedAt

  const statRows = [
    { label: "Legs Won",       a: aStats.legsWon,     b: bStats.legsWon },
    { label: "3-dart Average", a: aStats.avg,          b: bStats.avg },
    { label: "First 9 Avg",   a: aStats.first9,       b: bStats.first9 },
    { label: "Doubles %",     a: aStats.dblPct,       b: bStats.dblPct },
    { label: "Checkouts",     a: aStats.checkoutsStr, b: bStats.checkoutsStr },
    { label: "180s",          a: aStats.c180s,        b: bStats.c180s },
    { label: "Highest Finish",a: aStats.hiCO,         b: bStats.hiCO },
    { label: "Highest Score", a: aStats.hiScore,      b: bStats.hiScore },
    { label: "Best Leg",      a: aStats.bestLeg,      b: bStats.bestLeg },
    { label: "Worst Leg",     a: aStats.worstLeg,     b: bStats.worstLeg },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <PageHeader
        title={isLive ? "Match (Live)" : "Match Summary"}
        backHref="/matches"
        actions={
          isLive ? (
            <Link href={`/matches/${matchId}/live`} className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-bold">
              Resume →
            </Link>
          ) : undefined
        }
      />

      {/* Score */}
      <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <PlayerAvatar name={match.playerA.name} avatarUrl={match.playerA.avatarUrl} size="lg" />
          <span className="font-bold">{match.playerA.name}</span>
          {match.winnerId === match.playerAId && <span className="text-xs text-amber-400">🏆 Winner</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-score text-5xl font-black text-emerald-400">{match.playerAScore}</span>
          <span className="text-2xl text-muted-foreground">–</span>
          <span className="font-score text-5xl font-black text-emerald-400">{match.playerBScore}</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <PlayerAvatar name={match.playerB.name} avatarUrl={match.playerB.avatarUrl} size="lg" />
          <span className="font-bold">{match.playerB.name}</span>
          {match.winnerId === match.playerBId && <span className="text-xs text-amber-400">🏆 Winner</span>}
        </div>
      </div>

      {/* Stats comparison */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">{match.playerA.name}</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground w-32">Stat</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">{match.playerB.name}</th>
            </tr>
          </thead>
          <tbody>
            {statRows.map((row) => (
              <tr key={row.label} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2.5 text-right font-score font-bold">{row.a}</td>
                <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{row.label}</td>
                <td className="px-4 py-2.5 text-left font-score font-bold">{row.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
