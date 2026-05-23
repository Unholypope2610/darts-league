"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { PreMatchModal } from "@/components/match/PreMatchModal"
import { MatchSummaryModal } from "@/components/match/MatchSummaryModal"
import { useStartFixture } from "@/hooks/useFixtures"
import { cn } from "@/lib/utils/cn"

interface FixtureCardProps {
  fixture: {
    id: string
    matchday: number
    status: string
    matchId?: string | null
    scheduledAt?: string | null
    playerA: { id: string; name: string; avatarUrl?: string | null }
    playerB: { id: string; name: string; avatarUrl?: string | null }
    match?: { playerAScore: number; playerBScore: number } | null
    competition?: { bestOf: number; startingScore: number; finishType: string } | null
  }
  canScore?: boolean
  competitionCompleted?: boolean
}

export function FixtureCard({ fixture, canScore, competitionCompleted }: FixtureCardProps) {
  const router = useRouter()
  const { mutate: startFixture, isPending } = useStartFixture()
  const [modalOpen, setModalOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)

  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })
  const isAdmin = me?.role === "ADMIN"

  async function handleRestart() {
    setIsRestarting(true)
    try {
      const r = await fetch(`/api/matches/${fixture.matchId}/restart`, { method: "POST" })
      const json = await r.json()
      if (!r.ok) throw new Error(json?.error ?? "Failed to restart")
      setConfirmRestart(false)
      router.push(`/matches/${fixture.matchId}/live`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restart")
      setIsRestarting(false)
    }
  }

  function handleStart(config: { starterId: string; bestOf: number; startingScore: number; finishType: string }) {
    startFixture(
      {
        fixtureId: fixture.id,
        config: {
          startingPlayerId: config.starterId,
          bestOf: config.bestOf,
          startingScore: config.startingScore,
          finishType: config.finishType,
        },
      },
      {
        onSuccess: (match) => {
          setModalOpen(false)
          router.push(`/matches/${match.id}/live`)
        },
        onError: () => toast.error("Failed to start fixture"),
      },
    )
  }

  const isCompleted = fixture.status === "COMPLETED"
  const isLive = fixture.status === "LIVE"

  return (
    <>
      <div className="flex flex-col">
        <div
          className={cn(
            "rounded-xl border bg-card p-4 flex items-center gap-3 transition-all",
            isLive && "border-emerald-500/50 bg-emerald-500/5",
            !isLive && "border-border",
          )}
        >
          {/* Player A */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <PlayerAvatar name={fixture.playerA.name} avatarUrl={fixture.playerA.avatarUrl} size="sm" />
            <span className="font-medium truncate text-sm">{fixture.playerA.name}</span>
          </div>

          {/* Score / Status */}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            {isCompleted && fixture.match ? (
              <button
                onClick={() => setSummaryOpen(true)}
                className="hover:text-primary transition-colors"
              >
                <div className="flex items-center gap-2 font-score text-lg font-bold">
                  <span>{fixture.match.playerAScore}</span>
                  <span className="text-muted-foreground text-sm">–</span>
                  <span>{fixture.match.playerBScore}</span>
                </div>
              </button>
            ) : isLive ? (
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-emerald-400 animate-pulse">LIVE</span>
                {fixture.matchId && (
                  <Link href={`/matches/${fixture.matchId}/live`} className="text-xs text-emerald-400 hover:underline">
                    Watch
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">vs</span>
                {canScore && (
                  <button
                    onClick={() => setModalOpen(true)}
                    disabled={isPending}
                    className="text-xs px-3 py-1 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                  >
                    Start
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Player B */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="font-medium truncate text-sm text-right">{fixture.playerB.name}</span>
            <PlayerAvatar name={fixture.playerB.name} avatarUrl={fixture.playerB.avatarUrl} size="sm" />
          </div>
        </div>

        {isAdmin && !competitionCompleted && fixture.matchId && (isLive || isCompleted) && (
          <div className="px-2 pt-1.5 flex items-center gap-2">
            {confirmRestart ? (
              <>
                <span className="text-xs text-muted-foreground flex-1">Restart this match?</span>
                <button
                  onClick={handleRestart}
                  disabled={isRestarting}
                  className="text-xs px-3 py-1 rounded-lg bg-destructive/80 text-destructive-foreground font-bold hover:bg-destructive disabled:opacity-50"
                >
                  {isRestarting ? "…" : "Yes, restart"}
                </button>
                <button
                  onClick={() => setConfirmRestart(false)}
                  disabled={isRestarting}
                  className="text-xs px-3 py-1 rounded-lg bg-muted text-muted-foreground font-medium hover:bg-muted/70"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmRestart(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Restart match
              </button>
            )}
          </div>
        )}
      </div>

      <MatchSummaryModal
        matchId={summaryOpen ? (fixture.matchId ?? null) : null}
        onClose={() => setSummaryOpen(false)}
      />

      {modalOpen && (
        <PreMatchModal
          open={modalOpen}
          playerA={{ id: fixture.playerA.id, name: fixture.playerA.name, avatarUrl: fixture.playerA.avatarUrl ?? null }}
          playerB={{ id: fixture.playerB.id, name: fixture.playerB.name, avatarUrl: fixture.playerB.avatarUrl ?? null }}
          defaultBestOf={fixture.competition?.bestOf ?? 7}
          defaultStartingScore={fixture.competition?.startingScore ?? 501}
          defaultFinishType={fixture.competition?.finishType ?? "DOUBLE_OUT"}
          onStart={handleStart}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
