"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export function useBracket(competitionId: string) {
  return useQuery({
    queryKey: ["bracket", competitionId],
    queryFn: () =>
      fetch(`/api/competitions/${competitionId}/bracket`).then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json?.error ?? "Failed to load bracket")
        return json
      }),
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
      }).then(async (r) => {
        let json: unknown
        try { json = await r.json() } catch { json = null }
        if (!r.ok) {
          const msg = json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>).error === "string"
            ? (json as Record<string, string>).error
            : "Failed to generate bracket"
          throw new Error(msg)
        }
        return json
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bracket", competitionId] }),
  })
}
