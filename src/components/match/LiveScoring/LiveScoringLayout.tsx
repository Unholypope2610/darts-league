"use client"

import { useLiveMatchStore } from "@/stores/live-match.store"
import { PlayerPanel } from "./PlayerPanel"
import { NumericKeypad } from "./NumericKeypad"
import { LegHistory } from "./LegHistory"
import { LegWinAnimation } from "./LegWinAnimation"
import { MatchWinReveal } from "./MatchWinReveal"

export function LiveScoringLayout() {
  const {
    playerA,
    playerB,
    playerARemainder,
    playerBRemainder,
    playerALegsWon,
    playerBLegsWon,
    bestOf,
    currentTurnPlayerId,
    visits,
    isBustDialogOpen,
    confirmBust,
  } = useLiveMatchStore()

  if (!playerA || !playerB) return null

  const isAActive = currentTurnPlayerId === playerA.id
  const isBustA = isBustDialogOpen && isAActive
  const isBustB = isBustDialogOpen && !isAActive

  return (
    <>
      <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto px-4 pb-8">
        {/* Player panels side by side */}
        <div className="grid grid-cols-2 gap-3">
          <PlayerPanel
            playerId={playerA.id}
            name={playerA.name}
            avatarUrl={playerA.avatarUrl}
            remainder={playerARemainder}
            legsWon={playerALegsWon}
            bestOf={bestOf}
            isActive={isAActive}
            isBust={isBustA}
            visits={visits}
          />
          <PlayerPanel
            playerId={playerB.id}
            name={playerB.name}
            avatarUrl={playerB.avatarUrl}
            remainder={playerBRemainder}
            legsWon={playerBLegsWon}
            bestOf={bestOf}
            isActive={!isAActive}
            isBust={isBustB}
            visits={visits}
          />
        </div>

        {/* Bust confirmation */}
        {isBustDialogOpen && (
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

        {/* Keypad */}
        {!isBustDialogOpen && <NumericKeypad />}

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
