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
    mutationFn: (opts: { doubleRoundRobin: boolean }) =>
      fetch(`/api/competitions/${competitionId}/fixtures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixtures", competitionId] }),
  })
}

export function useStartFixture() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fixtureId: string) =>
      fetch(`/api/fixtures/${fixtureId}/start`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fixtures"] })
      qc.invalidateQueries({ queryKey: ["competitions"] })
    },
  })
}
