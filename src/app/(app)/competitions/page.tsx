"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useCompetitions } from "@/hooks/useCompetitions"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Trophy, X } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { Competition } from "@/types/api"

const TYPE_LABELS: Record<string, string> = {
  SINGLE_LEAGUE: "League",
  DIVISIONS: "Divisions",
  KNOCKOUT: "Knockout",
}

const FILTER_KEY = "competitionParticipantFilter"

function getParticipants(competitions: Competition[]) {
  const map = new Map<string, string>()
  for (const comp of competitions) {
    for (const div of comp.divisions ?? []) {
      for (const dp of div.players) {
        if (dp.player) map.set(dp.player.id, dp.player.name)
      }
    }
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function filterByParticipants(comps: Competition[], selectedIds: string[]) {
  if (selectedIds.length === 0) return comps
  return comps.filter((comp) => {
    const ids = new Set(comp.divisions?.flatMap((d) => d.players.map((p) => p.playerId)) ?? [])
    return selectedIds.some((id) => ids.has(id))
  })
}

function CompRow({ comp }: { comp: Competition }) {
  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-all"
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{comp.name}</p>
        <p className="text-sm text-muted-foreground">{comp.season}</p>
      </div>
      <Badge variant="outline" className="shrink-0">{TYPE_LABELS[comp.type] ?? comp.type}</Badge>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
        comp.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" :
        comp.status === "DRAFT" ? "bg-amber-500/10 text-amber-400" :
        "bg-muted text-muted-foreground"
      }`}>{comp.status}</span>
    </Link>
  )
}

export default function CompetitionsPage() {
  const { data: competitions, isLoading } = useCompetitions()

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      return JSON.parse(localStorage.getItem(FILTER_KEY) ?? "[]")
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(selectedIds))
  }, [selectedIds])

  const participants = getParticipants(competitions ?? [])
  const filtered = filterByParticipants(competitions ?? [], selectedIds)

  function toggle(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const byStatus = {
    all: filtered,
    ACTIVE: filtered.filter((c) => c.status === "ACTIVE"),
    DRAFT: filtered.filter((c) => c.status === "DRAFT"),
    COMPLETED: filtered.filter((c) => c.status === "COMPLETED"),
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Competitions"
        actions={
          <Link href="/competitions/new" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            + New
          </Link>
        }
      />

      {/* Participant filter */}
      {participants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
          {participants.map((p) => {
            const active = selectedIds.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                )}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <Tabs defaultValue="ACTIVE">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All ({byStatus.all.length})</TabsTrigger>
            <TabsTrigger value="ACTIVE">Active ({byStatus.ACTIVE.length})</TabsTrigger>
            <TabsTrigger value="DRAFT">Draft ({byStatus.DRAFT.length})</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed ({byStatus.COMPLETED.length})</TabsTrigger>
          </TabsList>
          {(["all", "ACTIVE", "DRAFT", "COMPLETED"] as const).map((tab) => (
            <TabsContent key={tab} value={tab}>
              {byStatus[tab].length > 0 ? (
                <div className="flex flex-col gap-3">
                  {byStatus[tab].map((c) => <CompRow key={c.id} comp={c} />)}
                </div>
              ) : (
                <EmptyState
                  icon={<Trophy className="w-10 h-10" />}
                  title={selectedIds.length > 0 ? "No competitions match this filter" : "No competitions"}
                  action={
                    selectedIds.length > 0
                      ? <button onClick={() => setSelectedIds([])} className="px-4 py-2 rounded-lg bg-muted border border-border text-sm font-medium">Clear filter</button>
                      : <Link href="/competitions/new" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Create one</Link>
                  }
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
