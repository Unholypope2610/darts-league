"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { MessageCircle, RefreshCw, Video, RotateCcw, ChevronUp, ChevronDown } from "lucide-react"
import { motion } from "framer-motion"
import { usePracticeSession } from "@/hooks/usePracticeSession"
import { useBobs27Store } from "@/stores/bobs27.store"
import { useCricketStore } from "@/stores/cricket.store"
import { useHalfItStore } from "@/stores/halfit.store"
import { useMatchChat } from "@/hooks/useMatchChat"
import { useBoardCamBroadcast } from "@/hooks/useBoardCamBroadcast"
import { useBoardCamSpectate } from "@/hooks/useBoardCamSpectate"
import { MatchChatPanel } from "@/components/match/LiveChat/MatchChatPanel"
import { Bobs27Scoring } from "@/components/practice/Bobs27Scoring"
import { CricketScoring } from "@/components/practice/CricketScoring"
import { HalfItScoring } from "@/components/practice/HalfItScoring"
import { PracticeReplayPrompt, type PendingPracticeReplay } from "@/components/practice/PracticeReplayPrompt"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils/cn"
import { prewarmSpeech, setSpectatorCallerOverride } from "@/lib/utils/speech"

interface PageProps { params: Promise<{ sessionId: string }> }

export default function PracticeSessionPage({ params }: PageProps) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { data, isLoading, error, forceResync } = usePracticeSession(sessionId)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [camHidden, setCamHidden] = useState(false)
  const [pendingReplay, setPendingReplay] = useState<PendingPracticeReplay | null>(null)
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

  // Replay thresholds — use the active player's config (or first player in local mode)
  const myPlayerMeta = data?.players.find((p) => p.playerId === myPlayerId) ?? data?.players[0]
  const replayBobs27HitsThreshold = myPlayerMeta?.replayBobs27HitsThreshold ?? 3
  const replayMarksThreshold = myPlayerMeta?.replayMarksThreshold ?? 5

  function handleReplayTrigger(_playerId: string, label: string, context: Record<string, unknown>) {
    if (!cam.isStreaming) return
    // Capture is always registered under broadcasterPlayerId ("local" or myPlayerId)
    setPendingReplay({ playerId: broadcasterPlayerId, label, context, autoSave: !!context.autoSave })
  }

  const userName = data?.players.find((p) => p.playerId === myPlayerId)?.name
    ?? me?.email?.split("@")[0]
    ?? "Spectator"

  const chat = useMatchChat({ matchId: sessionId, userId: me?.id ?? "", userName, isOpen: isChatOpen })

  // Camera — broadcaster uses their playerId (or "local" for local mode)
  // All non-broadcasters spectate the first player's stream
  const broadcasterPlayerId = isLocal ? "local" : (myPlayerId ?? "")
  const spectatePlayerId = data?.players[0]?.playerId ?? ""
  const cam = useBoardCamBroadcast(sessionId, broadcasterPlayerId, canControl)
  const { remoteStream } = useBoardCamSpectate(
    sessionId,
    // Spectators watch the first player; broadcasters don't self-spectate
    !canControl ? spectatePlayerId : ""
  )
  const camVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (camVideoRef.current && cam.localStream) {
      camVideoRef.current.srcObject = cam.localStream
      camVideoRef.current.play().catch(() => {})
    }
  }, [cam.localStream])
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.play().catch(() => {})
    }
  }, [remoteStream])

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

      {/* Board Cam */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-3">
        <div
          className="rounded-xl border p-3 transition-all"
          style={{ background: "rgba(255,255,255,0.02)", borderColor: cam.isStreaming ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Board Cam</span>
              {cam.isStreaming && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
              {!canControl && remoteStream && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Watching
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(cam.isStreaming || (!canControl && remoteStream)) && (
                <button
                  onClick={() => setCamHidden((v) => !v)}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {camHidden ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  {camHidden ? "Show cam" : "Hide cam"}
                </button>
              )}
              {canControl && !cam.isStreaming && (
                <button
                  onClick={() => cam.start()}
                  className="text-xs px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500 active:scale-95 transition-all"
                >
                  Start Cam
                </button>
              )}
              {canControl && cam.isStreaming && (
                <div className="flex items-center gap-2">
                  <button onClick={cam.flipCamera} className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 active:scale-95 transition-all">
                    <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                  <button
                    onClick={cam.stop}
                    className="text-xs px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 active:scale-95 transition-all"
                  >
                    Stop
                  </button>
                </div>
              )}
            </div>
          </div>

          {!camHidden && (
            <>
              {/* Local preview */}
              {cam.isStreaming && (
                <video ref={camVideoRef} autoPlay playsInline muted className="w-full aspect-video rounded-lg object-cover bg-black mt-3" />
              )}
              {/* Remote stream (spectator) */}
              {!canControl && remoteStream && (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full aspect-video rounded-lg object-cover bg-black mt-3" />
              )}

              {/* Zoom */}
              {canControl && cam.isStreaming && cam.zoomCapabilities && (
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => cam.setZoom(Math.max(cam.zoomCapabilities!.min, parseFloat((cam.zoomLevel - cam.zoomCapabilities!.step).toFixed(2))))}
                    className="flex-1 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-lg hover:bg-zinc-700 active:scale-95 transition-all">−</button>
                  <span className="text-xs font-bold text-zinc-400 w-10 text-center">{cam.zoomLevel.toFixed(1)}×</span>
                  <button onClick={() => cam.setZoom(Math.min(cam.zoomCapabilities!.max, parseFloat((cam.zoomLevel + cam.zoomCapabilities!.step).toFixed(2))))}
                    className="flex-1 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-lg hover:bg-zinc-700 active:scale-95 transition-all">+</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Game scoring UI */}
      <div className="max-w-2xl mx-auto w-full">
        {data.gameMode === "BOBS_27" && (
          <Bobs27Scoring
            sessionId={sessionId} myPlayerId={myPlayerId} canControl={canControl} isLocal={isLocal ?? false}
            onReplayTrigger={handleReplayTrigger}
            replayBobs27HitsThreshold={replayBobs27HitsThreshold}
          />
        )}
        {data.gameMode === "CRICKET" && (
          <CricketScoring
            sessionId={sessionId} myPlayerId={myPlayerId} canControl={canControl} isLocal={isLocal ?? false}
            onReplayTrigger={handleReplayTrigger}
            replayMarksThreshold={replayMarksThreshold}
          />
        )}
        {data.gameMode === "HALF_IT" && (
          <HalfItScoring
            sessionId={sessionId} myPlayerId={myPlayerId} canControl={canControl} isLocal={isLocal ?? false}
            camIsStreaming={cam.isStreaming}
            onReplayTrigger={handleReplayTrigger}
          />
        )}
      </div>

      {/* Practice replay prompt */}
      <PracticeReplayPrompt
        pending={pendingReplay}
        sessionId={sessionId}
        gameMode={data.gameMode}
        onDismiss={() => setPendingReplay(null)}
      />

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
