"use client"

import { use, useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { MessageCircle, RefreshCw } from "lucide-react"
import { motion } from "framer-motion"
import { usePracticeSession } from "@/hooks/usePracticeSession"
import { useBobs27Store } from "@/stores/bobs27.store"
import { useCricketStore } from "@/stores/cricket.store"
import { useHalfItStore } from "@/stores/halfit.store"
import { useMatchChat } from "@/hooks/useMatchChat"
import { MatchChatPanel } from "@/components/match/LiveChat/MatchChatPanel"
import { Bobs27Scoring } from "@/components/practice/Bobs27Scoring"
import { CricketScoring } from "@/components/practice/CricketScoring"
import { HalfItScoring } from "@/components/practice/HalfItScoring"
import { Skeleton } from "@/components/ui/skeleton"
import { prewarmSpeech, setSpectatorCallerOverride } from "@/lib/utils/speech"

interface PageProps { params: Promise<{ sessionId: string }> }

export default function PracticeSessionPage({ params }: PageProps) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { data, isLoading, error, forceResync } = usePracticeSession(sessionId)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const dragBoundsRef = useRef<HTMLDivElement>(null)

  const [showCallerPrompt, setShowCallerPrompt] = useState(() =>
    typeof window !== "undefined" && !sessionStorage.getItem(`caller-set-${sessionId}`)
  )

  function handleCallerChoice(enabled: boolean) {
    localStorage.setItem("masterCallerEnabled", String(enabled))
    sessionStorage.setItem(`caller-set-${sessionId}`, "true")
    setShowCallerPrompt(false)
    prewarmSpeech()
  }

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })

  // Spectators always hear caller
  useEffect(() => {
    const myPlayerId = me?.playerId ?? null
    const isParticipant = data?.players.some((p) => p.playerId === myPlayerId)
    setSpectatorCallerOverride(!isParticipant)
    return () => setSpectatorCallerOverride(false)
  }, [me, data])

  // Game status: redirect to stats on completion
  const bobs27Status = useBobs27Store((s) => s.status)
  const cricketStatus = useCricketStore((s) => s.status)
  const halfitStatus = useHalfItStore((s) => s.status)

  const gameStatus = data?.gameMode === "BOBS_27" ? bobs27Status
    : data?.gameMode === "CRICKET" ? cricketStatus
    : halfitStatus

  useEffect(() => {
    if (gameStatus === "COMPLETED") {
      setTimeout(() => router.push(`/practice/${sessionId}/stats`), 1500)
    }
  }, [gameStatus, sessionId, router])

  const myPlayerId = me?.playerId ?? null
  const isParticipant = data?.players.some((p) => p.playerId === myPlayerId)
  const isLocal = data?.isLocal ?? false
  const canControl = !!(isLocal || isParticipant)

  const userName = data?.players.find((p) => p.playerId === myPlayerId)?.name
    ?? me?.email?.split("@")[0]
    ?? "Spectator"

  const chat = useMatchChat({ matchId: sessionId, userId: me?.id ?? "", userName, isOpen: isChatOpen })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load session.</p>
      </div>
    )
  }

  return (
    <>
      {/* Caller prompt */}
      {showCallerPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-3 w-full max-w-xs">
            <p className="text-sm font-semibold text-center text-foreground">Enable the match caller?</p>
            <p className="text-xs text-muted-foreground text-center">Announces scores and results</p>
            <button onClick={() => handleCallerChoice(true)} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all">On</button>
            <button onClick={() => handleCallerChoice(false)} className="w-full py-2 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors">Off</button>
          </div>
        </div>
      )}

      {/* Game scoring UI */}
      <div className="max-w-2xl mx-auto w-full">
        {data.gameMode === "BOBS_27" && (
          <Bobs27Scoring sessionId={sessionId} myPlayerId={myPlayerId} canControl={canControl} isLocal={isLocal ?? false} />
        )}
        {data.gameMode === "CRICKET" && (
          <CricketScoring sessionId={sessionId} myPlayerId={myPlayerId} canControl={canControl} isLocal={isLocal ?? false} />
        )}
        {data.gameMode === "HALF_IT" && (
          <HalfItScoring sessionId={sessionId} myPlayerId={myPlayerId} canControl={canControl} isLocal={isLocal ?? false} />
        )}
      </div>

      {/* Drag boundary */}
      <div ref={dragBoundsRef} className="fixed inset-0 pointer-events-none z-[39]" />

      {/* Resync button */}
      {gameStatus !== "COMPLETED" && (
        <button
          onClick={async () => { setIsSyncing(true); await forceResync(); setIsSyncing(false) }}
          disabled={isSyncing}
          className="fixed bottom-6 left-4 z-40 size-10 rounded-full bg-muted border border-border text-muted-foreground flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-50"
          aria-label="Resync"
        >
          <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
        </button>
      )}

      {/* Chat button */}
      <motion.button
        drag
        dragConstraints={dragBoundsRef}
        dragMomentum={false}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsChatOpen((o) => !o)}
        className="fixed bottom-6 right-4 z-40 size-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
      >
        <MessageCircle className="size-5" />
        {chat.unreadCount > 0 && !isChatOpen && (
          <span className="absolute -top-1 -right-1 size-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
          </span>
        )}
      </motion.button>

      {data.players.length >= 2 && (
        <MatchChatPanel
          chat={chat}
          playerAName={data.players[0]?.name ?? "Player A"}
          playerBName={data.players[1]?.name ?? "Player B"}
          myUserId={me?.id ?? ""}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </>
  )
}
