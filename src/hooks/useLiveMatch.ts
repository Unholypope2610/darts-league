"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { getSupabase } from "@/lib/supabase"
import type { MatchWithLegs, RecordVisitResponse, VisitRecord } from "@/types/api"

export function useLiveMatch(matchId: string) {
  const hydrate = useLiveMatchStore((s) => s.hydrate)
  const reset = useLiveMatchStore((s) => s.reset)
  const applyRemoteVisit = useLiveMatchStore((s) => s.applyRemoteVisit)
  const applyRemoteLeg = useLiveMatchStore((s) => s.applyRemoteLeg)
  const applyRemoteEdit = useLiveMatchStore((s) => s.applyRemoteEdit)
  const applyDoublesConfirmed = useLiveMatchStore((s) => s.applyDoublesConfirmed)

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
      .on("broadcast", { event: "SCORE_EDITED" }, ({ payload }) => {
        applyRemoteEdit((payload as { updatedVisits: VisitRecord[] }).updatedVisits)
      })
      .on("broadcast", { event: "DOUBLES_CONFIRMED" }, ({ payload }) => {
        const p = payload as { visitId: string; doublesAttempted: number; dartsUsed: number | null }
        applyDoublesConfirmed(p.visitId, p.doublesAttempted, p.dartsUsed)
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          useLiveMatchStore.setState({
            _broadcast: (event, payload) =>
              channel.send({ type: "broadcast", event, payload }),
          })
        }
      })

    return () => {
      useLiveMatchStore.setState({ _broadcast: null })
      supabase.removeChannel(channel)
    }
  }, [matchId, applyRemoteVisit, applyRemoteLeg, applyRemoteEdit, applyDoublesConfirmed])

  useEffect(() => {
    return () => reset()
  }, [reset])

  return { isLoading, error }
}
