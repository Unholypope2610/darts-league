"use client"

import { useRef, useEffect } from "react"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { ScoreDisplay } from "./ScoreDisplay"
import { CheckoutSuggestion } from "./CheckoutSuggestion"
import { useBoardCamBroadcast } from "@/hooks/useBoardCamBroadcast"
import { cn } from "@/lib/utils/cn"
import { formatAverage } from "@/lib/utils/format"
import { RefreshCw } from "lucide-react"
import type { VisitRecord } from "@/types/api"

interface PlayerPanelProps {
  matchId: string
  playerId: string
  name: string
  avatarUrl?: string | null
  remainder: number
  legsWon: number
  bestOf: number
  isActive: boolean
  isBust: boolean
  visits: VisitRecord[]
  allVisits: VisitRecord[]
  /** Whether this viewer can control cam for this panel */
  canControl?: boolean
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
  matchId,
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
  canControl = false,
  className,
}: PlayerPanelProps) {
  const legsNeeded = Math.ceil(bestOf / 2)
  const avg = runningAverage(allVisits, playerId)
  const recent = lastThreeVisits(visits, playerId)

  const { isStreaming, error: camError, localStream, zoomCapabilities, zoomLevel, setZoom, start, stop, flipCamera } =
    useBoardCamBroadcast(matchId, playerId)
  const localVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = localVideoRef.current
    if (!el) return
    el.srcObject = localStream
    if (localStream) el.play().catch(() => {})
  }, [localStream])

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl p-3 border-2 transition-all duration-300",
        isActive
          ? "border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
          : "border-border/50 bg-muted/20 opacity-70",
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

      {/* Avatar + name + cam toggle */}
      <div className="flex flex-col items-center gap-1 w-full">
        <PlayerAvatar name={name} avatarUrl={avatarUrl} size="lg" />
        <span className="font-bold text-base truncate max-w-[120px] text-center">{name}</span>

        {/* Cam controls — only shown when this viewer owns this panel */}
        {canControl && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={isStreaming ? stop : () => start()}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all active:scale-95",
                isStreaming
                  ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30"
                  : "bg-muted text-foreground border-border hover:bg-muted/60",
              )}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", isStreaming ? "bg-red-500 animate-pulse" : "bg-muted-foreground")} />
              {isStreaming ? "Stop Cam" : "Start Cam"}
            </button>
            {isStreaming && (
              <button
                onClick={flipCamera}
                title="Flip camera"
                className="p-1.5 rounded-lg bg-muted border border-border hover:bg-muted/60 active:scale-95 transition-all"
              >
                <RefreshCw className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
        {camError && <p className="text-[10px] text-red-400 text-center">{camError}</p>}
      </div>

      {/* Legs won pips */}
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

      {/* Local cam preview — only when this player is actively streaming on this device */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "w-full aspect-square object-cover rounded-xl bg-black",
          !(isActive && isStreaming) && "hidden",
        )}
      />

      {/* Score always visible */}
      <ScoreDisplay remainder={remainder} isActive={isActive} isBust={isBust} />
      <CheckoutSuggestion remainder={remainder} className="w-full" />

      {/* Zoom slider — shown when broadcasting and device supports zoom */}
      {isStreaming && zoomCapabilities && (
        <div className="w-full flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground shrink-0">Zoom</span>
          <input
            type="range"
            min={zoomCapabilities.min}
            max={zoomCapabilities.max}
            step={zoomCapabilities.step}
            value={zoomLevel}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>
      )}

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
