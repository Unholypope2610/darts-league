"use client"

import { use } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { useFixtures } from "@/hooks/useFixtures"
import { useBracket } from "@/hooks/useBracket"
import { seedLabel } from "@/lib/algorithms/bracket-generator"
import { cn } from "@/lib/utils/cn"

interface PlayerTournamentStats {
  playerId: string
  name: string
  avatarUrl: string | null
  average: number
  doublesPercentage: number
  count180s: number
  count140Plus: number
  count100Plus: number
  highestCheckout: number
  checkouts: number
  bestLeg: number | null
}

interface TournamentStatsResponse {
  players: PlayerTournamentStats[]
  overview: {
    totalLegs: number
    total180s: number
    highestCheckout: { score: number; playerName: string } | null
    bestLeg: { darts: number; playerName: string } | null
  }
}

interface PageProps {
  params: Promise<{ competitionId: string }>
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center flex flex-col items-center gap-0.5">
      <div className="font-score text-3xl font-black">{value}</div>
      {sub && <div className="text-xs text-primary truncate max-w-full px-1">{sub}</div>}
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  )
}

function fmt(n: number | null, suffix = ""): string {
  if (n === null || n === 0) return "—"
  return `${n}${suffix}`
}

interface MatchResultRowProps {
  playerA: { id: string; name: string; avatarUrl?: string | null }
  playerB: { id: string; name: string; avatarUrl?: string | null }
  scoreA: number
  scoreB: number
  winnerId: string | null | undefined
  matchId: string
}

function MatchResultRow({ playerA, playerB, scoreA, scoreB, winnerId, matchId }: MatchResultRowProps) {
  return (
    <Link
      href={`/matches/${matchId}`}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className={cn("text-sm font-medium truncate", winnerId === playerA.id && "text-emerald-400")}>
          {playerA.name}
        </span>
        <PlayerAvatar name={playerA.name} avatarUrl={playerA.avatarUrl ?? null} size="sm" />
      </div>
      <div className="font-score font-bold text-lg shrink-0 w-16 text-center">
        {scoreA} <span className="text-muted-foreground text-sm">–</span> {scoreB}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <PlayerAvatar name={playerB.name} avatarUrl={playerB.avatarUrl ?? null} size="sm" />
        <span className={cn("text-sm font-medium truncate", winnerId === playerB.id && "text-emerald-400")}>
          {playerB.name}
        </span>
      </div>
    </Link>
  )
}

