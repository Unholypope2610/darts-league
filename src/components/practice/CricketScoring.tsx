"use client"

import { useState } from "react"
import { useCricketStore, CRICKET_TARGETS } from "@/stores/cricket.store"
import type { CricketTarget } from "@/stores/cricket.store"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { cn } from "@/lib/utils/cn"
import { Undo2, Check } from "lucide-react"
import type { CricketDart } from "@/types/api"
import { announceCricketDart } from "@/lib/utils/speech"

const TARGET_LABELS: Record<string, string> = {
  "20": "20", "19": "19", "18": "18", "17": "17", "16": "16", "15": "15", "BULL": "BL",
}

function MarkDisplay({ marks }: { marks: number }) {
  if (marks === 0) return <span className="text-muted-foreground/30">─</span>
  if (marks === 1) return <span className="text-muted-foreground">/</span>
  if (marks === 2) return <span className="text-yellow-400">X</span>
  return <span className="text-emerald-400 font-black">⊗</span>
}

interface Props {
  sessionId: string
  myPlayerId: string | null
  canControl: boolean
  isLocal: boolean
  onReplayTrigger?: (playerId: string, label: string, context: Record<string, unknown>) => void
  replayMarksThreshold?: number
}

export function CricketScoring({ myPlayerId, canControl, isLocal, onReplayTrigger, replayMarksThreshold = 5 }: Props) {
  const players = useCricketStore((s) => s.players)
  const currentPlayerIndex = useCricketStore((s) => s.currentPlayerIndex)
  const marks = useCricketStore((s) => s.marks)
  const points = useCricketStore((s) => s.points)
  const status = useCricketStore((s) => s.status)
  const winnerId = useCricketStore((s) => s.winnerId)
  const lastRoundId = useCricketStore((s) => s.lastRoundId)
  const submitTurn = useCricketStore((s) => s.submitTurn)
  const undoLastRound = useCricketStore((s) => s.undoLastRound)

  const [pendingDarts, setPendingDarts] = useState<CricketDart[]>([])
  const [selectedTarget, setSelectedTarget] = useState<CricketTarget | null>(null)
  const [selectedMult, setSelectedMult] = useState<1 | 2 | 3>(1)

  const activePlayer = players[currentPlayerIndex]
  const isMyTurn = isLocal || (myPlayerId && activePlayer?.playerId === myPlayerId)
  const canInput = canControl && isMyTurn && status === "IN_PROGRESS"

  if (!activePlayer) return null

  function addDart(target: CricketTarget, multiplier: 1 | 2 | 3) {
    if (pendingDarts.length >= 3) return
    const dart: CricketDart = { target, multiplier }
    announceCricketDart(target, multiplier)
    setPendingDarts((d) => [...d, dart])
  }

  async function handleSubmit() {
    if (pendingDarts.length === 0) return
    const dartsToSubmit = pendingDarts
    await submitTurn(dartsToSubmit)
    setPendingDarts([])
    setSelectedTarget(null)
    // Calculate total marks earned across this turn
    const marksTotal = dartsToSubmit.reduce((sum, d) => sum + d.multiplier, 0)
    if (marksTotal >= replayMarksThreshold && onReplayTrigger) {
      onReplayTrigger(activePlayer.playerId, `${marksTotal} marks!`, { marksTotal, darts: dartsToSubmit })
    }
  }

  function handleMiss() {
    submitTurn([])
    setPendingDarts([])
    setSelectedTarget(null)
  }

  // Scoring preview: given current marks + pending darts, what points would be earned?
  function getPreviewPoints(): number {
    let preview = 0
    const tempMarks = JSON.parse(JSON.stringify(marks))
    const allPlayerIds = players.map((p) => p.playerId)

    for (const dart of pendingDarts) {
      const { target, multiplier } = dart
      const current = tempMarks[activePlayer.playerId]?.[target] ?? 0
      if (current >= 3) {
        const opponentsAllClosed = allPlayerIds
          .filter((pid) => pid !== activePlayer.playerId)
          .every((pid) => (tempMarks[pid]?.[target] ?? 0) >= 3)
        if (!opponentsAllClosed) {
          const val = target === "BULL" ? 25 : parseInt(target, 10)
          preview += val * multiplier
        }
      } else {
        const newTotal = current + multiplier
        if (newTotal > 3) {
          const overflow = newTotal - 3
          const opponentsAllClosed = allPlayerIds
            .filter((pid) => pid !== activePlayer.playerId)
            .every((pid) => (tempMarks[pid]?.[target] ?? 0) >= 3)
          if (!opponentsAllClosed) {
            const val = target === "BULL" ? 25 : parseInt(target, 10)
            preview += val * overflow
          }
        }
        if (!tempMarks[activePlayer.playerId]) tempMarks[activePlayer.playerId] = {}
        tempMarks[activePlayer.playerId][target] = newTotal
      }
    }
    return preview
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Cricket board table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: `1fr repeat(${players.length}, minmax(0, 1fr)) 1fr` }}>
          <div className="px-3 py-2 text-xs font-bold text-muted-foreground text-center">#</div>
          {players.map((p) => (
            <div key={p.playerId} className={cn("px-2 py-2 flex flex-col items-center gap-0.5", p.playerId === activePlayer.playerId ? "bg-primary/10" : "")}>
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
              <span className="text-[10px] font-semibold truncate max-w-full">{p.name.split(" ")[0]}</span>
              <span className="font-score text-sm font-bold text-primary">{points[p.playerId] ?? 0}</span>
            </div>
          ))}
          <div className="px-3 py-2 text-xs font-bold text-muted-foreground text-center">pts</div>
        </div>

        {/* Rows */}
        {CRICKET_TARGETS.map((target) => (
          <div key={target} className="grid border-b border-border/50 last:border-0" style={{ gridTemplateColumns: `1fr repeat(${players.length}, minmax(0, 1fr)) 1fr` }}>
            <div className="flex items-center justify-center py-3 font-bold text-sm">{TARGET_LABELS[target]}</div>
            {players.map((p) => {
              const m = marks[p.playerId]?.[target] ?? 0
              return (
                <div key={p.playerId} className={cn("flex items-center justify-center py-3 text-lg", p.playerId === activePlayer.playerId ? "bg-primary/5" : "")}>
                  <MarkDisplay marks={Math.min(m, 3)} />
                </div>
              )
            })}
            {/* Points column — show points if active player has open, opponent hasn't closed */}
            <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
              {(() => {
                const myM = marks[activePlayer.playerId]?.[target] ?? 0
                if (myM < 3) return null
                const opponentsAllClosed = players
                  .filter((p) => p.playerId !== activePlayer.playerId)
                  .every((p) => (marks[p.playerId]?.[target] ?? 0) >= 3)
                if (opponentsAllClosed) return <Check className="w-3 h-3 text-emerald-400" />
                return <span className="text-emerald-400 font-bold text-[10px]">open</span>
              })()}
            </div>
          </div>
        ))}
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

      {/* Scoring input */}
      {status === "IN_PROGRESS" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {activePlayer.name}&apos;s turn — dart {pendingDarts.length + 1} of 3
            </p>
            {pendingDarts.length > 0 && (
              <span className="text-xs text-primary font-bold">
                {pendingDarts.map((d) => `${d.multiplier === 2 ? "D" : d.multiplier === 3 ? "T" : ""}${d.target}`).join(", ")}
                {getPreviewPoints() > 0 && ` +${getPreviewPoints()}pts`}
              </span>
            )}
          </div>

          {canInput ? (
            <>
              {/* Multiplier selector */}
              <div className="flex rounded-xl overflow-hidden border border-border">
                {([1, 2, 3] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMult(m)}
                    className={cn(
                      "flex-1 py-2 text-sm font-bold transition-colors",
                      selectedMult === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === 1 ? "Single" : m === 2 ? "Double" : "Triple"}
                  </button>
                ))}
              </div>

              {/* Target buttons */}
              <div className="grid grid-cols-4 gap-2">
                {CRICKET_TARGETS.map((target) => {
                  const m = marks[activePlayer.playerId]?.[target] ?? 0
                  const isClosed = m >= 3
                  return (
                    <button
                      key={target}
                      onClick={() => addDart(target, selectedMult)}
                      disabled={pendingDarts.length >= 3}
                      className={cn(
                        "py-3 rounded-xl border font-bold text-sm transition-all active:scale-95 disabled:opacity-40",
                        isClosed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-border bg-card hover:border-primary/40 hover:bg-primary/10",
                      )}
                    >
                      {TARGET_LABELS[target]}
                      {isClosed && <span className="block text-[10px] text-emerald-400">⊗</span>}
                    </button>
                  )
                })}
              </div>

              {/* Remove last dart */}
              {pendingDarts.length > 0 && (
                <button
                  onClick={() => setPendingDarts((d) => d.slice(0, -1))}
                  className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg border border-border transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Remove last dart
                </button>
              )}

              {/* Submit / Miss */}
              <div className="flex gap-2">
                <button
                  onClick={handleMiss}
                  className="flex-1 py-3 rounded-xl border border-border text-muted-foreground text-sm font-bold hover:border-primary/30 transition-all active:scale-95"
                >
                  Miss (no hits)
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={pendingDarts.length === 0}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
                >
                  Submit Turn
                </button>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              Waiting for {activePlayer.name}…
            </p>
          )}
        </div>
      )}

      {/* Undo */}
      {canControl && lastRoundId && status === "IN_PROGRESS" && pendingDarts.length === 0 && (
        <button
          onClick={() => undoLastRound()}
          className="flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-muted-foreground text-sm hover:text-foreground transition-colors"
        >
          <Undo2 className="w-4 h-4" />
          Undo last turn
        </button>
      )}
    </div>
  )
}
