"use client"

import { useEffect, useRef, useState } from "react"
import { getSupabase } from "@/lib/supabase"

interface PresenceEntry { playerId: string; name: string }

export function usePlayerPresence(
  myPlayerId: string | null,
  myName: string | null,
  onJoin?: (playerId: string, name: string) => void,
): { onlinePlayerIds: Set<string> } {
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<Set<string>>(new Set())
  const onJoinRef = useRef(onJoin)
  const myPlayerIdRef = useRef(myPlayerId)

  useEffect(() => { onJoinRef.current = onJoin }, [onJoin])
  useEffect(() => { myPlayerIdRef.current = myPlayerId }, [myPlayerId])

  useEffect(() => {
    const supabase = getSupabase()
    const channel = supabase.channel("player-presence")

    const rebuild = () => {
      const state = channel.presenceState<PresenceEntry>()
      const entries = Object.values(state).flat()
      setOnlinePlayerIds(new Set(entries.map((e) => e.playerId)))
    }

    channel.on("presence", { event: "sync" }, rebuild)

    channel.on("presence", { event: "join" }, ({ newPresences }) => {
      rebuild()
      for (const presence of newPresences as unknown as PresenceEntry[]) {
        if (presence.playerId === myPlayerIdRef.current) continue
        onJoinRef.current?.(presence.playerId, presence.name)
      }
    })

    channel.on("presence", { event: "leave" }, rebuild)

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && myPlayerId) {
        await channel.track({ playerId: myPlayerId, name: myName ?? "" } as PresenceEntry)
      }
    })

    return () => { supabase.removeChannel(channel) }
  }, [myPlayerId, myName])

  return { onlinePlayerIds }
}
