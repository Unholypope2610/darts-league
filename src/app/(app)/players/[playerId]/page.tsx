"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AreaChart, Area, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { usePlayer } from "@/hooks/usePlayers"
import { PageHeader } from "@/components/shared/PageHeader"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trophy } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { MatchSummaryModal } from "@/components/match/MatchSummaryModal"
import { formatDate } from "@/lib/utils/format"

interface PageProps {
  params: Promise<{ playerId: string }>
}

export default function PlayerProfilePage({ params }: PageProps) {
  const { playerId } = use(params)
  const { data: player, isLoading } = usePlayer(playerId)
  const [showTitles, setShowTitles] = useState(false)
  const [summaryMatchId, setSummaryMatchId] = useState<string | null>(null)
  const [picker, setPicker] = useState<{ label: string; matchIds: string[] } | null>(null)
  const { data: meData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })
  const canEdit = meData?.role === "ADMIN" || (meData?.playerId && meData.playerId === playerId)

  function handleStatClick(label: string, matchIds: string[]) {
    if (matchIds.length === 0) return
    if (matchIds.length === 1) setSummaryMatchId(matchIds[0])
    else setPicker({ label, matchIds })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!player) {
    return <p className="text-muted-foreground">Player not found.</p>
  }

  const cs = player.careerStats

  const statGrid = [
    { label: "Played", value: cs.played },
    { label: "Won", value: cs.won, className: "text-emerald-400" },
    { label: "Drawn", value: cs.drawn },
    { label: "Lost", value: cs.lost, className: "text-red-400" },
    { label: "Avg", value: cs.average > 0 ? cs.average.toFixed(2) : "—", className: "text-primary" },
    { label: "F9", value: cs.first9Average > 0 ? cs.first9Average.toFixed(2) : "—", className: "text-primary" },
    { label: "D%", value: cs.doublesPercentage > 0 ? `${cs.doublesPercentage.toFixed(1)}%` : "—" },
    { label: "Hi CO", value: cs.highestCheckout > 0 ? cs.highestCheckout : "—", className: "text-emerald-400" },
    { label: "180s", value: cs.highest180s, className: "text-amber-400" },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <PageHeader
        title={player.name}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/players" className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
              ← Players
            </Link>
            {canEdit && (
              <Link
                href={`/players/${player.id}/edit`}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Edit
              </Link>
            )}
          </div>
        }
      />

      {/* Identity card */}
      <div className="rounded-xl border border-border bg-card p-6 flex items-center gap-5">
        <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="xl" />
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">{player.name}</h2>
          {player.nickname && <p className="text-muted-foreground">"{player.nickname}"</p>}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{player.hand === "LEFT" ? "Left-handed" : "Right-handed"}</Badge>
            {player.titles > 0 && (
              <button
                onClick={() => setShowTitles(true)}
                className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
              >
                <Trophy className="size-3" />
                {player.titles} {player.titles === 1 ? "Title" : "Titles"}
              </button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showTitles} onOpenChange={setShowTitles}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-amber-400" />
              Titles Won
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            {player.competitionsWon.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.season}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {c.type}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Match picker — shown when a stat occurred in multiple games */}
      <Dialog open={!!picker} onOpenChange={(o) => { if (!o) setPicker(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{picker?.label}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">Occurred in multiple matches — pick one to view:</p>
          <div className="flex flex-col gap-2 pt-1">
            {picker?.matchIds.map((id) => (
              <MatchPickerButton
                key={id}
                matchId={id}
                playerId={playerId}
                onSelect={() => { setPicker(null); setSummaryMatchId(id) }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <MatchSummaryModal matchId={summaryMatchId} onClose={() => setSummaryMatchId(null)} />

      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
          <TabsTrigger value="h2h" className="flex-1">Head to Head</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          {/* Stats grid */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-3">
              {statGrid.map(({ label, value, className }) => (
                <div key={label} className="flex flex-col items-center py-4 px-2 border-b border-r border-border/50 [&:nth-child(3n)]:border-r-0 [&:nth-child(n+7)]:border-b-0">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={cn("font-score font-bold text-lg mt-0.5", className ?? "text-foreground")}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Average trendline with projection */}
          {cs.averageHistory.length >= 2 && (() => {
            const hist = cs.averageHistory
            const n = hist.length
            // Linear regression
            const sumX = (n * (n - 1)) / 2
            const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
            const sumY = hist.reduce((s, d) => s + d.average, 0)
            const sumXY = hist.reduce((s, d, i) => s + i * d.average, 0)
            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
            const intercept = (sumY - slope * sumX) / n
            const PROJ = 15
            type ChartPoint = { date: string; average: number | null; projected: number | null }
            const chartData: ChartPoint[] = hist.map((d, i) => ({
              date: d.date,
              average: d.average,
              projected: i === n - 1 ? d.average : null,
            }))
            for (let i = 1; i <= PROJ; i++) {
              const val = Math.min(170, Math.max(0, intercept + slope * (n - 1 + i)))
              chartData.push({ date: `proj-${i}`, average: null, projected: parseFloat(val.toFixed(2)) })
            }
            return (
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Average Trend</p>
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="average" stroke="var(--primary)" fill="url(#avgGrad)" strokeWidth={2} dot={false} connectNulls={false} />
                    <Area type="monotone" dataKey="projected" stroke="var(--primary)" strokeOpacity={0.4} strokeDasharray="5 3" fill="none" strokeWidth={2} dot={false} connectNulls={false} />
                    <ReferenceLine x={hist[n - 1].date} stroke="var(--border)" strokeDasharray="3 3" />
                    <Tooltip
                      formatter={(v: unknown, key: unknown) => [(v as number).toFixed(2), key === "projected" ? "Projected" : "Avg"]}
                      labelFormatter={() => ""}
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )
          })()}

          {/* Recent form */}
          {cs.recentForm.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Recent Form</p>
              <div className="flex gap-2">
                {cs.recentForm.map((r, i) => (
                  <span
                    key={i}
                    className={cn(
                      "w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center",
                      r === "W" ? "bg-emerald-500/20 text-emerald-400" :
                      r === "D" ? "bg-muted text-muted-foreground" :
                      "bg-red-500/20 text-red-400",
                    )}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top checkouts + Best leg */}
          {(cs.top3Checkouts.length > 0 || cs.bestLeg !== null) && (
            <div className="rounded-xl border border-border bg-card p-4 flex gap-6">
              {cs.top3Checkouts.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Top Checkouts</p>
                  <div className="flex gap-2">
                    {cs.top3Checkouts.map((c) => (
                      <button
                        key={c.score}
                        onClick={() => handleStatClick(`Checkout ${c.score}`, c.matchIds)}
                        className="font-score font-bold text-lg text-emerald-400 hover:text-emerald-300 hover:underline underline-offset-2 transition-colors"
                      >
                        {c.score}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {cs.bestLeg !== null && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Best Leg</p>
                  <button
                    onClick={() => handleStatClick(`Best Leg (${cs.bestLeg!.darts} darts)`, cs.bestLeg!.matchIds)}
                    className="font-score font-bold text-lg text-blue-400 hover:text-blue-300 hover:underline underline-offset-2 transition-colors text-left"
                  >
                    {cs.bestLeg.darts}d
                  </button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* H2H tab */}
        <TabsContent value="h2h" className="mt-4">
          {player.h2h.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">No completed matches yet.</p>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Opponent</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">P</th>
                    <th className="text-center px-3 py-3 font-medium text-emerald-400">W</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">D</th>
                    <th className="text-center px-3 py-3 font-medium text-red-400">L</th>
                  </tr>
                </thead>
                <tbody>
                  {player.h2h.map((row) => (
                    <tr key={row.opponent.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PlayerAvatar name={row.opponent.name} avatarUrl={row.opponent.avatarUrl} size="sm" />
                          <span className="font-medium">{row.opponent.name}</span>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3 font-score font-bold">{row.played}</td>
                      <td className="text-center px-3 py-3 font-score font-bold text-emerald-400">{row.won}</td>
                      <td className="text-center px-3 py-3 font-score font-bold text-muted-foreground">{row.drawn}</td>
                      <td className="text-center px-3 py-3 font-score font-bold text-red-400">{row.lost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MatchPickerButton({
  matchId,
  playerId,
  onSelect,
}: {
  matchId: string
  playerId: string
  onSelect: () => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: match } = useQuery<any>({
    queryKey: ["match", matchId],
    queryFn: () => fetch(`/api/matches/${matchId}`).then((r) => r.json()),
  })
  const dateLabel = match ? formatDate(match.completedAt ?? match.startedAt) : "…"
  const opponent = match
    ? match.playerAId === playerId ? match.playerB?.name : match.playerA?.name
    : null
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-xl border border-border bg-muted/30 px-4 py-3 hover:bg-muted/60 transition-colors"
    >
      <p className="font-medium text-sm">{dateLabel}</p>
      {opponent && <p className="text-xs text-muted-foreground">vs {opponent}</p>}
    </button>
  )
}
