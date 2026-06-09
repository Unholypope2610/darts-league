"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useX01PracticeStore } from "@/stores/x01practice.store"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { getCheckoutSuggestionText } from "@/lib/algorithms/checkout-suggestions"
import { announceVisit } from "@/lib/utils/speech"
import { cn } from "@/lib/utils/cn"
import { Delete, Undo2, Bot, Loader2 } from "lucide-react"
import type { X01RoundData } from "@/types/api"

interface Props {
  sessionId: string
  myPlayerId: string | null
  canControl: boolean
}

function computeAvg(visits: X01RoundData[]): string {
  if (visits.length === 0) return "0.00"
  const totalScore = visits.reduce((s, v) => s + (v.isBust ? 0 : v.scoreThrown), 0)
  const totalDarts = visits.reduce((s, v) => s + v.dartsUsed, 0)
  if (totalDarts === 0) return "0.00"
  return ((totalScore / totalDarts) * 3).toFixed(2)
}

function computeLegDarts(visits: X01RoundData[]): number {
  return visits.reduce((s, v) => s + v.dartsUsed, 0)
}

export function X01Scoring({ myPlayerId, canControl }: Props) {
  const players = useX01PracticeStore((s) => s.players)
  const currentPlayerIndex = useX01PracticeStore((s) => s.currentPlayerIndex)
  const status = useX01PracticeStore((s) => s.status)
  const winnerId = useX01PracticeStore((s) => s.winnerId)
  const startingScore = useX01PracticeStore((s) => s.startingScore)
  const finishType = useX01PracticeStore((s) => s.finishType)
  const legsTarget = useX01PracticeStore((s) => s.legsTarget)
  const currentLeg = useX01PracticeStore((s) => s.currentLeg)
  const legsWon = useX01PracticeStore((s) => s.legsWon)
  const remainders = useX01PracticeStore((s) => s.remainders)
  const dartInput = useX01PracticeStore((s) => s.dartInput)
  const isTransitioning = useX01PracticeStore((s) => s.isTransitioning)
  const lastRoundId = useX01PracticeStore((s) => s.lastRoundId)
  const allVisits = useX01PracticeStore((s) => s.allVisits)
  const currentLegVisits = useX01PracticeStore((s) => s.currentLegVisits)
  const visitRoundIds = useX01PracticeStore((s) => s.visitRoundIds)
  const inputDigit = useX01PracticeStore((s) => s.inputDigit)
  const clearInput = useX01PracticeStore((s) => s.clearInput)
  const submitVisit = useX01PracticeStore((s) => s.submitVisit)
  const undoLastVisit = useX01PracticeStore((s) => s.undoLastVisit)
  const editVisit = useX01PracticeStore((s) => s.editVisit)

  const [pendingCheckout, setPendingCheckout] = useState<{ score: number } | null>(null)
  const [checkoutDartsUsed, setCheckoutDartsUsed] = useState(3)
  const [checkoutDoublesAttempted, setCheckoutDoublesAttempted] = useState<number | null>(null)

  // Doubles prompt for non-checkout visits (same conditions as live match)
  const [pendingDoubles, setPendingDoubles] = useState<{ score: number; isBust: boolean } | null>(null)
  const [doublesCount, setDoublesCount] = useState<number | null>(null)

  // Inline score edit
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState("")

  if (players.length === 0) return null

  const activePlayer = players[currentPlayerIndex]
  const opponent = players.find((p) => p.playerId !== activePlayer?.playerId)
  const botPlayer = players.find((p) => p.isBot)
  const humanPlayer = players.find((p) => !p.isBot)

  const isBotTurn = activePlayer?.isBot
  const isMyTurn = canControl && !isBotTurn
  const canInput = isMyTurn && status === "IN_PROGRESS" && !isTransitioning && !pendingCheckout && !pendingDoubles

  function needsDoublesTracking(prev: number, next: number, isBust: boolean): boolean {
    if (isBust) return true
    if (prev <= 50 && prev % 2 === 0) return true
    if (prev < 40 && prev % 2 !== 0) return true
    if (prev > 50 && next > 0 && next <= 50) return true
    if (prev % 2 !== 0 && prev > 40 && prev <= 50 && next > 0 && next < 40) return true
    return false
  }

  const activeRemainder = remainders[activePlayer?.playerId ?? ""] ?? startingScore
  const checkoutSuggestion = !isBotTurn && activeRemainder <= 170 && activeRemainder >= 2
    ? getCheckoutSuggestionText(activeRemainder)
    : null

  const scoreValue = parseInt(dartInput, 10) || 0
  const isCheckoutScore = scoreValue > 0 && scoreValue === activeRemainder

  async function handleSubmit() {
    if (!canInput || scoreValue > activeRemainder || scoreValue < 0) return
    if (isCheckoutScore) {
      setCheckoutDartsUsed(3)
      setCheckoutDoublesAttempted(null)
      setPendingCheckout({ score: scoreValue })
      return
    }
    const newRem = activeRemainder - scoreValue
    if (needsDoublesTracking(activeRemainder, newRem, false)) {
      setDoublesCount(null)
      setPendingDoubles({ score: scoreValue, isBust: false })
      return
    }
    const nextPlayerId = opponent?.playerId ?? ""
    const nextRemainder = remainders[nextPlayerId] ?? startingScore
    announceVisit(scoreValue, nextRemainder, opponent?.name ?? "", false, false)
    await submitVisit(scoreValue, 3, 0)
  }

  async function handleBust() {
    if (!canInput) return
    setDoublesCount(null)
    setPendingDoubles({ score: 0, isBust: true })
  }

  async function handleDoublesConfirm(da: number) {
    if (!pendingDoubles) return
    const fresh = useX01PracticeStore.getState()
    if (fresh.status !== "IN_PROGRESS" || fresh.isTransitioning || fresh.players[fresh.currentPlayerIndex]?.isBot) {
      setPendingDoubles(null)
      return
    }
    const { score, isBust } = pendingDoubles
    setPendingDoubles(null)
    const nextPlayerId = opponent?.playerId ?? ""
    const nextRemainder = remainders[nextPlayerId] ?? startingScore
    announceVisit(score, nextRemainder, opponent?.name ?? "", false, isBust)
    await submitVisit(score, 3, da)
  }

  async function handleCheckoutConfirm() {
    if (!pendingCheckout || checkoutDoublesAttempted === null) return
    const fresh = useX01PracticeStore.getState()
    if (fresh.status !== "IN_PROGRESS" || fresh.isTransitioning || fresh.players[fresh.currentPlayerIndex]?.isBot) {
      setPendingCheckout(null)
      return
    }
    const { score } = pendingCheckout
    setPendingCheckout(null)
    const nextPlayerId = opponent?.playerId ?? ""
    const nextRemainder = remainders[nextPlayerId] ?? startingScore
    announceVisit(score, nextRemainder, opponent?.name ?? "", true, false)
    await submitVisit(score, checkoutDartsUsed, checkoutDoublesAttempted)
  }

  async function handleCheckoutSkip() {
    if (!pendingCheckout) return
    const fresh = useX01PracticeStore.getState()
    if (fresh.status !== "IN_PROGRESS" || fresh.isTransitioning || fresh.players[fresh.currentPlayerIndex]?.isBot) {
      setPendingCheckout(null)
      return
    }
    const { score } = pendingCheckout
    setPendingCheckout(null)
    const nextPlayerId = opponent?.playerId ?? ""
    const nextRemainder = remainders[nextPlayerId] ?? startingScore
    announceVisit(score, nextRemainder, opponent?.name ?? "", true, false)
    await submitVisit(score, checkoutDartsUsed, 0)
  }

  const humanLegs = legsWon[humanPlayer?.playerId ?? ""] ?? 0
  const botLegs = legsWon[botPlayer?.playerId ?? ""] ?? 0

  if (status === "COMPLETED") {
    const winner = players.find((p) => p.playerId === winnerId)
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8 min-h-[300px]">
        <div className="text-5xl">{winner?.isBot ? "🤖" : "🏆"}</div>
        <div className="text-center">
          <p className="text-2xl font-black">{winner?.isBot ? "DartBot Wins!" : `${winner?.name} Wins!`}</p>
          <p className="text-muted-foreground text-sm mt-1">
            {humanLegs} – {botLegs}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-0 mx-4 mt-4 rounded-2xl border border-border overflow-hidden">
        {players.map((p, idx) => {
          const isActive = idx === currentPlayerIndex
          const rem = remainders[p.playerId] ?? startingScore
          const legs = legsWon[p.playerId] ?? 0
          const avg = computeAvg(allVisits[p.playerId] ?? [])
          const legDarts = computeLegDarts(currentLegVisits[p.playerId] ?? [])
          const legVisits = currentLegVisits[p.playerId] ?? []
          const recentVisits = legVisits.slice(-3)
          const allVisitsForPlayer = allVisits[p.playerId] ?? []
          const legStart = allVisitsForPlayer.length - legVisits.length
          const playerRoundIds = visitRoundIds[p.playerId] ?? []

          return (
            <div
              key={p.playerId}
              className={cn(
                "flex flex-col items-center gap-1.5 py-4 px-3 transition-all",
                isActive ? "bg-primary/10 border-primary/20" : "bg-muted/20",
                idx === 0 && "border-r border-border",
              )}
            >
              <div className="flex items-center gap-2">
                {p.isBot
                  ? <div className="size-8 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center"><Bot className="size-4 text-violet-400" /></div>
                  : <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
                }
                <div>
                  <p className="text-xs font-semibold truncate max-w-[80px]">
                    {p.isBot ? "DartBot" : p.name.split(" ")[0]}
                  </p>
                  {p.isBot && p.botLevel && (
                    <p className="text-[10px] text-violet-400">Lv.{p.botLevel}</p>
                  )}
                </div>
              </div>
              <p className={cn("font-score font-black leading-none", rem <= 170 ? "text-4xl text-emerald-400" : "text-4xl")}>
                {rem}
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {avg} avg · {legDarts}d
              </p>
              {/* Last 3 scores */}
              {recentVisits.length > 0 && (
                <div className="flex gap-1 flex-wrap justify-center">
                  {recentVisits.map((v, i) => {
                    const absIdx = legStart + (legVisits.length - recentVisits.length) + i
                    const roundId = playerRoundIds[absIdx]
                    const canEdit = !p.isBot && !v.isCheckout && !!roundId
                    if (canEdit && editingRoundId === roundId) {
                      return (
                        <div key={i} className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            max={180}
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const n = parseInt(editVal, 10)
                                if (!isNaN(n) && n >= 0 && n <= 180) editVisit(roundId, n)
                                setEditingRoundId(null)
                              }
                              if (e.key === "Escape") setEditingRoundId(null)
                            }}
                            className="w-10 bg-muted rounded px-1 py-0.5 text-xs font-score font-bold text-center border border-primary outline-none"
                          />
                          <button
                            onClick={() => {
                              const n = parseInt(editVal, 10)
                              if (!isNaN(n) && n >= 0 && n <= 180) editVisit(roundId, n)
                              setEditingRoundId(null)
                            }}
                            className="text-emerald-400 text-xs font-bold touch-manipulation"
                          >✓</button>
                          <button onClick={() => setEditingRoundId(null)} className="text-muted-foreground text-xs font-bold touch-manipulation">✕</button>
                        </div>
                      )
                    }
                    return (
                      <div key={i} className="flex items-center gap-0.5">
                        <span className={cn(
                          "font-score text-[10px] font-bold px-1.5 py-0.5 rounded",
                          v.isBust ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"
                        )}>
                          {v.isBust ? "BUST" : v.scoreThrown}
                        </span>
                        {canEdit && (
                          <button
                            onClick={() => { setEditVal(String(v.scoreThrown)); setEditingRoundId(roundId) }}
                            className="text-muted-foreground/50 hover:text-muted-foreground text-[9px] touch-manipulation leading-none"
                            aria-label="Edit score"
                          >✏</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex gap-1">
                {Array.from({ length: legsTarget }).map((_, i) => (
                  <div key={i} className={cn("size-2 rounded-full", i < legs ? "bg-primary" : "bg-muted border border-border")} />
                ))}
              </div>
              {isActive && !isBotTurn && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
              {isActive && isBotTurn && (
                <Loader2 className="size-3.5 text-violet-400 animate-spin" />
              )}
            </div>
          )
        })}
      </div>

      {/* Leg/match info */}
      <div className="flex items-center justify-center gap-3 mt-3 px-4">
        <span className="text-xs text-muted-foreground">
          Leg {currentLeg} of {legsTarget > 1 ? `Best of ${legsTarget * 2 - 1}` : "1"}
        </span>
        {isTransitioning && (
          <span className="text-xs font-bold text-emerald-400 animate-pulse">Leg won!</span>
        )}
        <span className="text-xs font-bold text-muted-foreground">
          {humanLegs} – {botLegs}
        </span>
      </div>

      {/* Checkout suggestion */}
      {checkoutSuggestion && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
          <p className="text-xs font-bold text-emerald-400">{checkoutSuggestion}</p>
        </div>
      )}

      {/* Bot throwing indicator */}
      {isBotTurn && status === "IN_PROGRESS" && (
        <div className="mx-4 mt-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
          <Bot className="size-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300">DartBot is throwing…</span>
          <Loader2 className="size-4 text-violet-400 animate-spin" />
        </div>
      )}

      {/* Input display + numpad */}
      {!isBotTurn && status === "IN_PROGRESS" && (
        <>
          <div className="mx-4 mt-4 flex items-center justify-between">
            <div className="flex-1 flex items-center justify-center">
              <span className={cn(
                "font-score font-black text-5xl transition-all",
                scoreValue > activeRemainder ? "text-red-400" : scoreValue > 0 ? "text-foreground" : "text-muted-foreground"
              )}>
                {dartInput}
              </span>
            </div>
            {lastRoundId && !pendingCheckout && (
              <button onClick={undoLastVisit} className="p-2 rounded-xl bg-muted border border-border hover:bg-muted/80 transition-all active:scale-95">
                <Undo2 className="size-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 mx-4 mt-3">
            {["1","2","3","4","5","6","7","8","9"].map((d) => (
              <button
                key={d}
                onClick={() => inputDigit(d)}
                disabled={!canInput}
                className="py-4 rounded-xl bg-muted border border-border font-score font-bold text-xl active:scale-95 transition-all hover:bg-muted/80 disabled:opacity-40"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => clearInput()}
              disabled={!canInput}
              className="py-4 rounded-xl bg-muted border border-border flex items-center justify-center active:scale-95 transition-all hover:bg-muted/80 disabled:opacity-40"
            >
              <Delete className="size-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => inputDigit("0")}
              disabled={!canInput}
              className="py-4 rounded-xl bg-muted border border-border font-score font-bold text-xl active:scale-95 transition-all hover:bg-muted/80 disabled:opacity-40"
            >
              0
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canInput || scoreValue > activeRemainder || scoreValue < 0}
              className={cn(
                "py-4 rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-40",
                isCheckoutScore
                  ? "bg-emerald-500 text-white"
                  : "bg-primary text-primary-foreground"
              )}
            >
              {isCheckoutScore ? "Checkout!" : "Enter"}
            </button>
          </div>

          {/* Bust button */}
          <button
            onClick={handleBust}
            disabled={!canInput}
            className="mx-4 mt-2 mb-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
          >
            Bust
          </button>
        </>
      )}

      {/* Checkout picker — matches DoublesPrompt style from regular 501 */}
      {pendingCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPendingCheckout(null)} />
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl px-6 py-6 flex flex-col gap-5"
          >
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Checkout!</p>
              <p className="text-lg font-black">Darts at the Double</p>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">How many darts did you use to finish?</p>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCheckoutDartsUsed(n)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95",
                      checkoutDartsUsed === n
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">How many were at the double?</p>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCheckoutDoublesAttempted(n)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95",
                      checkoutDoublesAttempted === n
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCheckoutConfirm}
              disabled={checkoutDoublesAttempted === null}
              className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm
            </button>

            <button
              onClick={handleCheckoutSkip}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip (don&apos;t record doubles)
            </button>
          </motion.div>
        </div>
      )}

      {/* Doubles prompt for non-checkout visits (when remainder hits ≤50 or bust) */}
      {pendingDoubles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" />
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl px-6 py-6 flex flex-col gap-5"
          >
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
                {pendingDoubles.isBust ? "Bust" : "Doubles"}
              </p>
              <p className="text-lg font-black">How many darts at the double this visit?</p>
            </div>

            <div className="flex gap-2">
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setDoublesCount(n)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95",
                    doublesCount === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>

            <button
              onClick={() => doublesCount !== null && handleDoublesConfirm(doublesCount)}
              disabled={doublesCount === null}
              className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm
            </button>

            <button
              onClick={() => handleDoublesConfirm(0)}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip (don&apos;t record doubles)
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
