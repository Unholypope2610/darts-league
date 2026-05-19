"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLiveMatchStore } from "@/stores/live-match.store"
import type { MatchWithLegs } from "@/types/api"

export function useLiveMatch(matchId: string) {
  const hydrate = useLiveMatchStore((s) => s.hydrate)
  const reset = useLiveMatchStore((s) => s.reset)

  const { data, isLoading, error } = useQuery<MatchWithLegs>({
    queryKey: ["match", matchId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${matchId}`)
      if (!res.ok) throw new Error(`Failed to fetch match (${res.status})`)
      return res.json()
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (data) hydrate(data)
  }, [data, hydrate])

  useEffect(() => {
    return () => reset()
  }, [reset])

  return { isLoading, error }
}
