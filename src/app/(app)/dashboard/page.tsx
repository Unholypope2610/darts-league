"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { useCompetitions } from "@/hooks/useCompetitions"
import { useDashboardCam } from "@/hooks/useDashboardCam"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, Zap, Clock, ChevronRight, X, Video, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { Competition } from "@/types/api"

const TYPE_LABELS: Record<string, string> = {
  SINGLE_LEAGUE: "League",
  DIVISIONS: "Divisions",
  KNOCKOUT: "Knockout",
}

const FILTER_KEY = "competitionParticipantFilter"

function getParticipants(competitions: Competition[]) {
  const map = new Map<string, string>()
  for (const comp of competitions) {
    for (const div of comp.divisions ?? []) {
      for (const dp of div.players) {
        if (dp.player) map.set(dp.player.id, dp.player.name)
      }
    }
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function filterByParticipants(comps: Competition[], selectedIds: string[]) {
  if (selectedIds.length === 0) return comps
  return comps.filter((comp) => {
    const ids = new Set(comp.divisions?.flatMap((d) => d.players.map((p) => p.playerId)) ?? [])
    return selectedIds.some((id) => ids.has(id))
  })
}

function CompetitionCard({ comp }: { comp: Competition }) {
  const isActive = comp.status === "ACTIVE"
  const isDraft = comp.status === "DRAFT"

  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="group relative block rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: isActive
          ? "1px solid rgba(16,185,129,0.25)"
          : isDraft
          ? "1px solid rgba(251,191,36,0.2)"
          : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
      )}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">{comp.name}</h3>
          <p className="text-sm text-zinc-500 mt-0.5">{comp.season}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors shrink-0 mt-0.5" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#888" }}>
            {TYPE_LABELS[comp.type] ?? comp.type}
          </span>
          <span className="text-xs text-zinc-600">Bo{comp.bestOf} · {comp.startingScore}</span>
        </div>
        {isActive && (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        )}
        {isDraft && (
          <span className="text-xs font-semibold text-amber-400">DRAFT</span>
        )}
      </div>
    </Link>
  )
}

function DashboardCamSetup() {
  const cam = useDashboardCam()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = cam.stream
    if (cam.stream) el.play().catch(() => {})
  }, [cam.stream])

  // Auto-expand when streaming starts
  useEffect(() => {
    if (cam.isStreaming) setExpanded(true)
  }, [cam.isStreaming])

  return (
    <div
      className="rounded-xl border p-4 transition-all"
      style={{ background: "rgba(255,255,255,0.02)", borderColor: cam.isStreaming ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.07)" }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Video className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Board Cam</span>
          {cam.isStreaming && (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-600">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3">
          {!cam.isStreaming ? (
            <button
              onClick={() => cam.start()}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border border-zinc-700 text-zinc-300 bg-zinc-800/60 hover:border-zinc-500 hover:text-white active:scale-95 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-zinc-500" />
              Start Cam
            </button>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video rounded-lg object-cover bg-black"
              />

              {/* Stop + Flip */}
              <div className="flex items-center gap-2">
                <button
                  onClick={cam.stop}
                  style={{ touchAction: "manipulation" }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30 active:scale-95 transition-all"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Stop Cam
                </button>
                <button
                  onClick={cam.flip}
                  title="Flip camera"
                  style={{ touchAction: "manipulation" }}
                  className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              {/* Rear camera selector */}
              {cam.rearCameras.length > 1 && (
                <div className="flex w-full rounded-lg overflow-hidden border border-zinc-700">
                  {cam.rearCameras.map((c) => (
                    <button
                      key={c.deviceId}
                      onClick={() => cam.switchRearCamera(c.deviceId)}
                      title={c.label}
                      style={{ touchAction: "manipulation" }}
                      className={cn(
                        "flex-1 py-1.5 text-xs font-bold transition-all active:scale-95",
                        c.deviceId === cam.activeCameraId
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Zoom controls */}
              {cam.zoomCapabilities && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => cam.setZoom(Math.max(cam.zoomCapabilities!.min, parseFloat((cam.zoomLevel - cam.zoomCapabilities!.step).toFixed(2))))}
                    className="flex-1 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-lg font-bold text-zinc-300 hover:bg-zinc-700 active:scale-95 transition-all"
                  >
                    −
                  </button>
                  <span className="text-xs font-bold text-zinc-400 w-10 text-center shrink-0">
                    {cam.zoomLevel.toFixed(1)}×
                  </span>
                  <button
                    onClick={() => cam.setZoom(Math.min(cam.zoomCapabilities!.max, parseFloat((cam.zoomLevel + cam.zoomCapabilities!.step).toFixed(2))))}
                    className="flex-1 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-lg font-bold text-zinc-300 hover:bg-zinc-700 active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
              )}
            </>
          )}

          {cam.error && <p className="text-xs text-red-400">{cam.error}</p>}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useUser()
  const firstName = user?.firstName ?? user?.emailAddresses[0]?.emailAddress.split("@")[0] ?? "back"
  const { data: competitions, isLoading } = useCompetitions()

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      return JSON.parse(localStorage.getItem(FILTER_KEY) ?? "[]")
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(selectedIds))
  }, [selectedIds])

  const participants = getParticipants(competitions ?? [])
  const filtered = filterByParticipants(competitions ?? [], selectedIds)

  function toggle(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const active = filtered.filter((c) => c.status === "ACTIVE")
  const draft = filtered.filter((c) => c.status === "DRAFT")
  const completed = filtered.filter((c) => c.status === "COMPLETED")

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">

      {/* Hero header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Welcome back <span className="text-emerald-400">{firstName}</span>
          </h1>
          <p className="text-zinc-500 mt-1">Here's what's happening in your league</p>
        </div>
        <Link
          href="/competitions/new"
          className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-black transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 0 16px rgba(16,185,129,0.3)" }}
        >
          + New Competition
        </Link>
      </div>

      {/* Board Cam setup */}
      <DashboardCamSetup />

      {/* Participant filter */}
      {participants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 -mt-4">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
          {participants.map((p) => {
            const active = selectedIds.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                  active
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200",
                )}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Active */}
      {active.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h2 className="font-black text-white uppercase tracking-wider text-sm">Active Competitions</h2>
            <span className="ml-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{active.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((c) => <CompetitionCard key={c.id} comp={c} />)}
          </div>
        </section>
      )}

      {/* Draft */}
      {draft.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-400" />
            <h2 className="font-black text-white uppercase tracking-wider text-sm">Drafts</h2>
            <span className="ml-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">{draft.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {draft.map((c) => <CompetitionCard key={c.id} comp={c} />)}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-zinc-500" />
            <h2 className="font-black uppercase tracking-wider text-sm text-zinc-500">Completed</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50">
            {completed.map((c) => <CompetitionCard key={c.id} comp={c} />)}
          </div>
        </section>
      )}

      {filtered.length === 0 && (competitions?.length ?? 0) > 0 && selectedIds.length > 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-zinc-500 text-sm">No competitions match this filter</p>
          <button
            onClick={() => setSelectedIds([])}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-white transition-all"
          >
            Clear filter
          </button>
        </div>
      )}

      {!competitions?.length && (
        <EmptyState
          icon={<Trophy className="w-12 h-12 text-red-500" />}
          title="No competitions yet"
          description="Create your first competition to get started"
          action={
            <Link
              href="/competitions/new"
              className="px-5 py-2.5 rounded-lg text-sm font-bold text-black"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
            >
              Create Competition
            </Link>
          }
        />
      )}
    </div>
  )
}
