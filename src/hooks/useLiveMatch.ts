"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { getSupabase } from "@/lib/supabase"
import type { MatchWithLegs, RecordVisitResponse } from "@/types/api"

export function useLiveMatch(matchId: string) {
  const hydrate = useLiveMatchStore((s) => s.hydrate)
  const reset = useLiveMatchStore((s) => s.reset)
  const applyRemoteVisit = useLiveMatchStore((s) => s.applyRemoteVisit)
  const applyRemoteLeg = useLiveMatchStore((s) => s.applyRemoteLeg)

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
    const supabase = getSupabase()
    const channel = supabase.channel(`match:${matchId}`)

    channel
      .on("broadcast", { event: "VISIT_RECORDED" }, ({ payload }) => {
        applyRemoteVisit(payload as RecordVisitResponse)
      })
      .on("broadcast", { event: "LEG_STARTED" }, ({ payload }) => {
        applyRemoteLeg(payload.legId as string, payload.starterId as string)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [matchId, applyRemoteVisit, applyRemoteLeg])

  useEffect(() => {
    return () => reset()
  }, [reset])

  return { isLoading, error }
}
