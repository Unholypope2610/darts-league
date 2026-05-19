"use client"

import { useQuery } from "@tanstack/react-query"
import type { LeagueTableRow } from "@/types/table"

export function useLeagueTable(competitionId: string, divisionId?: string) {
  const url = divisionId
    ? `/api/competitions/${competitionId}/table?divisionId=${divisionId}`
    : `/api/competitions/${competitionId}/table`

  return useQuery<LeagueTableRow[]>({
    queryKey: ["table", competitionId, divisionId],
    queryFn: () => fetch(url).then((r) => r.json()),
    enabled: !!competitionId,
    refetchOnWindowFocus: true,
  })
}
