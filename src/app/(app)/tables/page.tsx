"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useLeagueTable } from "@/hooks/useLeagueTable"
import { LeagueTable } from "@/components/table/LeagueTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart2 } from "lucide-react"
import type { Competition } from "@/types/api"

function CompetitionTable({ competition }: { competition: Competition }) {
  const { data: divisions, isLoading } = useLeagueTable(competition.id)

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">{competition.name}</h2>
          <p className="text-xs text-muted-foreground">{competition.season}</p>
        </div>
        <Link
          href={`/competitions/${competition.id}/table`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Full table →
        </Link>
      </div>
      {divisions?.map((division) => (
        <div key={division.divisionId} className="flex flex-col gap-2">
          {(divisions.length > 1) && (
            <p className="text-sm font-medium text-muted-foreground">{division.divisionName}</p>
          )}
          <LeagueTable rows={division.rows} topQualifyCount={4} />
        </div>
      ))}
      {!divisions?.length && (
        <p className="text-sm text-muted-foreground">No standings yet</p>
      )}
    </div>
  )
}

export default function TablesPage() {
  const { data: competitions, isLoading } = useQuery<Competition[]>({
    queryKey: ["competitions"],
    queryFn: () => fetch("/api/competitions").then((r) => r.json()),
  })

  const active = competitions?.filter((c) => c.status === "ACTIVE") ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Tables" description="League standings across all active competitions" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Tables" description="League standings across all active competitions" />
      {active.length === 0 ? (
        <EmptyState
          icon={<BarChart2 className="w-10 h-10" />}
          title="No active competitions"
          description="Activate a competition to see league standings here"
          action={<Link href="/competitions" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Go to Competitions</Link>}
        />
      ) : (
        active.map((comp) => (
          <CompetitionTable key={comp.id} competition={comp} />
        ))
      )}
    </div>
  )
}
