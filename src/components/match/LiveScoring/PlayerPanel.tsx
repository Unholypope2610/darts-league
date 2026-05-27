"use client"

import { useRef, useEffect, useState } from "react"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { ScoreDisplay } from "./ScoreDisplay"
import { CheckoutSuggestion } from "./CheckoutSuggestion"
import { useBoardCamBroadcast } from "@/hooks/useBoardCamBroadcast"
import { cn } from "@/lib/utils/cn"
import { formatAverage } from "@/lib/utils/format"
import { RefreshCw, ChevronUp, ChevronDown } from "lucide-react"
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
  isLegStarter?: boolean
  isLocal?: boolean
  className?: string
}

function runningAverage(visits: VisitRecord[], playerId: string): string {
  const playerVisits = visits.filter((v) => v.playerId === playerId)
  if (playerVisits.length === 0) return "0.00"
  const totalScore = playerVisits.reduce((acc, v) => acc + (v.isBust ? 0 : v.scoreThrown), 0)
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
  isLegStarter = false,
  isLocal = false,
  className,
}: PlayerPanelProps) {
  const legsNeeded = Math.ceil(bestOf / 2)
  const avg = runningAverage(allVisits, playerId)
  const recent = lastThreeVisits(visits, playerId)
  const legDarts = visits.filter((v) => v.playerId === playerId).reduce((acc, v) => acc + v.dartsUsed, 0)

  const { isStreaming, error: camError, localStream, zoomCapabilities, zoomLevel, setZoom, start, stop, flipCamera, rearCameras, activeCameraId, switchRearCamera } =
    useBoardCamBroadcast(matchId, playerId)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const [camMinimized, setCamMinimized] = useState(false)

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

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-1 w-full">
        <div className="relative inline-block">
          <PlayerAvatar name={name} avatarUrl={avatarUrl} size="lg" />
          {isLegStarter && (
            <span className="absolute -top-1 -right-1 text-base leading-none" title="Leg starter">🎯</span>
          )}
        </div>
        <span className="font-bold text-base truncate max-w-[120px] text-center">{name}</span>

        {/* Start Cam button — only shown when not yet streaming (always visible to canControl) */}
        {canControl && !isStreaming && (
          <button
            onClick={() => start()}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 bg-muted text-foreground border-border hover:bg-muted/60"
          >
            <span className="w-2 h-2 rounded-full shrink-0 bg-muted-foreground" />
            Start Cam
          </button>
        )}
        {camError && <p className="text-[10px] text-red-400 text-center">{camError}</p>}
      </div>

      {/* Legs won pips */}
      <div className="flex gap-1.5">
        {Array.from({ length: legsNeeded }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-5 h-5 rounded-full border-2",
              i < legsWon
                ? "bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-500/50"
                : "bg-muted border-muted-foreground/50",
            )}
          />
        ))}
      </div>

      {/* Cam section — in local mode only show for the active player (one shared camera);
          in online mode always show when streaming so each player can manage their own cam. */}
      <div className={cn("w-full flex flex-col gap-1.5", (isLocal ? !(isActive && isStreaming) : !isStreaming) && "hidden")}>
        <button
          onClick={() => setCamMinimized((v) => !v)}
          className="w-full flex items-center justify-center gap-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {camMinimized ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          {camMinimized ? "Show cam" : "Hide cam"}
        </button>

        {/* Stop Cam + Flip + camera selector — hidden when minimised */}
        {canControl && !camMinimized && (
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={stop}
                style={{ touchAction: "manipulation" }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30"
              >
                <span className="w-2 h-2 rounded-full shrink-0 bg-red-500 animate-pulse" />
                Stop Cam
              </button>
              <button
                onClick={flipCamera}
                title="Flip camera"
                style={{ touchAction: "manipulation" }}
                className="p-2 rounded-lg bg-muted border border-border hover:bg-muted/60 active:scale-95 transition-all"
              >
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {rearCameras.length > 1 && (
              <div className="flex w-full rounded-lg overflow-hidden border border-border">
                {rearCameras.map((cam) => (
                  <button
                    key={cam.deviceId}
                    onClick={() => switchRearCamera(cam.deviceId)}
                    title={cam.label}
                    style={{ touchAction: "manipulation" }}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-bold transition-all active:scale-95",
                      cam.deviceId === activeCameraId
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={cn("w-full aspect-square object-cover rounded-xl bg-black", camMinimized && "hidden")}
        />
      </div>

      {/* Score always visible */}
      <ScoreDisplay remainder={remainder} isActive={isActive} isBust={isBust} />
      <CheckoutSuggestion remainder={remainder} className="w-full" />

      {/* Zoom buttons — shown when broadcasting and device supports zoom */}
      {isStreaming && zoomCapabilities && (
        <div className="w-full flex items-center justify-between gap-2">
          <button
            onClick={() => setZoom(Math.max(zoomCapabilities.min, parseFloat((zoomLevel - zoomCapabilities.step).toFixed(2))))}
            className="flex-1 py-2 rounded-lg bg-muted border border-border text-lg font-bold text-foreground hover:bg-muted/60 active:scale-95 transition-all"
          >
            −
          </button>
          <span className="text-[11px] font-score font-bold text-muted-foreground w-10 text-center shrink-0">
            {zoomLevel.toFixed(1)}×
          </span>
          <button
            onClick={() => setZoom(Math.min(zoomCapabilities.max, parseFloat((zoomLevel + zoomCapabilities.step).toFixed(2))))}
            className="flex-1 py-2 rounded-lg bg-muted border border-border text-lg font-bold text-foreground hover:bg-muted/60 active:scale-95 transition-all"
          >
            +
          </button>
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

      {/* Running avg + current-leg dart count */}
      <div className="text-xs text-muted-foreground">
        Avg <span className="font-score font-bold text-foreground">{avg}</span>
        {legDarts > 0 && (
          <span className="ml-1.5 text-muted-foreground/70">{legDarts}d</span>
        )}
      </div>
    </div>
  )
}
