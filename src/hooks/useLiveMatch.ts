"use client"

import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
  const queryClient = useQueryClient()

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
    // Track whether the channel has dropped so we know a reconnect means missed broadcasts
    const wasDisconnected = { current: false }

    channel
      .on("broadcast", { event: "VISIT_RECORDED" }, ({ payload }) => {
        applyRemoteVisit(payload as RecordVisitResponse)
      })
      .on("broadcast", { event: "LEG_STARTED" }, ({ payload }) => {
        applyRemoteLeg(
          payload.legId as string,
          payload.starterId as string,
          payload.playerALegsWon as number | undefined,
          payload.playerBLegsWon as number | undefined,
        )
      })
      .on("broadcast", { event: "SCORE_EDITED" }, ({ payload }) => {
        const p = payload as { updatedVisits: VisitRecord[]; legWinnerId?: string | null; matchWinnerId?: string | null; isMatchDraw?: boolean }
        applyRemoteEdit(p.updatedVisits, p.legWinnerId, p.matchWinnerId, p.isMatchDraw)
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
          // Reconnect after a drop — refetch from DB to catch up on any missed broadcasts
          if (wasDisconnected.current) {
            wasDisconnected.current = false
            queryClient.invalidateQueries({ queryKey: ["match", matchId] })
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          wasDisconnected.current = true
        }
      })

    return () => {
      useLiveMatchStore.setState({ _broadcast: null })
      supabase.removeChannel(channel)
    }
  }, [matchId, applyRemoteVisit, applyRemoteLeg, applyRemoteEdit, applyDoublesConfirmed, queryClient])

  useEffect(() => {
    return () => reset()
  }, [reset])

  return { isLoading, error }
}
