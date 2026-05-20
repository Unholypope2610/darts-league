"use client"

import { use } from "react"
import Link from "next/link"
import { usePlayer } from "@/hooks/usePlayers"
import { PageHeader } from "@/components/shared/PageHeader"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils/cn"

interface PageProps {
  params: Promise<{ playerId: string }>
}

export default function PlayerProfilePage({ params }: PageProps) {
  const { playerId } = use(params)
  const { data: player, isLoading } = usePlayer(playerId)

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
    { label: "D%", value: cs.doublesPercentage > 0 ? `${cs.doublesPercentage.toFixed(1)}%` : "—" },
    { label: "Hi CO", value: cs.highestCheckout > 0 ? cs.highestCheckout : "—", className: "text-emerald-400" },
    { label: "180s", value: cs.highest180s, className: "text-amber-400" },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <PageHeader
        title={player.name}
        actions={
          <Link
            href={`/players/${player.id}/edit`}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Edit
          </Link>
        }
      />

      {/* Identity card */}
      <div className="rounded-xl border border-border bg-card p-6 flex items-center gap-5">
        <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="xl" />
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">{player.name}</h2>
          {player.nickname && <p className="text-muted-foreground">"{player.nickname}"</p>}
          <Badge variant="outline">{player.hand === "LEFT" ? "Left-handed" : "Right-handed"}</Badge>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
          <TabsTrigger value="h2h" className="flex-1">Head to Head</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          {/* Stats grid */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-4">
              {statGrid.map(({ label, value, className }) => (
                <div key={label} className="flex flex-col items-center py-4 px-2 border-b border-r border-border/50 last:border-r-0 [&:nth-child(4)]:border-r-0 [&:nth-child(n+5)]:border-b-0">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={cn("font-score font-bold text-lg mt-0.5", className ?? "text-foreground")}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

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

          {/* Top checkouts */}
          {cs.top3Checkouts.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Top Checkouts</p>
              <div className="flex gap-2">
                {cs.top3Checkouts.map((c, i) => (
                  <span key={i} className="font-score font-bold text-lg text-emerald-400">{c}</span>
                ))}
              </div>
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
