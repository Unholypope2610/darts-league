"use client"

import { useBobs27Store } from "@/stores/bobs27.store"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { cn } from "@/lib/utils/cn"
import { Undo2 } from "lucide-react"
import { announceBobs27Round } from "@/lib/utils/speech"

const DOUBLES = [
  { key: "D1", label: "D1", value: 2 }, { key: "D2", label: "D2", value: 4 }, { key: "D3", label: "D3", value: 6 },
  { key: "D4", label: "D4", value: 8 }, { key: "D5", label: "D5", value: 10 }, { key: "D6", label: "D6", value: 12 },
  { key: "D7", label: "D7", value: 14 }, { key: "D8", label: "D8", value: 16 }, { key: "D9", label: "D9", value: 18 },
  { key: "D10", label: "D10", value: 20 }, { key: "D11", label: "D11", value: 22 }, { key: "D12", label: "D12", value: 24 },
  { key: "D13", label: "D13", value: 26 }, { key: "D14", label: "D14", value: 28 }, { key: "D15", label: "D15", value: 30 },
  { key: "D16", label: "D16", value: 32 }, { key: "D17", label: "D17", value: 34 }, { key: "D18", label: "D18", value: 36 },
  { key: "D19", label: "D19", value: 38 }, { key: "D20", label: "D20", value: 40 }, { key: "D25", label: "Bull", value: 50 },
]

interface Props {
  sessionId: string
  myPlayerId: string | null
  canControl: boolean
  isLocal: boolean
  onReplayTrigger?: (playerId: string, label: string, context: Record<string, unknown>) => void
  replayBobs27HitsThreshold?: number
}

export function Bobs27Scoring({ myPlayerId, canControl, isLocal, onReplayTrigger, replayBobs27HitsThreshold = 3 }: Props) {
  const players = useBobs27Store((s) => s.players)
  const currentPlayerIndex = useBobs27Store((s) => s.currentPlayerIndex)
  const currentRound = useBobs27Store((s) => s.currentRound)
  const scores = useBobs27Store((s) => s.scores)
  const rounds = useBobs27Store((s) => s.rounds)
  const eliminated = useBobs27Store((s) => s.eliminated)
  const variant = useBobs27Store((s) => s.variant)
  const status = useBobs27Store((s) => s.status)
  const winnerId = useBobs27Store((s) => s.winnerId)
  const submitRound = useBobs27Store((s) => s.submitRound)
  const undoLastRound = useBobs27Store((s) => s.undoLastRound)
  const lastRoundId = useBobs27Store((s) => s.lastRoundId)

  const activePlayer = players[currentPlayerIndex]
  const currentDouble = DOUBLES[currentRound - 1]
  const isMyTurn = isLocal || (myPlayerId && activePlayer?.playerId === myPlayerId)
  const canInput = canControl && isMyTurn && status === "IN_PROGRESS"

  if (!activePlayer || !currentDouble) return null

  const currentScore = scores[activePlayer.playerId] ?? 27

  async function handleSubmit(dartsHit: number) {
    if (!canInput) return
    const val = currentDouble.value / 2
    const pointsChange = dartsHit === 0 ? -val : val * dartsHit
    announceBobs27Round(currentDouble.label, dartsHit, pointsChange)
    await submitRound(dartsHit)
    if (dartsHit >= replayBobs27HitsThreshold && onReplayTrigger) {
      onReplayTrigger(activePlayer.playerId, `${dartsHit}/3 on ${currentDouble.label}!`, { target: currentDouble.label, dartsHit })
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header: active player + game info */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PlayerAvatar name={activePlayer.name} avatarUrl={activePlayer.avatarUrl} size="lg" />
          <div>
            <p className="font-bold text-lg">{activePlayer.name}</p>
            <p className="text-sm text-muted-foreground">
              Round {currentRound} / 21
              {variant === "HARD" && <span className="ml-2 text-xs font-bold text-red-400">HARD</span>}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("font-score font-black text-3xl", currentScore < 0 ? "text-red-400" : "text-primary")}>
            {currentScore}
          </p>
          <p className="text-xs text-muted-foreground">score</p>
        </div>
      </div>

      {/* All players strip (multiplayer) */}
      {players.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {players.map((p, i) => (
            <div
              key={p.playerId}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0",
                i === currentPlayerIndex ? "border-primary/40 bg-primary/10" : "border-border bg-card",
                eliminated[p.playerId] && "opacity-40",
              )}
            >
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
              <div>
                <p className="text-xs font-semibold">{p.name.split(" ")[0]}</p>
                <p className={cn("font-score text-sm font-bold", (scores[p.playerId] ?? 27) < 0 ? "text-red-400" : "")}>
                  {scores[p.playerId] ?? 27}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Doubles progress grid */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="grid grid-cols-3 gap-1">
          {DOUBLES.map((d, idx) => {
            const playerRounds = rounds[activePlayer.playerId] ?? []
            const roundData = playerRounds[idx]
            const isCurrent = currentRound - 1 === idx
            const isPast = idx < currentRound - 1

            return (
              <div
                key={d.key}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold",
                  isCurrent ? "bg-primary/20 border border-primary/40 text-primary" :
                  isPast && roundData
                    ? roundData.pointsChange >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    : "text-muted-foreground/50",
                )}
              >
                <span>{d.label}</span>
                {roundData && (
                  <span className="font-score">
                    {roundData.pointsChange >= 0 ? `+${roundData.pointsChange}` : roundData.pointsChange}
                  </span>
                )}
                {isCurrent && <span className="text-[10px]">►</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Status */}
      {status === "COMPLETED" && (
        <div className="rounded-xl bg-primary/10 border border-primary/30 p-4 text-center">
          <p className="font-bold text-lg">Game Over!</p>
          <p className="text-sm text-muted-foreground">
            {winnerId ? `${players.find((p) => p.playerId === winnerId)?.name} wins!` : "Draw!"}
          </p>
        </div>
      )}

      {/* Input */}
      {status === "IN_PROGRESS" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-center text-muted-foreground">
            How many darts hit <span className="text-foreground font-bold">{currentDouble.label}</span>?
          </p>
          {canInput ? (
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((hits) => {
                const preview = hits === 0
                  ? -(currentDouble.value / 2)
                  : (currentDouble.value / 2) * hits
                return (
                  <button
                    key={hits}
                    onClick={() => handleSubmit(hits)}
                    className={cn(
                      "flex flex-col items-center py-4 rounded-xl border font-bold transition-all active:scale-95",
                      hits === 0
                        ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : hits === 3
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                        : "border-border bg-card hover:border-primary/40 hover:bg-primary/10",
                    )}
                  >
                    <span className="text-2xl">{hits}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {preview >= 0 ? `+${preview}` : preview}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              Waiting for {activePlayer.name}…
            </p>
          )}
        </div>
      )}

      {/* Undo */}
      {canControl && lastRoundId && status === "IN_PROGRESS" && (
        <button
          onClick={() => undoLastRound()}
          className="flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-muted-foreground text-sm hover:text-foreground transition-colors"
        >
          <Undo2 className="w-4 h-4" />
          Undo last
        </button>
      )}
    </div>
  )
}
