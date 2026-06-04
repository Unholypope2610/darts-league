"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, ChevronUp } from "lucide-react"
import { NavBar } from "./NavBar"
import { getSupabase } from "@/lib/supabase"
import { cn } from "@/lib/utils/cn"
import { usePushSubscription } from "@/hooks/usePushSubscription"
import { usePlayerPresence } from "@/hooks/usePlayerPresence"
import { PlayerPresenceContext } from "@/contexts/PlayerPresenceContext"
import { ChallengeModal } from "@/components/match/ChallengeModal"

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const playerIdRef = useRef<string | null>(null)
  const isLivePageRef = useRef(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [challengeTarget, setChallengeTarget] = useState<{ id: string; name: string; avatarUrl: string | null } | null>(null)
  const isLivePage = pathname.includes("/live")
  useEffect(() => { isLivePageRef.current = isLivePage }, [isLivePage])
  const [navVisible, setNavVisible] = useState(false)

  usePushSubscription(userId)

  const { onlinePlayerIds } = usePlayerPresence(playerId, playerName, (pid, name) => {
    if (pid === playerIdRef.current) return
    if (pathname.includes("/live")) return
    toast.custom(
      (toastId) => (
        <div
          style={{
            background: "linear-gradient(135deg, #064e3b, #065f46)",
            border: "1px solid #10b981",
            boxShadow: "0 0 32px rgba(16,185,129,0.4)",
            borderRadius: "16px",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            minWidth: "280px",
            maxWidth: "340px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            <span style={{ color: "#6ee7b7", fontWeight: 800, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Online Now
            </span>
          </div>
          <p style={{ color: "#ffffff", fontWeight: 700, fontSize: "16px", margin: 0 }}>
            {name} is online
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => { toast.dismiss(toastId); setChallengeTarget({ id: pid, name, avatarUrl: null }) }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "10px",
                background: "#10b981",
                color: "#000",
                fontWeight: 800,
                fontSize: "14px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Challenge 🎯
            </button>
            <button
              onClick={() => toast.dismiss(toastId)}
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.08)",
                color: "#a7f3d0",
                fontWeight: 600,
                fontSize: "13px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ),
      { duration: 10_000, id: `online-${pid}` },
    )
  })

  // Keep screen awake while the app is open
  useEffect(() => {
    if (!("wakeLock" in navigator)) return
    let lock: WakeLockSentinel | null = null
    const acquire = () => {
      navigator.wakeLock.request("screen").then((l) => { lock = l }).catch(() => {})
    }
    acquire()
    // Re-acquire after the tab becomes visible again (wake lock is released on hide)
    const onVisible = () => { if (document.visibilityState === "visible") acquire() }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      lock?.release().catch(() => {})
    }
  }, [])

  // Reset nav visibility when navigating away from live page
  useEffect(() => {
    if (!isLivePage) setNavVisible(false)
  }, [isLivePage])

  useEffect(() => {
    const supabase = getSupabase()
    const spectatorChannel = supabase.channel("match-spectators")

    spectatorChannel.on("broadcast", { event: "MATCH_LIVE" }, ({ payload }) => {
      const { matchId, playerAName, playerBName, playerAId, playerBId } = payload as {
        matchId: string; playerAName: string; playerBName: string; playerAId: string; playerBId: string
      }
      // Don't interrupt players who are already in a match
      if (isLivePageRef.current) return
      // Players get their own "Join Now" toast — skip this one for them
      if (playerIdRef.current === playerAId || playerIdRef.current === playerBId) return

      toast.custom(
        (id) => (
          <div
            style={{
              background: "linear-gradient(135deg, #1e1b4b, #312e81)",
              border: "1px solid #6366f1",
              boxShadow: "0 0 32px rgba(99,102,241,0.4)",
              borderRadius: "16px",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              minWidth: "280px",
              maxWidth: "340px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#6366f1", display: "inline-block", animation: "pulse 1.5s infinite" }} />
              <span style={{ color: "#a5b4fc", fontWeight: 800, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Match Live
              </span>
            </div>
            <p style={{ color: "#ffffff", fontWeight: 700, fontSize: "16px", margin: 0 }}>
              {playerAName} vs {playerBName}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => { toast.dismiss(id); router.push(`/matches/${matchId}/live`) }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  background: "#6366f1",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Watch Now →
              </button>
              <button
                onClick={() => toast.dismiss(id)}
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.08)",
                  color: "#a5b4fc",
                  fontWeight: 600,
                  fontSize: "13px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ),
        { duration: 30_000, id: `match-live-${matchId}` },
      )
    })

    spectatorChannel.subscribe()

    return () => { supabase.removeChannel(spectatorChannel) }
  }, [router])

  useEffect(() => {
    fetch("/api/auth/sync", { method: "POST" })
      .then((r) => r.json())
      .then((me) => {
        if (me?.id) setUserId(me.id)
        const pid: string | null = me?.playerId ?? null
        const pname: string | null = me?.playerName ?? null
        setPlayerId(pid)
        setPlayerName(pname)
        if (!pid) return

        playerIdRef.current = pid
        const supabase = getSupabase()
        const channel = supabase.channel(`player:${pid}`)

        channel.on("broadcast", { event: "MATCH_STARTED" }, ({ payload }) => {
          toast.custom(
            (id) => (
              <div
                style={{
                  background: "linear-gradient(135deg, #064e3b, #065f46)",
                  border: "1px solid #10b981",
                  boxShadow: "0 0 32px rgba(16,185,129,0.5)",
                  borderRadius: "16px",
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  minWidth: "280px",
                  maxWidth: "340px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                  <span style={{ color: "#6ee7b7", fontWeight: 800, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Match Started
                  </span>
                </div>
                <p style={{ color: "#ffffff", fontWeight: 700, fontSize: "17px", margin: 0 }}>
                  You vs {payload.opponentName}
                </p>
                <p style={{ color: "#a7f3d0", fontSize: "12px", margin: 0 }}>
                  You have 2 minutes to join before it times out
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => { toast.dismiss(id); router.push(`/matches/${payload.matchId}/live`) }}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "10px",
                      background: "#10b981",
                      color: "#000",
                      fontWeight: 800,
                      fontSize: "14px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Join Now →
                  </button>
                  <button
                    onClick={() => toast.dismiss(id)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.08)",
                      color: "#a7f3d0",
                      fontWeight: 600,
                      fontSize: "13px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ),
            { duration: 120_000, id: `match-started-${payload.matchId}` },
          )
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
    <PlayerPresenceContext.Provider value={{ onlinePlayerIds, myPlayerId: playerId }}>
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
      <ChallengeModal
        open={!!challengeTarget}
        opponent={challengeTarget ?? { id: "", name: "", avatarUrl: null }}
        myPlayerId={playerId}
        onClose={() => setChallengeTarget(null)}
      />
    </PlayerPresenceContext.Provider>
  )
}
