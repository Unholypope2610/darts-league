"use client"

import { useEffect, useCallback, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getSupabase } from "@/lib/supabase"
import { useBobs27Store } from "@/stores/bobs27.store"
import { useCricketStore } from "@/stores/cricket.store"
import { useHalfItStore } from "@/stores/halfit.store"
import type { PracticeSessionWithRounds } from "@/types/api"

export function usePracticeSession(sessionId: string) {
  const queryClient = useQueryClient()
  const gameModeRef = useRef<string | null>(null)

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

  // Hydrate the correct store when data loads — use getState() to avoid store subscriptions
  useEffect(() => {
    if (!data) return
    gameModeRef.current = data.gameMode
    if (data.gameMode === "BOBS_27") useBobs27Store.getState().hydrate(data)
    else if (data.gameMode === "CRICKET") useCricketStore.getState().hydrate(data)
    else if (data.gameMode === "HALF_IT") useHalfItStore.getState().hydrate(data)
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
      const gm = fresh.gameMode
      if (gm === "BOBS_27") useBobs27Store.getState().hydrate(fresh)
      else if (gm === "CRICKET") useCricketStore.getState().hydrate(fresh)
      else if (gm === "HALF_IT") useHalfItStore.getState().hydrate(fresh)
    } catch {
      // silent
    }
  }, [sessionId, queryClient])

  // Re-sync when returning from background
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") forceResync()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [forceResync])

  // Supabase realtime — use getState() and gameModeRef to avoid stale closures
  useEffect(() => {
    if (!data) return
    const supabase = getSupabase()
    const channel = supabase.channel(`practice:${sessionId}`)
    const wasDisconnected = { current: false }

    channel
      .on("broadcast", { event: "ROUND_SUBMITTED" }, ({ payload }) => {
        const gm = gameModeRef.current
        if (gm === "BOBS_27") useBobs27Store.getState().applyRemoteRound(payload)
        else if (gm === "CRICKET") useCricketStore.getState().applyRemoteTurn(payload)
        else if (gm === "HALF_IT") useHalfItStore.getState().applyRemoteRound(payload)
      })
      .on("broadcast", { event: "ROUND_UNDONE" }, ({ payload }) => {
        const gm = gameModeRef.current
        if (gm === "BOBS_27") useBobs27Store.getState().applyRemoteUndo(payload)
        else if (gm === "CRICKET") useCricketStore.getState().applyRemoteUndo(payload)
        else if (gm === "HALF_IT") useHalfItStore.getState().applyRemoteUndo(payload)
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          const fn = (event: string, payload: unknown) =>
            channel.send({ type: "broadcast", event, payload })
          const gm = gameModeRef.current
          if (gm === "BOBS_27") useBobs27Store.setState({ _broadcast: fn })
          else if (gm === "CRICKET") useCricketStore.setState({ _broadcast: fn })
          else if (gm === "HALF_IT") useHalfItStore.setState({ _broadcast: fn })
          if (wasDisconnected.current) {
            wasDisconnected.current = false
            forceResync()
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          wasDisconnected.current = true
        }
      })

    return () => {
      const gm = gameModeRef.current
      if (gm === "BOBS_27") useBobs27Store.setState({ _broadcast: null })
      else if (gm === "CRICKET") useCricketStore.setState({ _broadcast: null })
      else if (gm === "HALF_IT") useHalfItStore.setState({ _broadcast: null })
      supabase.removeChannel(channel)
    }
  }, [sessionId, data?.gameMode, forceResync])

  // Reset all stores on unmount
  useEffect(() => {
    return () => {
      useBobs27Store.getState().reset()
      useCricketStore.getState().reset()
      useHalfItStore.getState().reset()
    }
  }, [])

  return { data, isLoading, error, forceResync }
}
