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
    queryFn: () => fetch(`/api/matches/${matchId}`).then((r) => r.json()),
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
