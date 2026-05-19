"use client"

import { useRef, useEffect } from "react"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { ScoreDisplay } from "./ScoreDisplay"
import { CheckoutSuggestion } from "./CheckoutSuggestion"
import { useBoardCamBroadcast } from "@/hooks/useBoardCamBroadcast"
import { cn } from "@/lib/utils/cn"
import { formatAverage } from "@/lib/utils/format"
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
  // When provided, replaces the score display with the opponent's cam feed
  opponentCamStream: MediaStream | null
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
  opponentCamStream,
  className,
}: PlayerPanelProps) {
  const legsNeeded = Math.ceil(bestOf / 2)
  const avg = runningAverage(allVisits, playerId)
  const recent = lastThreeVisits(visits, playerId)

  // Each panel broadcasts its own player's cam (used when this player is throwing)
  const { isStreaming, error: camError, localStream, start, stop } = useBoardCamBroadcast(matchId, playerId)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = opponentCamStream
  }, [opponentCamStream])

  // The inactive panel (this player is watching) shows the opponent's cam
  const showOpponentCam = !isActive && opponentCamStream !== null

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

        {/* Cam toggle — only shown on the active (throwing) player's panel */}
        {isActive && (
          <button
            onClick={isStreaming ? stop : start}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-md font-medium transition-all flex items-center gap-1",
              isStreaming
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", isStreaming ? "bg-red-500 animate-pulse" : "bg-muted-foreground")} />
            {isStreaming ? "Cam On" : "Cam"}
          </button>
        )}
        {camError && <p className="text-[10px] text-red-400">{camError}</p>}
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

      {/* Score area OR opponent's cam feed */}
      {showOpponentCam ? (
        <div className="relative w-full rounded-xl overflow-hidden bg-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full aspect-square object-cover"
          />
          {/* Score overlaid */}
          <div className="absolute inset-x-0 bottom-2 flex flex-col items-center pointer-events-none">
            <span className="font-score text-4xl font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,1)]">
              {remainder}
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* Active player's own cam preview (small, so they can aim) */}
          {isActive && isStreaming && (
            <div className="w-full rounded-xl overflow-hidden bg-black">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-square object-cover"
              />
            </div>
          )}
          <ScoreDisplay remainder={remainder} isActive={isActive} isBust={isBust} />
          <CheckoutSuggestion remainder={remainder} className="w-full" />
        </>
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
