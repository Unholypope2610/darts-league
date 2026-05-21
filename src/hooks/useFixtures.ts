"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export function useFixtures(competitionId: string) {
  return useQuery({
    queryKey: ["fixtures", competitionId],
    queryFn: () => fetch(`/api/competitions/${competitionId}/fixtures`).then((r) => r.json()),
    enabled: !!competitionId,
  })
}

export function useGenerateFixtures(competitionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opts: { rounds: number }) =>
      fetch(`/api/competitions/${competitionId}/fixtures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      }).then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? "Failed to generate fixtures")
        return json
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixtures", competitionId] }),
  })
}

export function useStartFixture() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fixtureId, config }: {
      fixtureId: string
      config: { startingPlayerId: string; bestOf: number; startingScore: number; finishType: string }
    }) =>
      fetch(`/api/fixtures/${fixtureId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fixtures"] })
      qc.invalidateQueries({ queryKey: ["competitions"] })
    },
  })
}
