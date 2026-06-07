"use client"

import { useState } from "react"
import { useCricketStore, CRICKET_TARGETS } from "@/stores/cricket.store"
import type { CricketTarget } from "@/stores/cricket.store"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { cn } from "@/lib/utils/cn"
import { Undo2 } from "lucide-react"
import type { CricketDart } from "@/types/api"
import { announceCricketDart } from "@/lib/utils/speech"

const TARGET_VALUE: Record<string, number> = {
  "20": 20, "19": 19, "18": 18, "17": 17, "16": 16, "15": 15, "BULL": 25,
}

const NUMBER_TARGETS = ["20", "19", "18", "17", "16", "15"] as CricketTarget[]

function MarkIcon({ marks }: { marks: number }) {
  if (marks === 0) return <span className="text-zinc-700 text-[11px]">─</span>
  if (marks === 1) return <span className="text-zinc-400 text-[11px]">/</span>
  if (marks === 2) return <span className="text-yellow-400 text-[11px] font-bold">X</span>
  return <span className="text-emerald-400 text-[11px] font-black">⊗</span>
}

function dartLabel(dart: CricketDart): string {
  if (dart.target === "BULL") return dart.multiplier === 2 ? "D.Bull" : "Bull"
  const prefix = dart.multiplier === 3 ? "T" : dart.multiplier === 2 ? "D" : "S"
  return `${prefix}${dart.target}`
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

  const activePlayer = players[currentPlayerIndex]
  const isMyTurn = isLocal || (myPlayerId && activePlayer?.playerId === myPlayerId)
  const canInput = canControl && isMyTurn && status === "IN_PROGRESS"

  if (!activePlayer) return null

  function addDart(target: CricketTarget, multiplier: 1 | 2 | 3) {
    if (pendingDarts.length >= 3) return
    announceCricketDart(target, multiplier)
    setPendingDarts((d) => [...d, { target, multiplier }])
  }

  async function handleSubmit() {
    if (pendingDarts.length === 0) return
    const dartsToSubmit = pendingDarts
    await submitTurn(dartsToSubmit)
    setPendingDarts([])
    const marksTotal = dartsToSubmit.reduce((sum, d) => sum + d.multiplier, 0)
    if (marksTotal >= replayMarksThreshold && onReplayTrigger) {
      onReplayTrigger(activePlayer.playerId, `${marksTotal} marks!`, { marksTotal, darts: dartsToSubmit })
    }
  }

  function handleMiss() {
    submitTurn([])
    setPendingDarts([])
  }

  // Simulate points preview for pending darts
  function getPreviewPoints(): number {
    let preview = 0
    const tempMarks = JSON.parse(JSON.stringify(marks)) as typeof marks
    const allPlayerIds = players.map((p) => p.playerId)
    for (const dart of pendingDarts) {
      const { target, multiplier } = dart
      const current = tempMarks[activePlayer.playerId]?.[target] ?? 0
      if (current >= 3) {
        const opponentsAllClosed = allPlayerIds
          .filter((pid) => pid !== activePlayer.playerId)
          .every((pid) => (tempMarks[pid]?.[target] ?? 0) >= 3)
        if (!opponentsAllClosed) preview += TARGET_VALUE[target] * multiplier
      } else {
        const newTotal = current + multiplier
        if (newTotal > 3) {
          const overflow = newTotal - 3
          const opponentsAllClosed = allPlayerIds
            .filter((pid) => pid !== activePlayer.playerId)
            .every((pid) => (tempMarks[pid]?.[target] ?? 0) >= 3)
          if (!opponentsAllClosed) preview += TARGET_VALUE[target] * overflow
        }
        if (!tempMarks[activePlayer.playerId]) tempMarks[activePlayer.playerId] = {}
        tempMarks[activePlayer.playerId][target] = newTotal
      }
    }
    return preview
  }

  function getCellState(target: CricketTarget) {
    const myMarks = marks[activePlayer.playerId]?.[target] ?? 0
    const isClosed = myMarks >= 3
    const allOppsClosed = players
      .filter((p) => p.playerId !== activePlayer.playerId)
      .every((p) => (marks[p.playerId]?.[target] ?? 0) >= 3)
    return { isClosed, canScore: isClosed && !allOppsClosed, allDone: isClosed && allOppsClosed }
  }

  const full = pendingDarts.length >= 3

  return (
    <div className="flex flex-col gap-3 p-4">

      {/* ── Player score strip ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {players.map((p, i) => {
          const isActive = i === currentPlayerIndex
          return (
            <div
              key={p.playerId}
              className={cn(
                "shrink-0 rounded-xl border p-3 flex flex-col gap-2 min-w-[148px]",
                isActive ? "border-primary/50 bg-primary/10" : "border-border bg-card",
              )}
            >
              <div className="flex items-center gap-2">
                <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                <div>
                  <p className="text-xs font-semibold leading-none truncate max-w-[80px]">{p.name.split(" ")[0]}</p>
                  <p className={cn("font-score text-2xl font-black leading-tight", isActive ? "text-primary" : "text-foreground")}>
                    {points[p.playerId] ?? 0}
                  </p>
                </div>
              </div>
              {/* Mini mark board */}
              <div className="flex gap-2">
                {CRICKET_TARGETS.map((t) => (
                  <div key={t} className="flex flex-col items-center gap-0.5">
                    <MarkIcon marks={Math.min(marks[p.playerId]?.[t] ?? 0, 3)} />
                    <span className="text-[8px] text-zinc-600 leading-none">{t === "BULL" ? "BL" : t}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Game over ── */}
      {status === "COMPLETED" && (
        <div className="rounded-xl bg-primary/10 border border-primary/30 p-4 text-center">
          <p className="font-bold text-lg">Game Over!</p>
          <p className="text-sm text-muted-foreground">
            {winnerId ? `${players.find((p) => p.playerId === winnerId)?.name} wins!` : "Draw!"}
          </p>
        </div>
      )}

      {/* ── Scoring input ── */}
      {status === "IN_PROGRESS" && (
        <>
          {/* Turn label */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-black uppercase tracking-widest text-foreground">
              {activePlayer.name.split(" ")[0]}&apos;s turn
            </p>
            {canInput && (
              <span className="text-xs text-muted-foreground">
                dart {pendingDarts.length + 1} of 3
              </span>
            )}
          </div>

          {canInput ? (
            <>
              {/* Dart chips + undo dart + submit */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 flex-1">
                  {Array.from({ length: 3 }).map((_, i) => {
                    const dart = pendingDarts[i]
                    return dart ? (
                      <div
                        key={i}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg border text-center text-xs font-bold",
                          dart.multiplier === 3
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                            : dart.multiplier === 2
                            ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                            : "bg-zinc-700/60 border-zinc-600 text-zinc-300",
                        )}
                      >
                        {dartLabel(dart)}
                      </div>
                    ) : (
                      <div
                        key={i}
                        className="flex-1 py-1.5 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center"
                      >
                        <span className="text-zinc-700 text-xs">─</span>
                      </div>
                    )
                  })}
                </div>

                {getPreviewPoints() > 0 && (
                  <span className="text-xs font-bold text-amber-400 shrink-0">+{getPreviewPoints()}</span>
                )}

                {pendingDarts.length > 0 && (
                  <button
                    onClick={() => setPendingDarts((d) => d.slice(0, -1))}
                    className="p-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 active:scale-95 transition-all"
                    aria-label="Undo last dart"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={pendingDarts.length === 0}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all disabled:opacity-30"
                >
                  Submit
                </button>
              </div>

              {/* ── Target grid ── */}
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                {/* Column headers */}
                <div className="grid grid-cols-3 border-b border-zinc-800 bg-zinc-900/80">
                  {(["Single", "Double", "Triple"] as const).map((h) => (
                    <div key={h} className="py-1.5 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      {h}
                    </div>
                  ))}
                </div>

                {/* Rows 20–15 */}
                {NUMBER_TARGETS.map((target) => {
                  const { canScore, allDone } = getCellState(target)
                  const pv = TARGET_VALUE[target]
                  return (
                    <div key={target} className="grid grid-cols-3 border-b border-zinc-800/60 last:border-0">
                      {([1, 2, 3] as const).map((mult) => (
                        <button
                          key={mult}
                          onClick={() => addDart(target, mult)}
                          disabled={full}
                          className={cn(
                            "flex flex-col items-center justify-center py-3.5 gap-0.5",
                            "border-r border-zinc-800/60 last:border-0",
                            "transition-all active:scale-95 disabled:opacity-40",
                            allDone
                              ? "bg-zinc-900/60 text-zinc-600"
                              : canScore
                              ? "bg-amber-500/15 hover:bg-amber-500/25"
                              : "bg-zinc-800/30 hover:bg-zinc-700/50",
                          )}
                        >
                          <span className={cn(
                            "text-lg font-black",
                            allDone ? "text-zinc-600" : canScore ? "text-amber-200" : "text-zinc-100",
                          )}>
                            {target}
                          </span>
                          {canScore ? (
                            <span className="text-[10px] font-bold text-amber-400">+{pv * mult}</span>
                          ) : (
                            <span className={cn("text-[11px]", allDone ? "text-zinc-700" : "text-zinc-500")}>
                              {"·".repeat(mult)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                })}

                {/* Bull row — 2 cells */}
                {(() => {
                  const { canScore, allDone } = getCellState("BULL" as CricketTarget)
                  const pv = 25
                  return (
                    <div className="grid grid-cols-2">
                      {([1, 2] as const).map((mult) => (
                        <button
                          key={mult}
                          onClick={() => addDart("BULL" as CricketTarget, mult)}
                          disabled={full}
                          className={cn(
                            "flex flex-col items-center justify-center py-3.5 gap-0.5",
                            "border-r border-zinc-800/60 last:border-0",
                            "transition-all active:scale-95 disabled:opacity-40",
                            allDone
                              ? "bg-zinc-900/60 text-zinc-600"
                              : canScore
                              ? "bg-amber-500/15 hover:bg-amber-500/25"
                              : "bg-zinc-800/30 hover:bg-zinc-700/50",
                          )}
                        >
                          <span className={cn(
                            "text-base font-black",
                            allDone ? "text-zinc-600" : canScore ? "text-amber-200" : "text-zinc-100",
                          )}>
                            {mult === 1 ? "Bull" : "D.Bull"}
                          </span>
                          {canScore ? (
                            <span className="text-[10px] font-bold text-amber-400">+{pv * mult}</span>
                          ) : (
                            <span className={cn("text-[11px]", allDone ? "text-zinc-700" : "text-zinc-500")}>
                              {"·".repeat(mult)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* Miss + undo last turn */}
              {pendingDarts.length === 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleMiss}
                    className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:border-primary/30 active:scale-95 transition-all"
                  >
                    Miss — no hits
                  </button>
                  {canControl && lastRoundId && (
                    <button
                      onClick={() => undoLastRound()}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:text-foreground transition-colors"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Undo turn
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">
              Waiting for {activePlayer.name}…
            </p>
          )}
        </>
      )}
    </div>
  )
}
