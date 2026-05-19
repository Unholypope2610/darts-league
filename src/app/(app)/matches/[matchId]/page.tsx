"use client"

import { use } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAverage } from "@/lib/utils/format"
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

  const allVisits = match.legs.flatMap((l) => l.visits)

  function calcStats(playerId: string) {
    const pVisits = allVisits.filter((v) => v.playerId === playerId && !v.isBust)
    const totalDarts = pVisits.reduce((a, v) => a + v.dartsUsed, 0)
    const totalScore = pVisits.reduce((a, v) => a + v.scoreThrown, 0)
    const s180s = pVisits.filter((v) => v.scoreThrown === 180).length
    const checkouts = pVisits.filter((v) => v.isCheckout)
    const highestCheckout = checkouts.length > 0 ? Math.max(...checkouts.map((v) => v.scoreThrown)) : null
    return {
      avg: totalDarts > 0 ? formatAverage((totalScore / totalDarts) * 3) : "0.00",
      s180s,
      highestCheckout,
      legsWon: match.playerAId === playerId ? match.playerAScore : match.playerBScore,
    }
  }

  const aStats = calcStats(match.playerAId)
  const bStats = calcStats(match.playerBId)
  const isLive = !match.completedAt

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <PageHeader
        title={isLive ? "Match (Live)" : "Match Summary"}
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
              <th className="px-4 py-2 text-center font-medium text-muted-foreground w-24">Stat</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">{match.playerB.name}</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Legs Won", a: aStats.legsWon, b: bStats.legsWon },
              { label: "Average", a: aStats.avg, b: bStats.avg },
              { label: "180s", a: aStats.s180s, b: bStats.s180s },
              { label: "Highest Checkout", a: aStats.highestCheckout ?? "—", b: bStats.highestCheckout ?? "—" },
            ].map((row) => (
              <tr key={row.label} className="border-b border-border/50">
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
