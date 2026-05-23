"use client"

import { useRef, useEffect, useState } from "react"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { useBoardCamSpectate } from "@/hooks/useBoardCamSpectate"
import { PlayerPanel } from "./PlayerPanel"
import { NumericKeypad } from "./NumericKeypad"
import { LegHistory } from "./LegHistory"
import { LegWinAnimation } from "./LegWinAnimation"
import { MatchWinReveal } from "./MatchWinReveal"
import { DoublesPrompt } from "./DoublesPrompt"

type Role = "playerA" | "playerB" | "spectator" | "local"

interface LiveScoringLayoutProps {
  myRole: Role
  onToggleLocal?: (isLocal: boolean) => void
}

function CamFeedPanel({ stream, label }: { stream: MediaStream | null; label: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [wasConnected, setWasConnected] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    if (stream) {
      setWasConnected(true)
      el.play().catch(() => {})
    }
  }, [stream])

  const isReconnecting = wasConnected && !stream

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-black aspect-square">
      <video ref={ref} autoPlay playsInline muted className="w-full h-full object-cover" />
      {!stream && !isReconnecting && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-muted-foreground text-center px-4">
            No cam signal — start cam on {label}&apos;s device
          </p>
        </div>
      )}
      {isReconnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <p className="text-xs text-white/60">Reconnecting…</p>
        </div>
      )}
      {stream && (
        <span className="absolute bottom-2 left-3 text-xs font-semibold text-white/70 drop-shadow">
          {label}
        </span>
      )}
    </div>
  )
}

export function LiveScoringLayout({ myRole, onToggleLocal }: LiveScoringLayoutProps) {
  const {
    matchId,
    playerA,
    playerB,
    playerARemainder,
    playerBRemainder,
    playerALegsWon,
    playerBLegsWon,
    bestOf,
    currentTurnPlayerId,
    currentLegId,
    isLocal,
    visits,
    allVisits,
    pendingDoublesPrompt,
    awaitingMatchWinReveal,
    isMatchWon,
    startNewLeg,
    editVisit,
  } = useLiveMatchStore()

  // Spectate both players' cams permanently — hooks must be called unconditionally.
  // Pass "" for your own channel so the hook exits early; you see your own cam via
  // the local preview in PlayerPanel, and self-spectation would create a feedback loop
  // where your own spectate hook fires READY at your own broadcast hook endlessly.
  // In local mode the device broadcasts on playerA's channel, so exclude it there too.
  const { remoteStream: playerACamStream } = useBoardCamSpectate(
    matchId ?? "",
    myRole !== "playerA" && myRole !== "local" ? (playerA?.id ?? "") : "",
  )
  const { remoteStream: playerBCamStream } = useBoardCamSpectate(
    matchId ?? "",
    myRole !== "playerB" ? (playerB?.id ?? "") : "",
  )

  if (!playerA || !playerB) return null

  const isSpectator = myRole === "spectator"

  if (!currentLegId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        {isSpectator && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border uppercase tracking-wider">
            Spectating
          </span>
        )}
        {!isSpectator ? (
          <>
            {onToggleLocal && (
              <div className="flex rounded-xl overflow-hidden border border-border">
                {(["Online", "Local"] as const).map((opt) => {
                  const active = opt === "Local" ? isLocal : !isLocal
                  return (
                    <button
                      key={opt}
                      onClick={() => onToggleLocal(opt === "Local")}
                      className="flex-1 py-2 px-4 text-xs font-semibold transition-colors"
                      style={{
                        background: active ? "rgba(16,185,129,0.15)" : "transparent",
                        color: active ? "#10b981" : "#71717a",
                      }}
                    >
                      {opt === "Local" ? "Local (one device)" : "Online"}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-muted-foreground text-sm">Who throws first?</p>
            <div className="flex gap-3">
              {[playerA, playerB].map((p) => (
                <button
                  key={p.id}
                  onClick={() => startNewLeg(p.id)}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
                >
                  {p.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => startNewLeg(Math.random() < 0.5 ? playerA.id : playerB.id)}
              className="px-6 py-3 rounded-xl bg-muted border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-95 transition-all"
            >
              🎲 Randomise
            </button>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Waiting for match to start…</p>
        )}
      </div>
    )
  }

  const isAActive = currentTurnPlayerId === playerA.id

  // Is the current viewer the one who is throwing right now?
  // In local mode, the keypad is always available (scoring for both players on one device).
  const isMyTurn = myRole === "local"
    ? true
    : (myRole === "playerA" && isAActive) || (myRole === "playerB" && !isAActive)

  // The throwing player's cam feed — shown in the keypad area when not your turn.
  // In local mode playerB has no broadcaster, so fall back to playerA's cam for spectators.
  const activeCamStream = isAActive ? playerACamStream : (playerBCamStream ?? playerACamStream)
  const throwingPlayerName = isAActive ? playerA.name : playerB.name

  // Each player can only control their own cam panel; local mode acts as playerA's broadcaster.
  const canControlA = myRole === "playerA" || myRole === "local"
  const canControlB = myRole === "playerB"

  // Pencil shows on a player's own visits; null means all visits are editable (local mode).
  const viewerPlayerId =
    myRole === "playerA" ? playerA.id
    : myRole === "playerB" ? playerB.id
    : null

  const blockInteraction = !!pendingDoublesPrompt

  return (
    <>
      {isSpectator && (
        <div className="flex justify-center mb-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border uppercase tracking-wider">
            Spectating
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto px-4 pb-8">
        {/* Player panels side by side */}
        <div className="grid grid-cols-2 gap-3">
          <PlayerPanel
            matchId={matchId ?? ""}
            playerId={playerA.id}
            name={playerA.name}
            avatarUrl={playerA.avatarUrl}
            remainder={playerARemainder}
            legsWon={playerALegsWon}
            bestOf={bestOf}
            isActive={isAActive}
            isBust={false}
            visits={visits}
            allVisits={allVisits}
            canControl={canControlA}
          />
          <PlayerPanel
            matchId={matchId ?? ""}
            playerId={playerB.id}
            name={playerB.name}
            avatarUrl={playerB.avatarUrl}
            remainder={playerBRemainder}
            legsWon={playerBLegsWon}
            bestOf={bestOf}
            isActive={!isAActive}
            isBust={false}
            visits={visits}
            allVisits={allVisits}
            canControl={canControlB}
          />
        </div>

        {/* Turn indicator — only shown in local (one-device) mode */}
        {myRole === "local" && !blockInteraction && (
          <div className="text-center text-xs font-bold uppercase tracking-widest text-primary py-1">
            {isAActive ? playerA.name : playerB.name}&apos;s turn
          </div>
        )}

        {/* Keypad — only shown when it's this viewer's turn and no prompt blocking */}
        {!blockInteraction && isMyTurn && <NumericKeypad />}

        {/* Cam feed — shown when watching opponent throw, or spectating */}
        {!blockInteraction && (!isMyTurn || isSpectator) && (
          <CamFeedPanel stream={activeCamStream} label={throwingPlayerName} />
        )}

        {/* Leg history */}
        <LegHistory
          visits={visits}
          playerAId={playerA.id}
          playerBId={playerB.id}
          playerAName={playerA.name}
          playerBName={playerB.name}
          viewerPlayerId={viewerPlayerId}
          onEdit={!isMatchWon && !isSpectator ? editVisit : undefined}
        />
      </div>

      <LegWinAnimation />
      {!pendingDoublesPrompt && !awaitingMatchWinReveal && <MatchWinReveal />}
      <DoublesPrompt />
    </>
  )
}
