"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { NavBar } from "./NavBar"
import { getSupabase } from "@/lib/supabase"

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const playerIdRef = useRef<string | null>(null)

  useEffect(() => {
    fetch("/api/auth/sync", { method: "POST" })
      .then((r) => r.json())
      .then((me) => {
        const playerId: string | null = me?.playerId ?? null
        if (!playerId) return

        playerIdRef.current = playerId
        const supabase = getSupabase()
        const channel = supabase.channel(`player:${playerId}`)

        channel.on("broadcast", { event: "MATCH_STARTED" }, ({ payload }) => {
          toast("Match started!", {
            description: `You vs ${payload.opponentName}`,
            action: {
              label: "Join",
              onClick: () => router.push(`/matches/${payload.matchId}/live`),
            },
          })
        })

        channel.subscribe()
      })
      .catch(() => {})

    return () => {
      if (playerIdRef.current) {
        getSupabase().channel(`player:${playerIdRef.current}`).unsubscribe()
      }
    }
  }, [router])

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#080808" }}>
      <NavBar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
