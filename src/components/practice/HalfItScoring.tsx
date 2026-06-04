"use client"

import { useState } from "react"
import { useHalfItStore } from "@/stores/halfit.store"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { cn } from "@/lib/utils/cn"
import { Undo2 } from "lucide-react"
import type { HalfItTarget } from "@/types/api"
import { announceHalfItRound } from "@/lib/utils/speech"

// ─── Colour lookup ────────────────────────────────────────────────────────────
type Colour = "black" | "white" | "red" | "green"

const SINGLE_COLOURS: Record<number, Colour> = {
  20: "black", 1: "white", 18: "black", 4: "white", 13: "black",
  6: "white", 10: "black", 15: "white", 2: "black", 17: "white",
  3: "black", 19: "white", 7: "black", 16: "white", 8: "black",
  11: "white", 14: "black", 9: "white", 12: "black", 5: "white",
}
const RING_COLOURS: Record<number, Colour> = {
  20: "red", 1: "green", 18: "red", 4: "green", 13: "red",
  6: "green", 10: "red", 15: "green", 2: "red", 17: "green",
  3: "red", 19: "green", 7: "red", 16: "green", 8: "red",
  11: "green", 14: "red", 9: "green", 12: "red", 5: "green",
}

function getSegmentColour(segment: "single" | "double" | "treble" | "bull" | "outer", number: number): Colour {
  if (segment === "bull") return "red"
  if (segment === "outer") return "green"
  if (segment === "single") return SINGLE_COLOURS[number] ?? "black"
  return RING_COLOURS[number] ?? "red"
}

function targetLabel(t: HalfItTarget): string {
  if (t.type === "NUMBER") return String(t.value)
  if (t.type === "DOUBLES") return "Doubles"
  if (t.type === "TREBLES") return "Trebles"
  if (t.type === "BULL") return "Bull"
  if (t.type === "3_DIFF_COLOURS") return "3 Diff Colours"
  if (t.type === "3_SAME_COLOUR") return "3 Same Colour"
  if (t.type === "WILDCARD") return "Exact Number"
  return t.type
}

// ─── Number keypad (S/D/T for one number) ─────────────────────────────────────
interface NumberKeypadProps {
  value: number
  onAdd: (pts: number) => void
  pendingTotal: number
  dartCount: number
}
function NumberKeypad({ value, onAdd, pendingTotal, dartCount }: NumberKeypadProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground text-center">Shot Instructions: Shoot at {value}</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: `S${value}`, pts: value },
          { label: `D${value}`, pts: value * 2 },
          { label: `T${value}`, pts: value * 3 },
        ].map(({ label, pts }) => (
          <button
            key={label}
            onClick={() => onAdd(pts)}
            disabled={dartCount >= 3}
            className="py-6 rounded-xl border border-border bg-card font-bold text-lg hover:border-primary/40 hover:bg-primary/10 active:scale-95 transition-all disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Running this turn: <span className="text-foreground font-bold">{pendingTotal}</span></p>
    </div>
  )
}

