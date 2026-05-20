"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, ChevronUp } from "lucide-react"
import { NavBar } from "./NavBar"
import { getSupabase } from "@/lib/supabase"
import { cn } from "@/lib/utils/cn"

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const playerIdRef = useRef<string | null>(null)
  const isLivePage = pathname.includes("/live")
  const [navVisible, setNavVisible] = useState(false)

  // Reset nav visibility when navigating away from live page
  useEffect(() => {
    if (!isLivePage) setNavVisible(false)
  }, [isLivePage])

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
      {isLivePage ? (
        <>
          {/* Small pull-tab to reveal nav while in a live match */}
          <div className="flex justify-center pt-1 pb-0">
            <button
              onClick={() => setNavVisible((v) => !v)}
              className="px-4 py-0.5 rounded-b-lg bg-muted/50 text-muted-foreground text-[10px] flex items-center gap-1 hover:bg-muted/80 transition-colors"
            >
              {navVisible ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {navVisible ? "Hide menu" : "Menu"}
            </button>
          </div>
          {navVisible && <NavBar />}
        </>
      ) : (
        <NavBar />
      )}
      <main className={cn("flex-1 w-full max-w-7xl mx-auto px-4 md:px-8", isLivePage ? "py-1" : "py-6")}>
        {children}
      </main>
    </div>
  )
}
