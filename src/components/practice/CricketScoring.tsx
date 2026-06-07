"use client"

import { useState } from "react"
import { useCricketStore, CRICKET_TARGETS } from "@/stores/cricket.store"
import type { CricketTarget } from "@/stores/cricket.store"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { cn } from "@/lib/utils/cn"
import { Undo2 } from "lucide-react"
import type { CricketDart } from "@/types/api"
import { announceCricketScore } from "@/lib/utils/speech"

const TARGET_VALUE: Record<string, number> = {
  "20": 20, "19": 19, "18": 18, "17": 17, "16": 16, "15": 15, "BULL": 25,
}

const NUMBER_TARGETS = ["20", "19", "18", "17", "16", "15"] as CricketTarget[]

function MarkIcon({ marks, large }: { marks: number; large?: boolean }) {
  const cls = large ? "text-xl leading-none select-none" : "text-sm leading-none select-none"
  if (marks === 0) return <span className={cn("text-zinc-600", cls)}>─</span>
  if (marks === 1) return <span className={cn("text-zinc-300 font-bold", cls)}>/</span>
  if (marks === 2) return <span className={cn("text-yellow-400 font-bold", cls)}>X</span>
  return <span className={cn("text-emerald-400 font-black", cls)}>⊗</span>
}

function Dots({ count, dim }: { count: number; dim?: boolean }) {
  return (
    <div className="flex gap-[3px] items-center justify-center">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn("w-[5px] h-[5px] rounded-full", dim ? "bg-zinc-700" : "bg-zinc-400")} />
      ))}
    </div>
  )
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

  const isTwoPlayer = players.length === 2
  const p0 = players[0]
  const p1 = players[1]

  function getCellState(target: CricketTarget) {
    const myMarks = marks[activePlayer.playerId]?.[target] ?? 0
    const isClosed = myMarks >= 3
    const allOppsClosed = players
      .filter((p) => p.playerId !== activePlayer.playerId)
      .every((p) => (marks[p.playerId]?.[target] ?? 0) >= 3)
    return { isClosed, canScore: isClosed && !allOppsClosed, allDone: isClosed && allOppsClosed }
  }

  function computePointsForDarts(darts: CricketDart[]): number {
    let total = 0
    const tempMarks = JSON.parse(JSON.stringify(marks)) as typeof marks
    const allPlayerIds = players.map((p) => p.playerId)
    for (const { target, multiplier } of darts) {
      const current = tempMarks[activePlayer.playerId]?.[target] ?? 0
      if (current >= 3) {
        const allOppsClosed = allPlayerIds
          .filter((pid) => pid !== activePlayer.playerId)
          .every((pid) => (tempMarks[pid]?.[target] ?? 0) >= 3)
        if (!allOppsClosed) total += TARGET_VALUE[target] * multiplier
      } else {
        const newTotal = current + multiplier
        if (newTotal > 3) {
          const overflow = newTotal - 3
          const allOppsClosed = allPlayerIds
            .filter((pid) => pid !== activePlayer.playerId)
            .every((pid) => (tempMarks[pid]?.[target] ?? 0) >= 3)
          if (!allOppsClosed) total += TARGET_VALUE[target] * overflow
        }
        if (!tempMarks[activePlayer.playerId]) tempMarks[activePlayer.playerId] = {}
        tempMarks[activePlayer.playerId][target] = newTotal
      }
    }
    return total
  }

  async function handleSubmitDarts(darts: CricketDart[]) {
    const pointsScored = computePointsForDarts(darts)
    await submitTurn(darts)
    setPendingDarts([])
    if (pointsScored > 0) announceCricketScore(pointsScored)
    const marksTotal = darts.reduce((sum, d) => sum + d.multiplier, 0)
    if (marksTotal >= replayMarksThreshold && onReplayTrigger) {
      onReplayTrigger(activePlayer.playerId, `${marksTotal} marks!`, { marksTotal, darts })
    }
  }

  function addDart(target: CricketTarget, multiplier: 1 | 2 | 3) {
    if (pendingDarts.length >= 3) return
    const newDarts: CricketDart[] = [...pendingDarts, { target, multiplier }]
    setPendingDarts(newDarts)
    if (newDarts.length === 3) void handleSubmitDarts(newDarts)
  }

  async function handleSubmit() {
    if (pendingDarts.length === 0) return
    await handleSubmitDarts(pendingDarts)
  }

  function handleMiss() {
    void handleSubmitDarts([])
  }

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

  const full = pendingDarts.length >= 3

  return (
    <div className="flex flex-col gap-3 p-4">

      {/* ── Scoreboard ── */}
      {isTwoPlayer ? (
        // 2-player: split panel, no mini mark board (grid shows marks for both)
        <div className="grid grid-cols-2 rounded-xl border border-border overflow-hidden">
          {players.map((p, i) => {
            const isActive = i === currentPlayerIndex
            return (
              <div
                key={p.playerId}
                className={cn(
                  "flex flex-col p-3 gap-1",
                  isActive ? "bg-primary/10" : "bg-card",
                  i === 0 ? "border-r border-border" : "",
                )}
              >
                <div className="flex items-center gap-1.5">
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                  <p className="text-xs font-semibold truncate">{p.name.split(" ")[0]}</p>
                </div>
                <p className={cn(
                  "font-score font-black leading-none",
                  isActive ? "text-5xl text-primary" : "text-4xl text-foreground/80",
                )}>
                  {points[p.playerId] ?? 0}
                </p>
              </div>
            )
          })}
        </div>
      ) : (
        // 3+ players: horizontal scroll cards with mini mark board
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
                <div className="flex gap-1.5">
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
      )}

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
          <div className="flex items-center justify-between">
            <p className="text-sm font-black uppercase tracking-widest text-foreground">
              {activePlayer.name.split(" ")[0]}&apos;s turn
            </p>
            {canInput && (
              <span className="text-xs text-muted-foreground">dart {pendingDarts.length + 1} of 3</span>
            )}
          </div>

          {canInput ? (
            <>
              {/* Dart chip strip */}
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
                      <div key={i} className="flex-1 py-1.5 rounded-lg border-2 border-dashed border-zinc-800 flex items-center justify-center">
                        <span className="text-zinc-700 text-xs">─</span>
                      </div>
                    )
                  })}
                </div>

                {getPreviewPoints() > 0 && (
                  <span className="text-xs font-bold text-amber-400 shrink-0">+{getPreviewPoints()}</span>
                )}

                {pendingDarts.length > 0 && !full && (
                  <button
                    onClick={() => setPendingDarts((d) => d.slice(0, -1))}
                    className="p-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 active:scale-95 transition-all"
                    aria-label="Undo last dart"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {pendingDarts.length > 0 && !full && (
                  <button
                    onClick={handleSubmit}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all"
                  >
                    Submit
                  </button>
                )}
              </div>

              {/* ── Target grid ── */}
              <div className="rounded-xl border border-zinc-800 overflow-hidden">

                {/* Number rows 20–15 */}
                {NUMBER_TARGETS.map((target) => {
                  const { canScore, allDone } = getCellState(target)
                  const pv = TARGET_VALUE[target]

                  // Mark counts for both players (2-player) or just active (3+)
                  const leftMarks  = Math.min(marks[p0?.playerId]?.[target] ?? 0, 3)
                  const rightMarks = isTwoPlayer ? Math.min(marks[p1?.playerId]?.[target] ?? 0, 3) : null
                  const activeMarks = Math.min(marks[activePlayer.playerId]?.[target] ?? 0, 3)

                  return (
                    <div
                      key={target}
                      className={cn(
                        "flex border-b border-zinc-800/50",
                        allDone && "opacity-50",
                      )}
                    >
                      {/* Left marks column — Player 0 (2-player) or active player (3+) */}
                      <div className="w-10 shrink-0 flex items-center justify-center border-r border-zinc-800/50 bg-zinc-900/60">
                        <MarkIcon marks={isTwoPlayer ? leftMarks : activeMarks} large />
                      </div>

                      {/* Single / Double / Triple tap cells */}
                      {([1, 2, 3] as const).map((mult) => (
                        <button
                          key={mult}
                          onClick={() => addDart(target, mult)}
                          disabled={full || allDone}
                          className={cn(
                            "flex-1 flex flex-col items-center justify-center py-[9px] gap-[3px]",
                            "border-r border-zinc-800/50",
                            "transition-colors active:scale-95",
                            allDone
                              ? "cursor-not-allowed"
                              : canScore
                              ? "bg-amber-500/15 active:bg-amber-500/30"
                              : "active:bg-zinc-700/60",
                            full && !allDone && "opacity-40",
                          )}
                        >
                          <span className={cn(
                            "text-[14px] font-black leading-none",
                            allDone ? "text-zinc-600 line-through decoration-zinc-600" : canScore ? "text-amber-200" : "text-zinc-100",
                          )}>
                            {target}
                          </span>
                          {canScore ? (
                            <span className="text-[10px] font-bold text-amber-400 leading-none">+{pv * mult}</span>
                          ) : (
                            <Dots count={mult} dim={allDone} />
                          )}
                        </button>
                      ))}

                      {/* Right marks column — Player 1 (2-player only) */}
                      {isTwoPlayer && (
                        <div className="w-10 shrink-0 flex items-center justify-center border-l border-zinc-800/50 bg-zinc-900/60">
                          <MarkIcon marks={rightMarks!} large />
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Bull row */}
                {(() => {
                  const { canScore, allDone } = getCellState("BULL" as CricketTarget)
                  const leftMarks  = Math.min(marks[p0?.playerId]?.["BULL"] ?? 0, 3)
                  const rightMarks = isTwoPlayer ? Math.min(marks[p1?.playerId]?.["BULL"] ?? 0, 3) : null
                  const activeMarks = Math.min(marks[activePlayer.playerId]?.["BULL"] ?? 0, 3)

                  return (
                    <div className={cn("flex", allDone && "opacity-50")}>
                      {/* Left marks */}
                      <div className="w-10 shrink-0 flex items-center justify-center border-r border-zinc-800/50 bg-zinc-900/60">
                        <MarkIcon marks={isTwoPlayer ? leftMarks : activeMarks} large />
                      </div>

                      {/* Bull / D.Bull */}
                      {([1, 2] as const).map((mult) => (
                        <button
                          key={mult}
                          onClick={() => addDart("BULL" as CricketTarget, mult)}
                          disabled={full || allDone}
                          className={cn(
                            "flex-1 flex flex-col items-center justify-center py-[9px] gap-[3px]",
                            "border-r border-zinc-800/50",
                            "transition-colors active:scale-95",
                            allDone
                              ? "cursor-not-allowed"
                              : canScore
                              ? "bg-amber-500/15 active:bg-amber-500/30"
                              : "active:bg-zinc-700/60",
                            full && !allDone && "opacity-40",
                          )}
                        >
                          <span className={cn(
                            "text-[13px] font-black leading-none",
                            allDone ? "text-zinc-600 line-through decoration-zinc-600" : canScore ? "text-amber-200" : "text-zinc-100",
                          )}>
                            {mult === 1 ? "Bull" : "D.Bull"}
                          </span>
                          {canScore ? (
                            <span className="text-[10px] font-bold text-amber-400 leading-none">+{25 * mult}</span>
                          ) : (
                            <Dots count={mult} dim={allDone} />
                          )}
                        </button>
                      ))}

                      {/* Right marks */}
                      {isTwoPlayer && (
                        <div className="w-10 shrink-0 flex items-center justify-center border-l border-zinc-800/50 bg-zinc-900/60">
                          <MarkIcon marks={rightMarks!} large />
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              {pendingDarts.length === 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleMiss}
                    className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:border-zinc-600 active:scale-95 transition-all"
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
