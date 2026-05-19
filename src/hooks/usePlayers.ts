"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Player } from "@prisma/client"

export function usePlayers() {
  return useQuery<Player[]>({
    queryKey: ["players"],
    queryFn: () => fetch("/api/players").then((r) => r.json()),
  })
}

export function usePlayer(playerId: string) {
  return useQuery<Player>({
    queryKey: ["players", playerId],
    queryFn: () => fetch(`/api/players/${playerId}`).then((r) => r.json()),
    enabled: !!playerId,
  })
}

export function useCreatePlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Player>) =>
      fetch("/api/players", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  })
}

export function useUpdatePlayer(playerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Player>) =>
      fetch(`/api/players/${playerId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  })
}

export function useDeletePlayer(playerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => fetch(`/api/players/${playerId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  })
}
