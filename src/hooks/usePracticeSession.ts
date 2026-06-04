"use client"

import { useEffect, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getSupabase } from "@/lib/supabase"
import { useBobs27Store } from "@/stores/bobs27.store"
import { useCricketStore } from "@/stores/cricket.store"
import { useHalfItStore } from "@/stores/halfit.store"
import type { PracticeSessionWithRounds } from "@/types/api"

export function usePracticeSession(sessionId: string) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<PracticeSessionWithRounds>({
    queryKey: ["practice", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/practice/${sessionId}`)
      if (!res.ok) throw new Error(`Failed to fetch session (${res.status})`)
      return res.json()
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const bobs27 = useBobs27Store()
  const cricket = useCricketStore()
  const halfit = useHalfItStore()

  useEffect(() => {
    if (!data) return
    if (data.gameMode === "BOBS_27") bobs27.hydrate(data)
    else if (data.gameMode === "CRICKET") cricket.hydrate(data)
    else if (data.gameMode === "HALF_IT") halfit.hydrate(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const forceResync = useCallback(async () => {
    try {
      const fresh = await queryClient.fetchQuery<PracticeSessionWithRounds>({
        queryKey: ["practice", sessionId],
        queryFn: async () => {
          const res = await fetch(`/api/practice/${sessionId}`)
          if (!res.ok) throw new Error("Failed to fetch")
          return res.json()
        },
        staleTime: 0,
      })
      if (fresh.gameMode === "BOBS_27") bobs27.hydrate(fresh)
      else if (fresh.gameMode === "CRICKET") cricket.hydrate(fresh)
      else if (fresh.gameMode === "HALF_IT") halfit.hydrate(fresh)
    } catch {
      // silent
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, queryClient])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") forceResync()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [forceResync])

  // Supabase realtime
  useEffect(() => {
    if (!data) return
    const supabase = getSupabase()
    const channel = supabase.channel(`practice:${sessionId}`)
    const wasDisconnected = { current: false }

    const injectBroadcast = (fn: (event: string, payload: unknown) => void) => {
      if (data.gameMode === "BOBS_27") useBobs27Store.setState({ _broadcast: fn })
      else if (data.gameMode === "CRICKET") useCricketStore.setState({ _broadcast: fn })
      else if (data.gameMode === "HALF_IT") useHalfItStore.setState({ _broadcast: fn })
    }

    channel
      .on("broadcast", { event: "ROUND_SUBMITTED" }, ({ payload }) => {
        if (data.gameMode === "BOBS_27") bobs27.applyRemoteRound(payload)
        else if (data.gameMode === "CRICKET") cricket.applyRemoteTurn(payload)
        else if (data.gameMode === "HALF_IT") halfit.applyRemoteRound(payload)
      })
      .on("broadcast", { event: "ROUND_UNDONE" }, ({ payload }) => {
        if (data.gameMode === "BOBS_27") bobs27.applyRemoteUndo(payload)
        else if (data.gameMode === "CRICKET") cricket.applyRemoteUndo(payload)
        else if (data.gameMode === "HALF_IT") halfit.applyRemoteUndo(payload)
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          injectBroadcast((event, payload) =>
            channel.send({ type: "broadcast", event, payload })
          )
          if (wasDisconnected.current) {
            wasDisconnected.current = false
            forceResync()
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          wasDisconnected.current = true
        }
      })

    return () => {
      if (data.gameMode === "BOBS_27") useBobs27Store.setState({ _broadcast: null })
      else if (data.gameMode === "CRICKET") useCricketStore.setState({ _broadcast: null })
      else if (data.gameMode === "HALF_IT") useHalfItStore.setState({ _broadcast: null })
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, data?.gameMode])

  // Reset stores on unmount
  useEffect(() => {
    return () => {
      bobs27.reset()
      cricket.reset()
      halfit.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { data, isLoading, error, forceResync }
}