export default function CompetitionStatsPage({ params }: PageProps) {
  const { competitionId } = use(params)

  const { data, isLoading } = useQuery<TournamentStatsResponse>({
    queryKey: ["competition-stats", competitionId],
    queryFn: () => fetch(`/api/competitions/${competitionId}/stats`).then((r) => r.json()),
  })

  const { data: fixtures } = useFixtures(competitionId)
  const { data: bracket } = useBracket(competitionId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const { players = [], overview } = data ?? { players: [], overview: { totalLegs: 0, total180s: 0, highestCheckout: null, bestLeg: null } }
  const hasData = players.some((p) => p.average > 0 || p.count180s > 0 || p.checkouts > 0)

  const cols = [
    { key: "average", label: "Avg", render: (p: PlayerTournamentStats) => p.average > 0 ? p.average.toFixed(2) : "—", className: "text-primary" },
    { key: "doublesPercentage", label: "D%", render: (p: PlayerTournamentStats) => p.doublesPercentage > 0 ? `${p.doublesPercentage.toFixed(1)}%` : "—" },
    { key: "count180s", label: "180s", render: (p: PlayerTournamentStats) => fmt(p.count180s), className: "text-amber-400" },
    { key: "count140Plus", label: "140+", render: (p: PlayerTournamentStats) => fmt(p.count140Plus) },
    { key: "count100Plus", label: "100+", render: (p: PlayerTournamentStats) => fmt(p.count100Plus) },
    { key: "highestCheckout", label: "Hi CO", render: (p: PlayerTournamentStats) => fmt(p.highestCheckout), className: "text-emerald-400" },
    { key: "bestLeg", label: "Best Leg", render: (p: PlayerTournamentStats) => p.bestLeg ? `${p.bestLeg}` : "—" },
  ]

  // Fixture results — completed fixtures grouped by matchday
  const completedFixtures = Array.isArray(fixtures)
    ? (fixtures as Array<{
        id: string
        matchday: number
        status: string
        matchId: string | null
        playerA: { id: string; name: string; avatarUrl: string | null }
        playerB: { id: string; name: string; avatarUrl: string | null }
        match: { playerAScore: number; playerBScore: number; winnerId: string | null } | null
      }>).filter((f) => f.status === "COMPLETED" && f.matchId && f.match)
    : []

  const fixturesByMatchday = completedFixtures.reduce<Record<number, typeof completedFixtures>>((acc, f) => {
    ;(acc[f.matchday] ??= []).push(f)
    return acc
  }, {})

  const matchdays = Object.keys(fixturesByMatchday).map(Number).sort((a, b) => a - b)

  // Bracket results — completed nodes grouped by round
  const completedNodes = Array.isArray(bracket)
    ? (bracket as Array<{
        id: string
        round: number
        position: number
        seedA: { id: string; name: string; avatarUrl: string | null } | null
        seedB: { id: string; name: string; avatarUrl: string | null } | null
        winnerId: string | null
        matchId: string | null
        match: { playerAScore: number; playerBScore: number; winnerId: string | null } | null
      }>).filter((n) => n.winnerId && n.matchId && n.match && n.seedA && n.seedB)
    : []

  const bracketByRound = completedNodes.reduce<Record<number, typeof completedNodes>>((acc, n) => {
    ;(acc[n.round] ??= []).push(n)
    return acc
  }, {})

  const bracketRounds = Object.keys(bracketByRound).map(Number).sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-6">
      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Legs Played" value={overview?.totalLegs ?? 0} />
        <StatCard label="Total 180s" value={overview?.total180s ?? 0} />
        <StatCard
          label="Highest Checkout"
          value={overview?.highestCheckout?.score ?? "—"}
          sub={overview?.highestCheckout?.playerName}
        />
        <StatCard
          label="Best Leg"
          value={overview?.bestLeg ? `${overview.bestLeg.darts} darts` : "—"}
          sub={overview?.bestLeg?.playerName}
        />
      </div>

      {/* Player stats table */}
      {!hasData ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground text-sm">
          No completed matches yet.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-3 py-3 font-medium text-muted-foreground w-6">#</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Player</th>
                {cols.map((c) => (
                  <th key={c.key} className="text-center px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p.playerId} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-3 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  {cols.map((c) => (
                    <td key={c.key} className={cn("text-center px-3 py-3 font-score font-bold", c.className)}>
                      {c.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fixture results */}
      {matchdays.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold">Fixture Results</h3>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
            {matchdays.map((md) => (
              <div key={md}>
                <div className="px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                  Matchday {md}
                </div>
                {fixturesByMatchday[md].map((f) => (
                  <MatchResultRow
                    key={f.id}
                    playerA={f.playerA}
                    playerB={f.playerB}
                    scoreA={f.match!.playerAScore}
                    scoreB={f.match!.playerBScore}
                    winnerId={f.match!.winnerId}
                    matchId={f.matchId!}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bracket results */}
      {bracketRounds.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold">Bracket Results</h3>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
            {bracketRounds.map((round) => (
              <div key={round}>
                <div className="px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                  {seedLabel(round)}
                </div>
                {bracketByRound[round]
                  .sort((a, b) => a.position - b.position)
                  .map((n) => (
                    <MatchResultRow
                      key={n.id}
                      playerA={n.seedA!}
                      playerB={n.seedB!}
                      scoreA={n.match!.playerAScore}
                      scoreB={n.match!.playerBScore}
                      winnerId={n.match!.winnerId}
                      matchId={n.matchId!}
                    />
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
