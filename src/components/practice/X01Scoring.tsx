"use client"

import { useX01PracticeStore } from "@/stores/x01practice.store"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { BOT_LEVEL_NAMES } from "@/lib/bot/dartbot"
import { getCheckoutSuggestionText } from "@/lib/algorithms/checkout-suggestions"
import { announceVisit } from "@/lib/utils/speech"
import { cn } from "@/lib/utils/cn"
import { Delete, Undo2, Bot, Loader2 } from "lucide-react"

interface Props {
  sessionId: string
  myPlayerId: string | null
  canControl: boolean
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
  const inputDigit = useX01PracticeStore((s) => s.inputDigit)
  const clearInput = useX01PracticeStore((s) => s.clearInput)
  const submitVisit = useX01PracticeStore((s) => s.submitVisit)
  const undoLastVisit = useX01PracticeStore((s) => s.undoLastVisit)

  if (players.length === 0) return null

  const activePlayer = players[currentPlayerIndex]
  const opponent = players.find((p) => p.playerId !== activePlayer?.playerId)
  const myPlayer = players.find((p) => p.playerId === myPlayerId)
  const botPlayer = players.find((p) => p.isBot)
  const humanPlayer = players.find((p) => !p.isBot)

  const isBotTurn = activePlayer?.isBot
  const isMyTurn = canControl && !isBotTurn
  const canInput = isMyTurn && status === "IN_PROGRESS" && !isTransitioning

  const activeRemainder = remainders[activePlayer?.playerId ?? ""] ?? startingScore
  const checkoutSuggestion = !isBotTurn && activeRemainder <= 170 && activeRemainder >= 2
    ? getCheckoutSuggestionText(activeRemainder)
    : null

  const scoreValue = parseInt(dartInput, 10) || 0

  async function handleSubmit() {
    if (!canInput || scoreValue > activeRemainder) return
    const nextPlayerName = opponent?.name ?? ""
    const nextPlayerId = opponent?.playerId ?? ""
    const nextRemainder = remainders[nextPlayerId] ?? startingScore
    const isBust = false // bust is via dedicated button
    const isCheckout = scoreValue === activeRemainder && finishType === "STRAIGHT_OUT"
      || (scoreValue === activeRemainder && finishType === "DOUBLE_OUT" && false) // checked in store
    // Let the store handle bust/checkout detection
    announceVisit(scoreValue, nextRemainder, nextPlayerName, scoreValue === activeRemainder, false)
    await submitVisit(scoreValue, 3, scoreValue === activeRemainder ? 1 : 0)
  }

  async function handleBust() {
    if (!canInput) return
    const nextPlayerName = opponent?.name ?? ""
    const nextPlayerId = opponent?.playerId ?? ""
    const nextRemainder = remainders[nextPlayerId] ?? startingScore
    announceVisit(0, nextRemainder, nextPlayerName, false, true)
    await submitVisit(0, 3, 1)
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
          return (
            <div
              key={p.playerId}
              className={cn(
                "flex flex-col items-center gap-2 py-4 px-3 transition-all",
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

      {/* Input display */}
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
            {lastRoundId && (
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
              className="py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
            >
              Enter
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
    </div>
  )
}
