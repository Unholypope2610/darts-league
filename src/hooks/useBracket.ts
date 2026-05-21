"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export function useBracket(competitionId: string) {
  return useQuery({
    queryKey: ["bracket", competitionId],
    queryFn: () => fetch(`/api/competitions/${competitionId}/bracket`).then((r) => r.json()),
    enabled: !!competitionId,
  })
}

export function useGenerateBracket(competitionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opts: { topN: 2 | 4 | 8 }) =>
      fetch(`/api/competitions/${competitionId}/bracket/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bracket", competitionId] }),
  })
}
