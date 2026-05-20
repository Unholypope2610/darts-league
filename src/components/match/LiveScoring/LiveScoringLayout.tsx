"use client"

import { useLiveMatchStore } from "@/stores/live-match.store"
import { useBoardCamSpectate } from "@/hooks/useBoardCamSpectate"
import { PlayerPanel } from "./PlayerPanel"
import { NumericKeypad } from "./NumericKeypad"
import { LegHistory } from "./LegHistory"
import { LegWinAnimation } from "./LegWinAnimation"
import { MatchWinReveal } from "./MatchWinReveal"

type Role = "playerA" | "playerB" | "spectator"

interface LiveScoringLayoutProps {
  myRole: Role
}

export function LiveScoringLayout({ myRole }: LiveScoringLayoutProps) {
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
    visits,
    allVisits,
    isBustDialogOpen,
    confirmBust,
    startNewLeg,
  } = useLiveMatchStore()

  // Spectate both players' cams permanently — cams stay on the whole match.
  // Hooks must be called unconditionally before any early return.
  const { remoteStream: playerACamStream } = useBoardCamSpectate(matchId ?? "", playerA?.id ?? "")
  const { remoteStream: playerBCamStream } = useBoardCamSpectate(matchId ?? "", playerB?.id ?? "")

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
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Waiting for match to start…</p>
        )}
      </div>
    )
  }

  const isAActive = currentTurnPlayerId === playerA.id

  // The throwing player's cam shows in their OWN (active) panel.
  const panelACamStream = isAActive ? playerACamStream : null
  const panelBCamStream = !isAActive ? playerBCamStream : null

  const isBustA = isBustDialogOpen && isAActive
  const isBustB = isBustDialogOpen && !isAActive

  // Players can control their own panel; spectators have no controls
  const canControlA = myRole === "playerA"
  const canControlB = myRole === "playerB"

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
            isBust={isBustA}
            visits={visits}
            allVisits={allVisits}
            camStream={panelACamStream}
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
            isBust={isBustB}
            visits={visits}
            allVisits={allVisits}
            camStream={panelBCamStream}
            canControl={canControlB}
          />
        </div>

        {/* Bust confirmation — hidden for spectators */}
        {isBustDialogOpen && !isSpectator && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/40 p-4 flex flex-col items-center gap-3">
            <span className="text-red-400 font-bold text-lg">BUST!</span>
            <p className="text-sm text-muted-foreground text-center">Score exceeds remaining. Turn forfeited.</p>
            <button
              onClick={confirmBust}
              className="px-6 py-2 rounded-lg bg-red-500 text-white font-bold text-sm hover:bg-red-600 active:scale-95 transition-all"
            >
              OK, next player
            </button>
          </div>
        )}

        {/* Keypad — hidden for spectators */}
        {!isBustDialogOpen && !isSpectator && <NumericKeypad />}

        {/* Leg history */}
        <LegHistory
          visits={visits}
          playerAId={playerA.id}
          playerBId={playerB.id}
          playerAName={playerA.name}
          playerBName={playerB.name}
        />
      </div>

      <LegWinAnimation />
      <MatchWinReveal />
    </>
  )
}
