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
import { prewarmSpeech, announceFirstThrow, setSpectatorCallerOverride } from "@/lib/utils/speech"

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

  const isLocal = useLiveMatchStore((s) => s.isLocal)
  const visits = useLiveMatchStore((s) => s.visits)
  const playerALegsWon = useLiveMatchStore((s) => s.playerALegsWon)
  const playerBLegsWon = useLiveMatchStore((s) => s.playerBLegsWon)
  const currentTurnPlayerId = useLiveMatchStore((s) => s.currentTurnPlayerId)

  // Announce "First Name, Nickname, Surname to throw first" once when the first leg loads
  const hasAnnouncedRef = useRef(false)
  useEffect(() => {
    if (
      hasAnnouncedRef.current || isLoading ||
      !playerA || !playerB || !currentTurnPlayerId ||
      playerALegsWon !== 0 || playerBLegsWon !== 0 || visits.length !== 0
    ) return
    hasAnnouncedRef.current = true
    const starter = currentTurnPlayerId === playerA.id ? playerA : playerB
    announceFirstThrow(starter.name, starter.nickname ?? null)
  }, [isLoading, playerA, playerB, currentTurnPlayerId, playerALegsWon, playerBLegsWon, visits.length])

  // For local matches only: prompt once to distinguish the scorer from remote spectators.
  // Online matches derive the role purely from the viewer's linked player account.
  const [sessionRole, setSessionRole] = useState<"local" | "spectator" | null>(() => {
    if (typeof window === "undefined") return null
    return (sessionStorage.getItem(`match-role-${matchId}`) as "local" | "spectator" | null) ?? null
  })

  function handleRoleSelect(role: "local" | "spectator") {
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

  const hasSavedPollRef = useRef(false)

  const [isChatOpen, setIsChatOpen] = useState(false)
  const dragBoundsRef = useRef<HTMLDivElement>(null)

  const myPlayerId = me?.playerId ?? null
  const derivedRole: Role =
    myPlayerId && playerA?.id === myPlayerId ? "playerA"
    : myPlayerId && playerB?.id === myPlayerId ? "playerB"
    : "spectator"

  // Online: role comes entirely from the viewer's linked account — no prompts, no choice.
  // Local: prompt once so the scorer can be distinguished from remote spectators.
  const myRole: Role = isLocal ? (sessionRole ?? "spectator") : derivedRole

  // Spectators always hear the caller regardless of the per-device localStorage setting
  useEffect(() => {
    setSpectatorCallerOverride(myRole === "spectator")
    return () => setSpectatorCallerOverride(false)
  }, [myRole])

  async function handleToggleLocal(newIsLocal: boolean) {
    await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocal: newIsLocal }),
    })
    useLiveMatchStore.setState({ isLocal: newIsLocal })
    if (newIsLocal) {
      sessionStorage.setItem(`match-role-${matchId}`, "local")
      setSessionRole("local")
    } else {
      sessionStorage.removeItem(`match-role-${matchId}`)
      setSessionRole(null)
    }
  }

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

  // Snapshot poll votes once when the match ends during this session
  useEffect(() => {
    if (!isMatchWon || hasSavedPollRef.current || wasAlreadyCompleteRef.current !== false) return
    hasSavedPollRef.current = true
    const votesA = chat.presenceUsers.filter((u) => u.vote === "A").length
    const votesB = chat.presenceUsers.filter((u) => u.vote === "B").length
    if (votesA + votesB === 0) return
    fetch(`/api/matches/${matchId}/poll`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ votesA, votesB }),
    })
  }, [isMatchWon, chat.presenceUsers, matchId])

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

  const showRolePrompt = isLocal && !sessionRole && !!me && !!playerA && !!playerB

  return (
    <>
      {showRolePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-3 w-full max-w-xs">
            <p className="text-sm font-semibold text-center text-foreground">Are you scoring this match?</p>
            <button
              onClick={() => handleRoleSelect("local")}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              Yes, scoring for both
            </button>
            <button
              onClick={() => handleRoleSelect("spectator")}
              className="w-full py-2 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              No, just watching
            </button>
          </div>
        </div>
      )}

      <LiveScoringLayout myRole={myRole} onToggleLocal={myRole !== "spectator" ? handleToggleLocal : undefined} />

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