// ─── Full grid (doubles/trebles/colour) ────────────────────────────────────────
interface GridKeypadProps {
  mode: "doubles" | "trebles" | "colour"
  onAdd: (pts: number, dartDetail?: { segment: "single" | "double" | "treble" | "bull" | "outer"; number: number }) => void
  dartCount: number
  pendingTotal: number
}
function GridKeypad({ mode, onAdd, dartCount, pendingTotal }: GridKeypadProps) {
  const numbers = Array.from({ length: 20 }, (_, i) => i + 1)

  function handleTap(n: number) {
    if (mode === "doubles") onAdd(n * 2, { segment: "double", number: n })
    else if (mode === "trebles") onAdd(n * 3, { segment: "treble", number: n })
  }

  const COLOUR_DOT: Record<Colour, string> = {
    black: "bg-zinc-800 border-zinc-600",
    white: "bg-zinc-100 border-zinc-300",
    red: "bg-red-500 border-red-600",
    green: "bg-emerald-500 border-emerald-600",
  }

  return (
    <div className="flex flex-col gap-3">
      {mode !== "colour" && (
        <p className="text-sm text-muted-foreground text-center">
          Shoot at a {mode === "doubles" ? "Double" : "Treble"}
        </p>
      )}
      {mode === "colour" && (
        <p className="text-sm text-muted-foreground text-center">Select each dart&apos;s segment</p>
      )}

      {mode === "colour" ? (
        // Full 5-column grid: Single | Double | Treble | Bull | Outer
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="py-1 px-2 text-muted-foreground font-semibold text-left">Num</th>
                <th className="py-1 px-2 text-muted-foreground font-semibold text-center">Single</th>
                <th className="py-1 px-2 text-muted-foreground font-semibold text-center">Double</th>
                <th className="py-1 px-2 text-muted-foreground font-semibold text-center">Treble</th>
                <th className="py-1 px-2 text-muted-foreground font-semibold text-center">Bull</th>
                <th className="py-1 px-2 text-muted-foreground font-semibold text-center">Outer</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((n) => (
                <tr key={n} className="border-t border-border/30">
                  <td className="py-1.5 px-2 font-bold">{n}</td>
                  {(["single", "double", "treble"] as const).map((seg) => {
                    const col = getSegmentColour(seg, n)
                    const pts = seg === "single" ? n : seg === "double" ? n * 2 : n * 3
                    return (
                      <td key={seg} className="py-1 px-1 text-center">
                        <button
                          onClick={() => { onAdd(pts, { segment: seg, number: n }) }}
                          disabled={dartCount >= 3}
                          className={cn("w-8 h-7 rounded border-2 font-bold text-xs active:scale-95 transition-all disabled:opacity-30", COLOUR_DOT[col])}
                        >
                          {pts}
                        </button>
                      </td>
                    )
                  })}
                  {n === 1 ? (
                    <>
                      <td className="py-1 px-1 text-center">
                        <button onClick={() => onAdd(50, { segment: "bull", number: 25 })} disabled={dartCount >= 3}
                          className={cn("w-8 h-7 rounded border-2 font-bold text-xs active:scale-95 transition-all disabled:opacity-30", COLOUR_DOT.red)}>
                          50
                        </button>
                      </td>
                      <td className="py-1 px-1 text-center">
                        <button onClick={() => onAdd(25, { segment: "outer", number: 25 })} disabled={dartCount >= 3}
                          className={cn("w-8 h-7 rounded border-2 font-bold text-xs active:scale-95 transition-all disabled:opacity-30", COLOUR_DOT.green)}>
                          25
                        </button>
                      </td>
                    </>
                  ) : (
                    <><td /><td /></>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Doubles or trebles grid
        <div className="grid grid-cols-5 gap-1.5">
          {numbers.map((n) => {
            const pts = mode === "doubles" ? n * 2 : n * 3
            return (
              <button
                key={n}
                onClick={() => handleTap(n)}
                disabled={dartCount >= 3}
                className="flex flex-col items-center py-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/10 active:scale-95 transition-all disabled:opacity-40"
              >
                <span className="font-bold text-sm">{n}</span>
                <span className="text-[10px] text-muted-foreground">{pts}</span>
              </button>
            )
          })}
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">Running this turn: <span className="text-foreground font-bold">{pendingTotal}</span></p>
    </div>
  )
}

// ─── Wildcard keypad ──────────────────────────────────────────────────────────
interface WildcardKeypadProps {
  targets: [number, number]
  onSubmit: (score: number) => void
}
function WildcardKeypad({ targets, onSubmit }: WildcardKeypadProps) {
  const [input, setInput] = useState("")

  function handleTap(target: number | "121+") {
    if (target === "121+") {
      setInput("121")
    } else {
      setInput(String(target))
    }
  }

  function handleSubmit() {
    const n = parseInt(input, 10)
    if (isNaN(n)) return
    onSubmit(n)
    setInput("")
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-center">Shot Instructions: Score one of the exact numbers</p>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2">
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a score"
          className="flex-1 bg-transparent text-foreground outline-none text-sm"
        />
        <button
          onClick={handleSubmit}
          disabled={!input}
          className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40"
        >
          Submit
        </button>
      </div>

      {/* 3 target buttons */}
      <div className="grid grid-cols-3 gap-3">
        {[targets[0], targets[1], "121+" as const].map((t) => (
          <button
            key={String(t)}
            onClick={() => handleTap(t)}
            className={cn(
              "py-8 rounded-xl border font-score text-3xl font-black transition-all active:scale-95",
              input === String(t === "121+" ? 121 : t)
                ? "border-primary/50 bg-primary/20 text-primary"
                : "border-border bg-card hover:border-primary/30",
            )}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
interface Props { sessionId: string; myPlayerId: string | null; canControl: boolean; isLocal: boolean }

export function HalfItScoring({ myPlayerId, canControl, isLocal }: Props) {
  const players = useHalfItStore((s) => s.players)
  const currentPlayerIndex = useHalfItStore((s) => s.currentPlayerIndex)
  const currentRound = useHalfItStore((s) => s.currentRound)
  const targetSequence = useHalfItStore((s) => s.targetSequence)
  const scores = useHalfItStore((s) => s.scores)
  const rounds = useHalfItStore((s) => s.rounds)
  const status = useHalfItStore((s) => s.status)
  const winnerId = useHalfItStore((s) => s.winnerId)
  const lastRoundId = useHalfItStore((s) => s.lastRoundId)
  const submitRound = useHalfItStore((s) => s.submitRound)
  const undoLastRound = useHalfItStore((s) => s.undoLastRound)

  // Pending dart tracking for multi-dart rounds
  const [pendingTotal, setPendingTotal] = useState(0)
  const [dartCount, setDartCount] = useState(0)
  const [dartDetails, setDartDetails] = useState<{ segment: "single" | "double" | "treble" | "bull" | "outer"; number: number }[]>([])

  const activePlayer = players[currentPlayerIndex]
  const currentTarget = targetSequence[currentRound - 1]
  const isMyTurn = isLocal || (myPlayerId && activePlayer?.playerId === myPlayerId)
  const canInput = canControl && isMyTurn && status === "IN_PROGRESS"

  if (!activePlayer || !currentTarget) return null

  const currentScore = scores[activePlayer.playerId] ?? 0

  function addDart(pts: number, detail?: { segment: "single" | "double" | "treble" | "bull" | "outer"; number: number }) {
    setPendingTotal((t) => t + pts)
    setDartCount((c) => c + 1)
    if (detail) setDartDetails((d) => [...d, detail])
  }

  function resetPending() {
    setPendingTotal(0)
    setDartCount(0)
    setDartDetails([])
  }

  async function handleMiss() {
    announceHalfItRound(currentTarget, 0, true, Math.floor(currentScore / 2))
    await submitRound(0, true, { colourConditionMet: false, dartDetails })
    resetPending()
  }

  async function handleSubmit() {
    // Check colour condition if needed
    if (currentTarget.type === "3_DIFF_COLOURS" || currentTarget.type === "3_SAME_COLOUR") {
      const colours = dartDetails.map((d) => getSegmentColour(d.segment, d.number))
      const unique = new Set(colours)
      const conditionMet = currentTarget.type === "3_DIFF_COLOURS" ? unique.size === 3 : unique.size === 1
      const wasHalved = !conditionMet
      announceHalfItRound(currentTarget, pendingTotal, wasHalved, wasHalved ? Math.floor(currentScore / 2) : currentScore + pendingTotal)
      await submitRound(conditionMet ? pendingTotal : 0, wasHalved, { colourConditionMet: conditionMet, dartDetails })
    } else {
      announceHalfItRound(currentTarget, pendingTotal, false, currentScore + pendingTotal)
      await submitRound(pendingTotal, false, { dartDetails: dartDetails.length > 0 ? dartDetails : undefined })
    }
    resetPending()
  }

  async function handleWildcardSubmit(score: number) {
    const wc = currentTarget.wildcardTargets
    const t1 = wc?.[0] ?? 0
    const t2 = wc?.[1] ?? 0
    const match = score === t1 || score === t2 || score >= 121
    const wasHalved = !match
    announceHalfItRound(currentTarget, match ? score : 0, wasHalved, wasHalved ? Math.floor(currentScore / 2) : currentScore + score)
    await submitRound(match ? score : 0, wasHalved, { wildcardTargets: wc })
    resetPending()
  }

  function renderKeypad() {
    if (!canInput) {
      return (
        <p className="text-center text-sm text-muted-foreground py-8">
          Waiting for {activePlayer.name}…
        </p>
      )
    }

    switch (currentTarget.type) {
      case "NUMBER":
        return (
          <NumberKeypad
            value={currentTarget.value!}
            onAdd={addDart}
            pendingTotal={pendingTotal}
            dartCount={dartCount}
          />
        )
      case "DOUBLES":
        return <GridKeypad mode="doubles" onAdd={addDart} dartCount={dartCount} pendingTotal={pendingTotal} />
      case "TREBLES":
        return <GridKeypad mode="trebles" onAdd={addDart} dartCount={dartCount} pendingTotal={pendingTotal} />
      case "BULL":
        return (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground text-center">Shoot at the Bull</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => addDart(25, { segment: "outer", number: 25 })} disabled={dartCount >= 3}
                className="py-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold text-lg active:scale-95 disabled:opacity-40">
                Outer 25
              </button>
              <button onClick={() => addDart(50, { segment: "bull", number: 25 })} disabled={dartCount >= 3}
                className="py-6 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 font-bold text-lg active:scale-95 disabled:opacity-40">
                Bull 50
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground">Running: <span className="text-foreground font-bold">{pendingTotal}</span></p>
          </div>
        )
      case "3_DIFF_COLOURS":
      case "3_SAME_COLOUR":
        return <GridKeypad mode="colour" onAdd={addDart} dartCount={dartCount} pendingTotal={pendingTotal} />
      case "WILDCARD":
        return <WildcardKeypad targets={currentTarget.wildcardTargets ?? [42, 95]} onSubmit={handleWildcardSubmit} />
    }
  }

  const needsSubmitButton = currentTarget.type !== "WILDCARD" && canInput

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Active player card + shot instructions */}
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-emerald-600 p-4 flex flex-col items-center gap-1 min-w-[110px]">
          <PlayerAvatar name={activePlayer.name} avatarUrl={activePlayer.avatarUrl} size="md" />
          <p className="text-xs text-white/80 font-semibold">{activePlayer.name.split(" ")[0]}</p>
          <p className="font-score font-black text-4xl text-white">{currentScore}</p>
          <p className="text-[10px] text-white/60 uppercase tracking-wider">Total Score</p>
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Shot Instructions</p>
          <p className="font-black text-lg text-foreground uppercase">{targetLabel(currentTarget)}</p>
          {currentTarget.type === "WILDCARD" && currentTarget.wildcardTargets && (
            <div className="flex gap-2 mt-2">
              {[currentTarget.wildcardTargets[0], currentTarget.wildcardTargets[1], "121+"].map((t) => (
                <span key={String(t)} className="px-3 py-1 rounded-lg border border-border bg-card font-score font-bold text-sm">{t}</span>
              ))}
            </div>
          )}
          {(currentTarget.type === "3_DIFF_COLOURS" || currentTarget.type === "3_SAME_COLOUR") && (
            <div className="flex gap-2 mt-2">
              {(["black", "white", "red", "green"] as Colour[]).map((c) => (
                <div key={c} className={cn("w-5 h-5 rounded-full border-2", {
                  "bg-zinc-800 border-zinc-600": c === "black",
                  "bg-zinc-100 border-zinc-300": c === "white",
                  "bg-red-500 border-red-600": c === "red",
                  "bg-emerald-500 border-emerald-600": c === "green",
                })} />
              ))}
              <p className="text-xs text-muted-foreground ml-1">
                {currentTarget.type === "3_SAME_COLOUR" ? "All same" : "All different"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Target label */}
      <p className="text-lg font-black text-emerald-400 uppercase">
        Your Target: {targetLabel(currentTarget)}
      </p>

      {/* Other players scores strip */}
      {players.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {players.filter((_, i) => i !== currentPlayerIndex).map((p) => (
            <div key={p.playerId} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card shrink-0">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
              <div>
                <p className="text-xs font-semibold">{p.name.split(" ")[0]}</p>
                <p className="font-score text-sm font-bold">{scores[p.playerId] ?? 0}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Round history table (compact) */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 px-2 text-left text-muted-foreground font-semibold">Rnd</th>
              <th className="py-2 px-2 text-left text-muted-foreground font-semibold">Target</th>
              {players.map((p) => (
                <th key={p.playerId} className="py-2 px-2 text-right text-muted-foreground font-semibold">{p.name.split(" ")[0]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {targetSequence.map((t, idx) => {
              const roundNum = idx + 1
              const isCurrent = roundNum === currentRound
              const isPast = roundNum < currentRound
              return (
                <tr key={idx} className={cn("border-b border-border/30 last:border-0", isCurrent ? "bg-primary/5" : "")}>
                  <td className="py-1.5 px-2 font-semibold text-muted-foreground">{roundNum}</td>
                  <td className="py-1.5 px-2 font-semibold">{targetLabel(t)}</td>
                  {players.map((p) => {
                    const pr = rounds[p.playerId]?.[idx]
                    return (
                      <td key={p.playerId} className="py-1.5 px-2 text-right font-score">
                        {isCurrent && p.playerId === activePlayer.playerId ? (
                          <span className="text-primary">►</span>
                        ) : isPast && pr ? (
                          <span className={pr.wasHalved ? "text-red-400" : "text-foreground"}>
                            {pr.wasHalved ? `÷2=${pr.runningScore}` : pr.runningScore}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">─</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
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

      {/* Keypad */}
      {status === "IN_PROGRESS" && (
        <div className="flex flex-col gap-3">
          {renderKeypad()}

          {/* Submit + Miss buttons (not shown for wildcard — it handles its own) */}
          {needsSubmitButton && (
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleMiss}
                className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-bold text-sm hover:border-red-500/40 hover:text-red-400 transition-all active:scale-95"
              >
                MISS
              </button>
              {dartCount > 0 && (
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all"
                >
                  Submit ({dartCount} dart{dartCount !== 1 ? "s" : ""})
                </button>
              )}
            </div>
          )}

          {/* Remove last dart */}
          {dartCount > 0 && currentTarget.type !== "WILDCARD" && canInput && (
            <button
              onClick={() => {
                setPendingTotal((t) => {
                  const last = dartDetails[dartDetails.length - 1]
                  if (!last) return t
                  const val = last.segment === "bull" ? 50 : last.segment === "outer" ? 25
                    : last.segment === "double" ? last.number * 2
                    : last.segment === "treble" ? last.number * 3
                    : last.number
                  return t - val
                })
                setDartCount((c) => Math.max(0, c - 1))
                setDartDetails((d) => d.slice(0, -1))
              }}
              className="flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-muted-foreground text-xs hover:text-foreground transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Remove last dart
            </button>
          )}
        </div>
      )}

      {/* Undo last turn */}
      {canControl && lastRoundId && status === "IN_PROGRESS" && dartCount === 0 && (
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
