"use client"

import Link from "next/link"
import { useCompetitions } from "@/hooks/useCompetitions"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, Zap, Clock } from "lucide-react"
import type { Competition } from "@prisma/client"

const TYPE_LABELS: Record<string, string> = {
  SINGLE_LEAGUE: "League",
  DIVISIONS: "Divisions",
  KNOCKOUT: "Knockout",
}

function CompetitionCard({ comp }: { comp: Competition }) {
  const statusColor =
    comp.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
    comp.status === "DRAFT" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
    "bg-muted text-muted-foreground border-border"

  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="block rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:bg-card/80 transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-base group-hover:text-primary transition-colors">{comp.name}</h3>
          <p className="text-sm text-muted-foreground">{comp.season}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColor}`}>
          {comp.status}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">{TYPE_LABELS[comp.type] ?? comp.type}</Badge>
        <span>Best of {comp.bestOf}</span>
        <span>•</span>
        <span>{comp.startingScore}</span>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const { data: competitions, isLoading } = useCompetitions()

  const active = competitions?.filter((c) => c.status === "ACTIVE") ?? []
  const draft = competitions?.filter((c) => c.status === "DRAFT") ?? []
  const completed = competitions?.filter((c) => c.status === "COMPLETED") ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Dashboard" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="All competitions at a glance"
        actions={
          <Link
            href="/competitions/new"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + New Competition
          </Link>
        }
      />

      {/* Active */}
      {active.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-sm">Active ({active.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((c) => <CompetitionCard key={c.id} comp={c} />)}
          </div>
        </section>
      )}

      {/* Draft */}
      {draft.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-sm">Draft ({draft.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {draft.map((c) => <CompetitionCard key={c.id} comp={c} />)}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-muted-foreground">Completed ({completed.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {completed.map((c) => <CompetitionCard key={c.id} comp={c} />)}
          </div>
        </section>
      )}

      {!competitions?.length && (
        <EmptyState
          icon={<Trophy className="w-12 h-12" />}
          title="No competitions yet"
          description="Create your first competition to get started"
          action={
            <Link href="/competitions/new" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              Create Competition
            </Link>
          }
        />
      )}
    </div>
  )
}
