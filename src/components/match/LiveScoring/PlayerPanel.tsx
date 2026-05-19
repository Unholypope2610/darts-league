"use client"

import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { ScoreDisplay } from "./ScoreDisplay"
import { CheckoutSuggestion } from "./CheckoutSuggestion"
import { cn } from "@/lib/utils/cn"
import { formatAverage } from "@/lib/utils/format"
import type { VisitRecord } from "@/types/api"

interface PlayerPanelProps {
  playerId: string
  name: string
  avatarUrl?: string | null
  remainder: number
  legsWon: number
  bestOf: number
  isActive: boolean
  isBust: boolean
  visits: VisitRecord[]      // current leg — for last 3 visits display
  allVisits: VisitRecord[]   // all legs — for match average
  className?: string
}

function runningAverage(visits: VisitRecord[], playerId: string): string {
  const playerVisits = visits.filter((v) => v.playerId === playerId && !v.isBust)
  if (playerVisits.length === 0) return "0.00"
  const totalScore = playerVisits.reduce((acc, v) => acc + v.scoreThrown, 0)
  const totalDarts = playerVisits.reduce((acc, v) => acc + v.dartsUsed, 0)
  if (totalDarts === 0) return "0.00"
  return formatAverage((totalScore / totalDarts) * 3)
}

function lastThreeVisits(visits: VisitRecord[], playerId: string): VisitRecord[] {
  return visits.filter((v) => v.playerId === playerId).slice(-3)
}

export function PlayerPanel({
  playerId,
  name,
  avatarUrl,
  remainder,
  legsWon,
  bestOf,
  isActive,
  isBust,
  visits,
  allVisits,
  className,
}: PlayerPanelProps) {
  const legsNeeded = Math.ceil(bestOf / 2)
  const avg = runningAverage(allVisits, playerId)  // match average across all legs
  const recent = lastThreeVisits(visits, playerId)

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl p-4 border-2 transition-all duration-300",
        isActive
          ? "border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
          : "border-border/50 bg-muted/20 opacity-60",
        className,
      )}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">Throwing</span>
        </div>
      )}

      {/* Avatar + name */}
      <PlayerAvatar name={name} avatarUrl={avatarUrl} size="lg" />
      <span className="font-bold text-base truncate max-w-[120px] text-center">{name}</span>

      {/* Legs won */}
      <div className="flex gap-1">
        {Array.from({ length: legsNeeded }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-4 h-4 rounded-full border-2",
              i < legsWon ? "bg-emerald-500 border-emerald-500" : "border-border",
            )}
          />
        ))}
      </div>

      {/* Score */}
      <ScoreDisplay remainder={remainder} isActive={isActive} isBust={isBust} />

      {/* Checkout suggestion */}
      <CheckoutSuggestion remainder={remainder} className="w-full" />

      {/* Last 3 visits */}
      {recent.length > 0 && (
        <div className="flex gap-2 items-center">
          {recent.map((v, i) => (
            <span
              key={i}
              className={cn(
                "font-score text-xs font-bold px-2 py-0.5 rounded",
                v.isBust ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground",
              )}
            >
              {v.isBust ? "BUST" : v.scoreThrown}
            </span>
          ))}
        </div>
      )}

      {/* Running avg */}
      <div className="text-xs text-muted-foreground">
        Avg <span className="font-score font-bold text-foreground">{avg}</span>
      </div>
    </div>
  )
}
