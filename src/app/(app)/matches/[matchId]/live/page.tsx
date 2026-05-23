"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { MessageCircle } from "lucide-react"
import { motion } from "framer-motion"
import { useLiveMatch } from "@/hooks/useLiveMatch"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { useMatchChat } from "@/hooks/useMatchChat"
import { LiveScoringLayout } from "@/components/match/LiveScoring/LiveScoringLayout"
import { MatchChatPanel } from "@/components/match/LiveChat/MatchChatPanel"
import { Skeleton } from "@/components/ui/skeleton"
import { prewarmSpeech } from "@/lib/utils/speech"

type Role = "playerA" | "playerB" | "spectator" | "local"

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default function LiveMatchPage({ params }: PageProps) {
  const { matchId } = use(params)
  const router = useRouter()
  const { isLoading, error } = useLiveMatch(matchId)
  const isMatchWon = useLiveMatchStore((s) => s.isMatchWon)
  const playerA = useLiveMatchStore((s) => s.playerA)
  const playerB = useLiveMatchStore((s) => s.playerB)
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })

  const [sessionRole, setSessionRole] = useState<Role | null>(() => {
    if (typeof window === "undefined") return null
    return (sessionStorage.getItem(`match-role-${matchId}`) as Role | null) ?? null
  })

  function handleRoleSelect(role: Role) {
    prewarmSpeech()
    sessionStorage.setItem(`match-role-${matchId}`, role)
    setSessionRole(role)
  }

  // Redirect to summary only if the match was ALREADY complete when the page loaded.
  const wasAlreadyCompleteRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (!isLoading && wasAlreadyCompleteRef.current === null) {
      wasAlreadyCompleteRef.current = isMatchWon
      if (isMatchWon) router.replace(`/matches/${matchId}`)
    }
  }, [isLoading, isMatchWon, matchId, router])

  const [isChatOpen, setIsChatOpen] = useState(false)
  const dragBoundsRef = useRef<HTMLDivElement>(null)

  const myPlayerId = me?.playerId ?? null
  const derivedRole: Role =
    myPlayerId && playerA?.id === myPlayerId ? "playerA"
    : myPlayerId && playerB?.id === myPlayerId ? "playerB"
    : "spectator"

  // If we can positively identify the viewer as a player (their linked playerId matches),
  // always trust that over any stored session choice. This prevents a stale "spectator"
  // entry in sessionStorage from locking a player out of their camera controls.
  const myRole: Role = derivedRole !== "spectator" ? derivedRole : (sessionRole ?? "spectator")

  // Evict stale "spectator" session entry when the viewer is actually a player.
  useEffect(() => {
    if (derivedRole !== "spectator" && sessionRole === "spectator") {
      sessionStorage.removeItem(`match-role-${matchId}`)
      setSessionRole(null)
    }
  }, [derivedRole, sessionRole, matchId])

  const userName =
    myRole === "playerA" ? (playerA?.name ?? "Player A")
    : myRole === "playerB" ? (playerB?.name ?? "Player B")
    : myRole === "local" ? "Local Scorer"
    : (me?.email?.split("@")[0] ?? "Spectator")

  const chat = useMatchChat({
    matchId,
    userId: me?.id ?? "",
    userName,
    isOpen: isChatOpen,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load match.</p>
      </div>
    )
  }

  const showRolePrompt =
    !sessionRole && derivedRole === "spectator" && !!me && !!playerA && !!playerB

  return (
    <>
      {showRolePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-3 w-full max-w-xs">
            <p className="text-sm font-semibold text-center text-foreground">Who are you in this match?</p>
            <button
              onClick={() => handleRoleSelect("playerA")}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              {playerA.name}
            </button>
            <button
              onClick={() => handleRoleSelect("playerB")}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              {playerB.name}
            </button>
            <button
              onClick={() => handleRoleSelect("local")}
              className="w-full py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors border border-border"
            >
              Score both players (one device)
            </button>
            <button
              onClick={() => handleRoleSelect("spectator")}
              className="w-full py-2 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              Just spectating
            </button>
          </div>
        </div>
      )}

      <LiveScoringLayout myRole={myRole} />

      {/* Invisible drag boundary covering the full viewport */}
      <div ref={dragBoundsRef} className="fixed inset-0 pointer-events-none z-[39]" />

      {/* Floating chat button — draggable */}
      <motion.button
        drag
        dragConstraints={dragBoundsRef}
        dragMomentum={false}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsChatOpen((o) => !o)}
        className="fixed bottom-6 right-4 z-40 size-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
        aria-label="Open chat"
      >
        <MessageCircle className="size-5" />
        {chat.unreadCount > 0 && !isChatOpen && (
          <span className="absolute -top-1 -right-1 size-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
          </span>
        )}
      </motion.button>

      {playerA && playerB && (
        <MatchChatPanel
          chat={chat}
          playerAName={playerA.name}
          playerBName={playerB.name}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </>
  )
}
