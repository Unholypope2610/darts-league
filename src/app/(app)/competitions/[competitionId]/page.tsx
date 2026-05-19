"use client"

import { use } from "react"
import Link from "next/link"
import { useCompetition } from "@/hooks/useCompetitions"
import { useFixtures } from "@/hooks/useFixtures"
import { useLeagueTable } from "@/hooks/useLeagueTable"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { LeagueTable } from "@/components/table/LeagueTable"

interface PageProps {
  params: Promise<{ competitionId: string }>
}

export default function CompetitionOverviewPage({ params }: PageProps) {
  const { competitionId } = use(params)
  const { data: competition, isLoading: compLoading } = useCompetition(competitionId)
  const { data: fixtures } = useFixtures(competitionId)
  const { data: tableRows } = useLeagueTable(competitionId)

  const scheduled = fixtures?.filter((f: { status: string }) => f.status === "SCHEDULED").length ?? 0
  const completed = fixtures?.filter((f: { status: string }) => f.status === "COMPLETED").length ?? 0
  const total = fixtures?.length ?? 0

  if (compLoading) return <Skeleton className="h-64 rounded-xl" />
  if (!competition) return <p className="text-muted-foreground">Competition not found.</p>

  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Fixtures", value: total },
          { label: "Played", value: completed },
          { label: "Remaining", value: scheduled },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <div className="font-score text-3xl font-black">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Format details */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-3">
        {[
          { label: "Score", value: competition.startingScore },
          { label: "Format", value: `Best of ${competition.bestOf}` },
          { label: "Finish", value: competition.finishType.replace(/_/g, " ") },
          { label: "Type", value: competition.type.replace(/_/g, " ") },
        ].map((item) => (
          <Badge key={item.label} variant="outline" className="px-3 py-1 text-sm">
            <span className="text-muted-foreground mr-1">{item.label}:</span> {item.value}
          </Badge>
        ))}
      </div>

      {/* Quick actions */}
      {competition.status === "DRAFT" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-400">This competition is in draft. Generate fixtures to activate it.</p>
          <Link
            href={`/competitions/${competitionId}/fixtures`}
            className="px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-bold hover:bg-amber-400 transition-colors shrink-0"
          >
            Generate Fixtures
          </Link>
        </div>
      )}

      {/* Standings preview */}
      {tableRows && tableRows.length > 0 && tableRows[0].rows.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Standings</h3>
          <LeagueTable rows={tableRows[0].rows.slice(0, 6)} />
          <Link href={`/competitions/${competitionId}/table`} className="block text-center mt-3 text-sm text-primary hover:underline">
            View full table →
          </Link>
        </div>
      )}
    </div>
  )
}
