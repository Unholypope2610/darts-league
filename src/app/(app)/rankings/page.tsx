"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Trophy, ChevronDown, ChevronUp, RotateCcw } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils/cn"
import { usePlayers } from "@/hooks/usePlayers"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatAverage } from "@/lib/utils/format"
import type { RankingEntry, ChampionEntry } from "@/types/api"

interface RecordData {
  highestCheckout: { player: { name: string; avatarUrl?: string | null }; score: number; competition?: { name: string } | null } | null
  bestLeg: { player: { name: string; avatarUrl?: string | null }; darts: number; competition?: { name: string } | null } | null
  most180s: { player: { name: string; avatarUrl?: string | null }; count: number }[]
  highestAverage: { player: { name: string; avatarUrl?: string | null }; average: number; competition?: { name: string } | null } | null
  bestFirst9: { player: { name: string; avatarUrl?: string | null }; average: number; competition?: { name: string } | null } | null
  topAverages: { player: { name: string; avatarUrl?: string | null }; average: number }[]
  mostTitles: { player: { name: string; avatarUrl?: string | null }; count: number; competitionsWon: { id: string; name: string; season: string; type: string }[] }[]
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

function StandingsTab() {
  const { data, isLoading } = useQuery<RankingEntry[]>({
    queryKey: ["rankings"],
    queryFn: () => fetch("/api/rankings").then((r) => r.json()),
  })
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        No ranking events completed yet. Complete a ranked tournament to see standings.
      </div>
    )
  }

  const maxPts = data[0]?.points ?? 1

  return (
    <div className="flex flex-col gap-2">
      {data.map((entry, i) => {
        const isOpen = expanded === entry.playerId
        const isFirst = i === 0
        return (
          <div
            key={entry.playerId}
            className={cn(
              "rounded-xl border bg-card overflow-hidden transition-all",
              isFirst ? "border-amber-500/40" : "border-border",
            )}
          >
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : entry.playerId)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              {/* Position */}
              <span className={cn(
                "w-7 text-center font-black text-sm shrink-0",
                i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-700" : "text-muted-foreground",
              )}>
                {i + 1}
              </span>

              <PlayerAvatar name={entry.name} avatarUrl={entry.avatarUrl} size="md" />

              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{entry.name}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.eventsEntered} event{entry.eventsEntered !== 1 ? "s" : ""}
                  {entry.rankedTitles > 0 && (
                    <span className="ml-2 text-violet-400 font-bold">
                      <Trophy className="inline w-3 h-3 mr-0.5" />{entry.rankedTitles}
                    </span>
                  )}
                </p>
              </div>

              {/* Points bar + total */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:block w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-2 rounded-full", isFirst ? "bg-amber-400" : "bg-primary")}
                    style={{ width: `${(entry.points / maxPts) * 100}%` }}
                  />
                </div>
                <span className={cn("font-score font-black text-xl w-16 text-right", isFirst ? "text-amber-400" : "text-primary")}>
                  {entry.points}
                </span>
                <span className="text-xs text-muted-foreground -ml-2">pts</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Breakdown */}
            {isOpen && (
              <div className="border-t border-border bg-muted/20 flex flex-col gap-0">
                {entry.breakdown.map((b) => {
                  const expiry = new Date(b.expiresAt)
                  const now = new Date()
                  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <div key={b.competitionId} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.competitionName}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.season} · {b.placementLabel} · {b.entrantCount} players
                        </p>
                        <p className="text-xs text-muted-foreground/60">
                          Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="font-score font-bold text-base text-primary">{b.points} pts</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground text-center pt-2">Rolling 12-month standings · Points expire as tournaments age out</p>
    </div>
  )
}

function ChampionsTab() {
  const { data, isLoading } = useQuery<ChampionEntry[]>({
    queryKey: ["champions"],
    queryFn: () => fetch("/api/champions").then((r) => r.json()),
  })
  const [openPast, setOpenPast] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        No completed competitions yet.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {data.map((entry) => (
        <div key={entry.competitionName} className="rounded-xl border border-border bg-card flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 flex items-center justify-between gap-2">
            <p className="font-semibold text-sm truncate">{entry.competitionName}</p>
            <div className="flex items-center gap-2 shrink-0">
              {entry.current?.isRanked && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
                  Ranked
                </span>
              )}
              {entry.current && (
                <Link
                  href={`/competitions/${entry.current.competitionId}/settings`}
                  className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors border border-border rounded-full px-2 py-0.5"
                >
                  <RotateCcw className="size-2.5" />
                  Run Again
                </Link>
              )}
            </div>
          </div>

          {/* Current champion */}
          {entry.current ? (
            <div className="px-4 pb-4 flex items-center gap-3">
              <div className="relative">
                <PlayerAvatar name={entry.current.winner.name} avatarUrl={entry.current.winner.avatarUrl} size="lg" />
                <span className="absolute -top-1 -right-1 text-base leading-none">🏆</span>
              </div>
              <div>
                <p className="font-bold">{entry.current.winner.name}</p>
                <p className="text-xs text-muted-foreground">{entry.current.season}</p>
                {entry.current.entrantCount && (
                  <p className="text-xs text-muted-foreground">{entry.current.entrantCount} players</p>
                )}
              </div>
            </div>
          ) : (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No current champion</p>
          )}

          {/* Past winners toggle */}
          {entry.past.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setOpenPast(openPast === entry.competitionName ? null : entry.competitionName)}
                className="flex items-center justify-between px-4 py-2.5 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Past winners ({entry.past.length})</span>
                {openPast === entry.competitionName ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {openPast === entry.competitionName && (
                <div className="flex flex-col">
                  {entry.past.map((p) => (
                    <div key={p.competitionId} className="flex items-center gap-2 px-4 py-2.5 border-t border-border/50">
                      <PlayerAvatar name={p.winner.name} avatarUrl={p.winner.avatarUrl} size="sm" />
                      <span className="text-sm font-medium flex-1">{p.winner.name}</span>
                      <span className="text-xs text-muted-foreground">{p.season}</span>
                      {p.isRanked && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">R</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function HallOfFameTab() {
  const { data, isLoading } = useQuery<RecordData>({
    queryKey: ["records", "ranked"],
    queryFn: () => fetch("/api/records?ranked=true").then((r) => r.json()),
  })
  const { data: players } = usePlayers()
  const winRateLeader = useMemo(() => {
    if (!players) return null
    return players
      .map((p) => {
        const played = p.won + p.lost + p.drawn
        return { ...p, played, winPct: played > 0 ? (p.won / played) * 100 : 0 }
      })
      .filter((p) => p.played >= 30)
      .sort((a, b) => b.winPct - a.winPct)[0] ?? null
  }, [players])
  const [titlesModal, setTitlesModal] = useState<{ name: string; competitions: { id: string; name: string; season: string; type: string }[] } | null>(null)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    )
  }

  if (!data?.highestCheckout && !data?.highestAverage && !data?.bestLeg) {
    return <div className="text-center py-16 text-muted-foreground text-sm">No ranked records yet. Complete a ranked tournament to populate this tab.</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RecordCard title="Best Win Rate">
          {winRateLeader ? (
            <PlayerRow name={winRateLeader.name} avatarUrl={winRateLeader.avatarUrl} stat={`${winRateLeader.winPct.toFixed(1)}%`} label={`${winRateLeader.won}W from ${winRateLeader.played} games`} />
          ) : (
            <p className="text-sm text-muted-foreground">No player has 30+ games yet</p>
          )}
        </RecordCard>

        {data?.highestCheckout && (
          <RecordCard title="Highest Checkout">
            <PlayerRow name={data.highestCheckout.player.name} avatarUrl={data.highestCheckout.player.avatarUrl} stat={String(data.highestCheckout.score)} label={data.highestCheckout.competition?.name} />
          </RecordCard>
        )}
        {data?.highestAverage && (
          <RecordCard title="Highest Match Average">
            <PlayerRow name={data.highestAverage.player.name} avatarUrl={data.highestAverage.player.avatarUrl} stat={formatAverage(data.highestAverage.average)} label={data.highestAverage.competition?.name} />
          </RecordCard>
        )}
        {data?.bestFirst9 && (
          <RecordCard title="Best First 9 Average">
            <PlayerRow name={data.bestFirst9.player.name} avatarUrl={data.bestFirst9.player.avatarUrl} stat={formatAverage(data.bestFirst9.average)} label={data.bestFirst9.competition?.name} />
          </RecordCard>
        )}
        {data?.bestLeg && (
          <RecordCard title="Best Leg (Fewest Darts)">
            <PlayerRow name={data.bestLeg.player.name} avatarUrl={data.bestLeg.player.avatarUrl} stat={`${data.bestLeg.darts}d`} label={data.bestLeg.competition?.name} />
          </RecordCard>
        )}
        {data?.most180s && data.most180s.length > 0 && (
          <RecordCard title="Most 180s (Ranked Events)">
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
        {data?.mostTitles && data.mostTitles.length > 0 && (
          <RecordCard title="Most Ranked Titles">
            <div className="flex flex-col gap-2">
              {data.mostTitles.map((entry, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                  <PlayerAvatar name={entry.player.name} avatarUrl={entry.player.avatarUrl} size="sm" />
                  <span className="flex-1 text-sm font-medium">{entry.player.name}</span>
                  <button
                    onClick={() => setTitlesModal({ name: entry.player.name, competitions: entry.competitionsWon })}
                    className="flex items-center gap-1 font-score font-bold text-lg text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <Trophy className="size-4" />
                    {entry.count}
                  </button>
                </div>
              ))}
            </div>
          </RecordCard>
        )}
      </div>

      {data?.topAverages && data.topAverages.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Top Career Averages (Ranked)</h3>
          <div className="flex flex-col gap-2">
            {data.topAverages.map((entry, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                <PlayerAvatar name={entry.player.name} avatarUrl={entry.player.avatarUrl} size="sm" />
                <span className="flex-1 text-sm font-medium">{entry.player.name}</span>
                <div className="h-2 bg-primary/20 rounded-full flex-1 max-w-32">
                  <div className="h-2 bg-primary rounded-full" style={{ width: `${Math.min(100, (entry.average / 120) * 100)}%` }} />
                </div>
                <span className="font-score font-bold text-base w-14 text-right">{formatAverage(entry.average)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!titlesModal} onOpenChange={(open) => { if (!open) setTitlesModal(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-violet-400" />
              {titlesModal?.name} — Ranked Titles
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            {titlesModal?.competitions.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.season}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">{c.type}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function RankingsPage() {
  const [tab, setTab] = useState<"standings" | "champions" | "halloffame">("standings")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rankings"
        description="Rolling 12-month standings · Ranking events only"
      />

      {/* Tab toggle */}
      <div className="flex rounded-xl overflow-hidden border border-border w-fit">
        {(["standings", "champions", "halloffame"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-5 py-2 text-sm font-semibold transition-colors",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "standings" ? "Standings" : t === "champions" ? "Wall of Champions" : "Hall of Fame"}
          </button>
        ))}
      </div>

      {tab === "standings" ? <StandingsTab /> : tab === "champions" ? <ChampionsTab /> : <HallOfFameTab />}
    </div>
  )
}
