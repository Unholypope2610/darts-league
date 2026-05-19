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
  const { data: rows, isLoading } = useLeagueTable(competitionId)

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold">Standings</h2>
      <LeagueTable rows={rows ?? []} topQualifyCount={4} />
    </div>
  )
}
