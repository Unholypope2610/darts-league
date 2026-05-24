"use client"

import { useLiveMatchStore } from "@/stores/live-match.store"
import { cn } from "@/lib/utils/cn"

function truncate(s: string, max = 12) {
  return s.length > max ? s.slice(0, max).toUpperCase() + "…" : s.toUpperCase()
}

export function ScoreOverlay() {
  const {
    playerA, playerB,
    playerARemainder, playerBRemainder,
    playerALegsWon, playerBLegsWon,
    bestOf, currentTurnPlayerId,
  } = useLiveMatchStore()

  if (!playerA || !playerB) return null

  const isAActive = currentTurnPlayerId === playerA.id

  const rows = [
    { name: playerA.name, remainder: playerARemainder, legs: playerALegsWon, active: isAActive },
    { name: playerB.name, remainder: playerBRemainder, legs: playerBLegsWon, active: !isAActive },
  ]

  return (
    <div
      className="absolute bottom-2 left-2 rounded-lg overflow-hidden select-none pointer-events-none z-10"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", minWidth: 158 }}
    >
      <div className="flex items-center justify-between px-2 py-[3px] border-b border-white/10">
        <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">
          Best of {bestOf} Legs
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">Legs</span>
      </div>
      {rows.map(({ name, remainder, legs, active }) => (
        <div
          key={name}
          className={cn("flex items-center gap-2 px-2 py-[5px]", active && "bg-white/[0.08]")}
        >
          <span className={cn(
            "flex-1 font-bold text-[11px] tracking-wide",
            active ? "text-white" : "text-white/55"
          )}>
            {truncate(name)}
          </span>
          <span className={cn(
            "w-[18px] h-[18px] rounded text-[10px] font-black flex items-center justify-center shrink-0",
            active ? "bg-amber-500 text-black" : "bg-white/10 text-white/50"
          )}>
            {legs}
          </span>
          <span className={cn(
            "font-score font-black text-sm tabular-nums w-9 text-right shrink-0",
            active ? "text-white" : "text-white/55"
          )}>
            {remainder}
          </span>
        </div>
      ))}
    </div>
  )
}
