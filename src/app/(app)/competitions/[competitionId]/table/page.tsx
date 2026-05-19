"use client"

import { use } from "react"
import { useLeagueTable } from "@/hooks/useLeagueTable"
import { LeagueTable } from "@/components/table/LeagueTable"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  params: Promise<{ competitionId: string }>
}

export default function TablePage({ params }: PageProps) {
  const { competitionId } = use(params)
  const { data: divisions, isLoading } = useLeagueTable(competitionId)

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="flex flex-col gap-8">
      {divisions?.map((division) => (
        <div key={division.divisionId} className="flex flex-col gap-3">
          {divisions.length > 1 && (
            <h2 className="font-black text-lg text-white">{division.divisionName}</h2>
          )}
          <LeagueTable rows={division.rows} topQualifyCount={4} />
        </div>
      ))}
      {!divisions?.length && (
        <p className="text-muted-foreground text-sm">No standings yet — play some matches first.</p>
      )}
    </div>
  )
}
