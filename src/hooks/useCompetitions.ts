"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Competition } from "@/types/api"

export function useCompetitions() {
  return useQuery<Competition[]>({
    queryKey: ["competitions"],
    queryFn: () => fetch("/api/competitions").then((r) => r.json()),
  })
}

export function useCompetition(competitionId: string) {
  return useQuery<Competition>({
    queryKey: ["competitions", competitionId],
    queryFn: () => fetch(`/api/competitions/${competitionId}`).then((r) => r.json()),
    enabled: !!competitionId,
  })
}

export function useCreateCompetition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Competition> & { playerIds?: string[]; divisions?: { name: string; tier: number; playerIds: string[] }[] }) =>
      fetch("/api/competitions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitions"] }),
  })
}

export function useUpdateCompetition(competitionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Competition>) =>
      fetch(`/api/competitions/${competitionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitions"] }),
  })
}
