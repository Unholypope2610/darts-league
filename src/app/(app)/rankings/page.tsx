"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Trophy, ChevronDown, ChevronUp } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils/cn"
import type { RankingEntry, ChampionEntry } from "@/types/api"

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
                <span className="font-score font-black text-lg w-12 text-right">{entry.points}</span>
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
            {entry.current?.isRanked && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30 shrink-0">
                Ranked
              </span>
            )}
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

export default function RankingsPage() {
  const [tab, setTab] = useState<"standings" | "champions">("standings")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rankings"
        description="Rolling 12-month standings · Ranking events only"
      />

      {/* Tab toggle */}
      <div className="flex rounded-xl overflow-hidden border border-border w-fit">
        {(["standings", "champions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-5 py-2 text-sm font-semibold transition-colors capitalize",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "standings" ? "Standings" : "Wall of Champions"}
          </button>
        ))}
      </div>

      {tab === "standings" ? <StandingsTab /> : <ChampionsTab />}
    </div>
  )
}
