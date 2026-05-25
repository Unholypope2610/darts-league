"use client"

import { createContext, useContext } from "react"

interface PlayerPresenceContextValue {
  onlinePlayerIds: Set<string>
  myPlayerId: string | null
}

export const PlayerPresenceContext = createContext<PlayerPresenceContextValue>({
  onlinePlayerIds: new Set(),
  myPlayerId: null,
})

export function usePresence() {
  return useContext(PlayerPresenceContext)
}
