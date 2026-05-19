"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAverage } from "@/lib/utils/format"

interface RecordData {
  highestCheckout: { player: { name: string; avatarUrl?: string | null }; score: number; competition?: { name: string } | null } | null
  bestLeg: { player: { name: string; avatarUrl?: string | null }; darts: number; competition?: { name: string } | null } | null
  most180s: { player: { name: string; avatarUrl?: string | null }; count: number }[]
  highestAverage: { player: { name: string; avatarUrl?: string | null }; average: number; competition?: { name: string } | null } | null
  topAverages: { player: { name: string; avatarUrl?: string | null }; average: number }[]
}

function RecordCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

function PlayerRow({ name, avatarUrl, stat, label }: { name: string; avatarUrl?: string | null; stat: string; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <PlayerAvatar name={name} avatarUrl={avatarUrl} size="md" />
      <div className="flex-1">
        <p className="font-semibold">{name}</p>
        {label && <p className="text-xs text-muted-foreground">{label}</p>}
      </div>
      <span className="font-score text-2xl font-black text-primary">{stat}</span>
    </div>
  )
}

export default function RecordsPage() {
  const { data, isLoading } = useQuery<RecordData>({
    queryKey: ["records"],
    queryFn: () => fetch("/api/records").then((r) => r.json()),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Hall of Fame" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Hall of Fame"
        description="All-time records across every season"
        actions={
          <Link href="/history" className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">
            ← Season Archive
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data?.highestCheckout && (
          <RecordCard title="Highest Checkout">
            <PlayerRow
              name={data.highestCheckout.player.name}
              avatarUrl={data.highestCheckout.player.avatarUrl}
              stat={String(data.highestCheckout.score)}
              label={data.highestCheckout.competition?.name}
            />
          </RecordCard>
        )}

        {data?.highestAverage && (
          <RecordCard title="Highest Match Average">
            <PlayerRow
              name={data.highestAverage.player.name}
              avatarUrl={data.highestAverage.player.avatarUrl}
              stat={formatAverage(data.highestAverage.average)}
              label={data.highestAverage.competition?.name}
            />
          </RecordCard>
        )}

        {data?.bestLeg && (
          <RecordCard title="Best Leg (Fewest Darts)">
            <PlayerRow
              name={data.bestLeg.player.name}
              avatarUrl={data.bestLeg.player.avatarUrl}
              stat={`${data.bestLeg.darts}d`}
              label={data.bestLeg.competition?.name}
            />
          </RecordCard>
        )}

        {data?.most180s && data.most180s.length > 0 && (
          <RecordCard title="Most 180s (All Time)">
            <div className="flex flex-col gap-2">
              {data.most180s.slice(0, 5).map((entry, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                  <PlayerAvatar name={entry.player.name} avatarUrl={entry.player.avatarUrl} size="sm" />
                  <span className="flex-1 text-sm font-medium">{entry.player.name}</span>
                  <span className="font-score font-bold text-lg">{entry.count}</span>
                </div>
              ))}
            </div>
          </RecordCard>
        )}
      </div>

      {data?.topAverages && data.topAverages.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Top Career Averages</h3>
          <div className="flex flex-col gap-2">
            {data.topAverages.map((entry, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                <PlayerAvatar name={entry.player.name} avatarUrl={entry.player.avatarUrl} size="sm" />
                <span className="flex-1 text-sm font-medium">{entry.player.name}</span>
                <div className="h-2 bg-primary/20 rounded-full flex-1 max-w-32">
                  <div
                    className="h-2 bg-primary rounded-full"
                    style={{ width: `${Math.min(100, (entry.average / 120) * 100)}%` }}
                  />
                </div>
                <span className="font-score font-bold text-base w-14 text-right">{formatAverage(entry.average)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data?.highestCheckout && !data?.highestAverage && !data?.bestLeg && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No records yet. Start scoring matches to build up the hall of fame.
        </div>
      )}
    </div>
  )
}
