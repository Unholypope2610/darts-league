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

const BG_CLS: Record<Colour, string> = {
  black: "bg-zinc-800 border-zinc-600",
  white: "bg-zinc-100 border-zinc-300",
  red: "bg-red-500 border-red-600",
  green: "bg-emerald-500 border-emerald-600",
}
const TEXT_CLS: Record<Colour, string> = {
  black: "text-white",
  white: "text-zinc-900",
  red: "text-white",
  green: "text-white",
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
  onAdd: (pts: number, detail: { segment: "single" | "double" | "treble"; number: number }) => void
  dartCount: number
}
function NumberKeypad({ value, onAdd, dartCount }: NumberKeypadProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground text-center">Shoot at {value}</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: `S${value}`, pts: value,     seg: "single"  as const },
          { label: `D${value}`, pts: value * 2, seg: "double"  as const },
          { label: `T${value}`, pts: value * 3, seg: "treble"  as const },
        ].map(({ label, pts, seg }) => (
          <button
            key={label}
            onClick={() => onAdd(pts, { segment: seg, number: value })}
            disabled={dartCount >= 3}
            className="py-6 rounded-xl border border-border bg-card font-bold text-lg hover:border-primary/40 hover:bg-primary/10 active:scale-95 transition-all disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Doubles / trebles grid (colour-coded by ring colour) ─────────────────────
interface RingKeypadProps {
  mode: "doubles" | "trebles"
  onAdd: (pts: number, detail: { segment: "double" | "treble" | "bull"; number: number }) => void
  dartCount: number
}
function RingKeypad({ mode, onAdd, dartCount }: RingKeypadProps) {
  const numbers = Array.from({ length: 20 }, (_, i) => i + 1)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground text-center">
        Shoot at a {mode === "doubles" ? "Double" : "Treble"}
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {numbers.map((n) => {
          const col = RING_COLOURS[n] ?? "red"
          const pts = mode === "doubles" ? n * 2 : n * 3
          const seg = mode === "doubles" ? "double" : "treble"
          return (
            <button
              key={n}
              onClick={() => onAdd(pts, { segment: seg, number: n })}
              disabled={dartCount >= 3}
              className={cn(
                "flex flex-col items-center py-2.5 rounded-xl border-2 font-bold active:scale-95 transition-all disabled:opacity-30",
                BG_CLS[col], TEXT_CLS[col]
              )}
            >
              <span className={n >= 10 ? "text-base font-black leading-none" : "text-sm leading-none"}>{n}</span>
              <span className={cn("opacity-80 leading-none", pts >= 30 ? "text-xs" : "text-[10px]")}>{pts}</span>
            </button>
          )
        })}
      </div>
      {/* Double Bull — only valid in doubles rounds */}
      {mode === "doubles" && (
        <button
          onClick={() => onAdd(50, { segment: "bull", number: 25 })}
          disabled={dartCount >= 3}
          className="py-3 rounded-xl border-2 border-red-600 bg-red-500 text-white font-bold text-base active:scale-95 transition-all disabled:opacity-30"
        >
          Bull · 50
        </button>
      )}
    </div>
  )
}

// ─── Colour keypad (tabbed: Single / Double / Treble / Bull / Outer) ──────────
type ColourTab = "single" | "double" | "treble" | "bull" | "outer"

interface ColourKeypadProps {
  onAdd: (pts: number, detail: { segment: "single" | "double" | "treble" | "bull" | "outer"; number: number }) => void
  dartCount: number
}
function ColourKeypad({ onAdd, dartCount }: ColourKeypadProps) {
  const [tab, setTab] = useState<ColourTab>("single")
  const numbers = Array.from({ length: 20 }, (_, i) => i + 1)

  const TABS: { key: ColourTab; label: string; sub?: string }[] = [
    { key: "single", label: "Single" },
    { key: "double", label: "Double" },
    { key: "treble", label: "Treble" },
    { key: "bull", label: "Bull", sub: "50" },
    { key: "outer", label: "Outer", sub: "25" },
  ]

  function handleTap(n: number) {
    if (dartCount >= 3) return
    if (tab === "bull") {
      onAdd(50, { segment: "bull", number: 25 })
    } else if (tab === "outer") {
      onAdd(25, { segment: "outer", number: 25 })
    } else {
      const pts = tab === "single" ? n : tab === "double" ? n * 2 : n * 3
      onAdd(pts, { segment: tab, number: n })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Tab bar */}
      <div className="grid grid-cols-5 gap-0.5 rounded-xl bg-zinc-900 p-1">
        {TABS.map(({ key, label, sub }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex flex-col items-center py-1.5 rounded-lg leading-tight transition-all",
              tab === key ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <span className="text-[11px] font-bold">{label}</span>
            {sub && <span className="text-[9px] opacity-70">{sub}</span>}
          </button>
        ))}
      </div>

      {/* Bull / Outer: single large tap target */}
      {(tab === "bull" || tab === "outer") ? (
        <button
          onClick={() => handleTap(0)}
          disabled={dartCount >= 3}
          className={cn(
            "py-10 rounded-xl border-2 font-black text-5xl active:scale-95 transition-all disabled:opacity-30",
            tab === "bull" ? `${BG_CLS.red} ${TEXT_CLS.red}` : `${BG_CLS.green} ${TEXT_CLS.green}`
          )}
        >
          {tab === "bull" ? "50" : "25"}
        </button>
      ) : (
        /* Single / Double / Treble: 4×5 colour-coded number grid */
        <div className="grid grid-cols-5 gap-1.5">
          {numbers.map((n) => {
            const col = getSegmentColour(tab, n)
            const pts = tab === "single" ? n : tab === "double" ? n * 2 : n * 3
            return (
              <button
                key={n}
                onClick={() => handleTap(n)}
                disabled={dartCount >= 3}
                className={cn(
                  "flex flex-col items-center py-2 rounded-lg border-2 font-bold active:scale-95 transition-all disabled:opacity-30",
                  BG_CLS[col], TEXT_CLS[col]
                )}
              >
                <span className={n >= 10 ? "text-base font-black leading-none" : "text-sm leading-none"}>{n}</span>
                <span className={cn("opacity-75 leading-none", pts >= 30 ? "text-xs" : "text-[10px]")}>{pts}</span>
              </button>
            )
          })}
        </div>
      )}

    </div>
  )
}

// ─── Wildcard keypad ──────────────────────────────────────────────────────────
interface WildcardKeypadProps {
  targets: [number, number]
  onSubmit: (score: number) => void
  onMiss: () => void
}
function WildcardKeypad({ targets, onSubmit, onMiss }: WildcardKeypadProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {[targets[0], targets[1], "121+" as const].map((t) => (
          <button
            key={String(t)}
            onClick={() => onSubmit(t === "121+" ? 121 : t)}
            className="py-8 rounded-xl border border-border bg-card font-score text-3xl font-black transition-all active:scale-95 hover:border-primary/30 hover:bg-primary/10"
          >
            {t}
          </button>
        ))}
      </div>
      <button
        onClick={onMiss}
        className="w-full py-3 rounded-xl border border-border text-muted-foreground font-bold text-sm hover:border-red-500/40 hover:text-red-400 transition-all active:scale-95"
      >
        MISS
      </button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
interface Props {
  sessionId: string
  myPlayerId: string | null
  canControl: boolean
  isLocal: boolean
  camIsStreaming?: boolean
  onReplayTrigger?: (playerId: string, label: string, context: Record<string, unknown>) => void
}

export function HalfItScoring({ myPlayerId, canControl, isLocal, camIsStreaming, onReplayTrigger }: Props) {
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

  const [pendingTotal, setPendingTotal] = useState(0)
  const [dartCount, setDartCount] = useState(0)
  const [dartDetails, setDartDetails] = useState<{ segment: "single" | "double" | "treble" | "bull" | "outer"; number: number }[]>([])

  const activePlayer = players[currentPlayerIndex]
  const currentTarget = targetSequence[currentRound - 1]
  const isMyTurn = isLocal || (myPlayerId && activePlayer?.playerId === myPlayerId)
  const canInput = canControl && isMyTurn && status === "IN_PROGRESS"

  if (!activePlayer || !currentTarget) return null

  const currentScore = scores[activePlayer.playerId] ?? 0

  function resetPending() {
    setPendingTotal(0)
    setDartCount(0)
    setDartDetails([])
  }

  type DartDetail = { segment: "single" | "double" | "treble" | "bull" | "outer"; number: number }

  async function doSubmit(total: number, details: DartDetail[]) {
    if (currentTarget.type === "3_DIFF_COLOURS" || currentTarget.type === "3_SAME_COLOUR") {
      const colours = details.map((d) => getSegmentColour(d.segment, d.number))
      const unique = new Set(colours)
      const conditionMet = currentTarget.type === "3_DIFF_COLOURS" ? unique.size === 3 : unique.size === 1
      const wasHalved = !conditionMet
      announceHalfItRound(currentTarget, total, wasHalved, wasHalved ? Math.floor(currentScore / 2) : currentScore + total)
      await submitRound(conditionMet ? total : 0, wasHalved, { colourConditionMet: conditionMet, dartDetails: details })
    } else {
      announceHalfItRound(currentTarget, total, false, currentScore + total)
      await submitRound(total, false, { dartDetails: details.length > 0 ? details : undefined })
    }
    resetPending()
  }

  function addDart(pts: number, detail?: DartDetail) {
    const newTotal = pendingTotal + pts
    const newCount = dartCount + 1
    const newDetails = detail ? [...dartDetails, detail] : dartDetails
    setPendingTotal(newTotal)
    setDartCount(newCount)
    if (detail) setDartDetails(newDetails)
    if (newCount >= 3 && currentTarget.type !== "WILDCARD") {
      void doSubmit(newTotal, newDetails)
    }
  }

  async function handleSubmit() {
    await doSubmit(pendingTotal, dartDetails)
  }

  async function handleMiss() {
    announceHalfItRound(currentTarget, 0, true, Math.floor(currentScore / 2))
    await submitRound(0, true, { colourConditionMet: false, dartDetails })
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

  // ─── Dart tracker helpers ──────────────────────────────────────────────────

  function detailLabel(d: DartDetail): string {
    if (d.segment === "bull") return "Bull"
    if (d.segment === "outer") return "Outer"
    const prefix = d.segment === "single" ? "S" : d.segment === "double" ? "D" : "T"
    return `${prefix}${d.number}`
  }

  function detailValue(d: DartDetail): number {
    if (d.segment === "bull") return 50
    if (d.segment === "outer") return 25
    if (d.segment === "double") return d.number * 2
    if (d.segment === "treble") return d.number * 3
    return d.number
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
            dartCount={dartCount}
          />
        )
      case "DOUBLES":
        return <RingKeypad mode="doubles" onAdd={addDart} dartCount={dartCount} />
      case "TREBLES":
        return <RingKeypad mode="trebles" onAdd={addDart} dartCount={dartCount} />
      case "BULL":
        return (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground text-center">Shoot at the Bull</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => addDart(25, { segment: "outer", number: 25 })} disabled={dartCount >= 3}
                className="py-6 rounded-xl border-2 border-emerald-500 bg-emerald-500 text-white font-bold text-lg active:scale-95 disabled:opacity-40">
                Outer 25
              </button>
              <button onClick={() => addDart(50, { segment: "bull", number: 25 })} disabled={dartCount >= 3}
                className="py-6 rounded-xl border-2 border-red-600 bg-red-500 text-white font-bold text-lg active:scale-95 disabled:opacity-40">
                Bull 50
              </button>
            </div>
          </div>
        )
      case "3_DIFF_COLOURS":
      case "3_SAME_COLOUR":
        return <ColourKeypad onAdd={addDart} dartCount={dartCount} />
      case "WILDCARD":
        return <WildcardKeypad targets={currentTarget.wildcardTargets ?? [42, 95]} onSubmit={handleWildcardSubmit} onMiss={handleMiss} />
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
          <p className="font-black text-lg text-emerald-400 uppercase">Your Target: {targetLabel(currentTarget)}</p>
          {currentTarget.type === "NUMBER" && (
            <p className="font-score font-black text-6xl text-emerald-400 leading-none mt-1">{currentTarget.value}</p>
          )}
          {currentTarget.type === "WILDCARD" && currentTarget.wildcardTargets && (
            <div className="flex gap-2 mt-2">
              {[currentTarget.wildcardTargets[0], currentTarget.wildcardTargets[1], "121+"].map((t) => (
                <span key={String(t)} className="px-3 py-1 rounded-lg border border-border bg-card font-score font-bold text-sm">{t}</span>
              ))}
            </div>
          )}
          {(currentTarget.type === "3_DIFF_COLOURS" || currentTarget.type === "3_SAME_COLOUR") && (() => {
            const COLS = [
              "bg-zinc-800 border-zinc-600",
              "bg-zinc-100 border-zinc-300",
              "bg-red-500 border-red-600",
              "bg-emerald-500 border-emerald-600",
            ]
            const isSame = currentTarget.type === "3_SAME_COLOUR"
            return (
              <div className="flex gap-2 mt-2">
                {COLS.map((baseCls, ci) => (
                  <div key={ci} className="flex flex-col gap-1">
                    {[0, 1, 2].map((row) => {
                      const cls = isSame ? baseCls : COLS[(ci + row) % 4]
                      return <div key={row} className={cn("w-3 h-3 rounded-full border", cls)} />
                    })}
                  </div>
                ))}
              </div>
            )
          })()}
          {camIsStreaming && canInput && onReplayTrigger && (
            <button
              onClick={() => onReplayTrigger(activePlayer.playerId, targetLabel(currentTarget), { target: targetLabel(currentTarget), autoSave: true })}
              className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 active:scale-95 transition-all"
            >
              ● Save Replay
            </button>
          )}
        </div>
      </div>

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
          {/* Dart tracker — shown for all non-WILDCARD rounds */}
          {canInput && currentTarget.type !== "WILDCARD" && (
            <div className="flex items-center gap-2">
              {Array.from({ length: 3 }).map((_, i) => {
                const d = dartDetails[i]
                if (d) {
                  const col = getSegmentColour(d.segment, d.number)
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 flex flex-col items-center py-1.5 rounded-lg border-2 font-bold",
                        BG_CLS[col], TEXT_CLS[col]
                      )}
                    >
                      <span className="text-xs font-black">{detailLabel(d)}</span>
                      <span className="text-[10px] opacity-80">{detailValue(d)}</span>
                    </div>
                  )
                }
                return (
                  <div
                    key={i}
                    className="flex-1 flex items-center justify-center py-1.5 rounded-lg border-2 border-dashed border-zinc-700"
                  >
                    <span className="text-zinc-700 text-lg">○</span>
                  </div>
                )
              })}
              <div className="flex flex-col items-end shrink-0 min-w-[48px]">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Total</span>
                <span className="font-score font-black text-xl text-foreground">{pendingTotal}</span>
              </div>
            </div>
          )}

          {renderKeypad()}

          {needsSubmitButton && (
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleMiss}
                disabled={dartCount > 0}
                className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-bold text-sm hover:border-red-500/40 hover:text-red-400 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
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

      {/* Score log */}
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
                          <span className={
                            pr.wasHalved ? "text-red-400"
                            : pr.pointsScored > 0 ? "text-emerald-400"
                            : "text-muted-foreground"
                          }>
                            {pr.wasHalved ? "÷2" : pr.pointsScored > 0 ? `+${pr.pointsScored}` : "0"}
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
    </div>
  )
}
