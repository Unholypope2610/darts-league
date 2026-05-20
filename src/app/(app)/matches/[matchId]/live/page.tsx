"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useLiveMatch } from "@/hooks/useLiveMatch"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { LiveScoringLayout } from "@/components/match/LiveScoring/LiveScoringLayout"
import { Skeleton } from "@/components/ui/skeleton"
import { prewarmSpeech } from "@/lib/utils/speech"

type Role = "playerA" | "playerB" | "spectator"

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default function LiveMatchPage({ params }: PageProps) {
  const { matchId } = use(params)
  const router = useRouter()
  const { isLoading, error } = useLiveMatch(matchId)
  const isMatchWon = useLiveMatchStore((s) => s.isMatchWon)
  const playerA = useLiveMatchStore((s) => s.playerA)
  const playerB = useLiveMatchStore((s) => s.playerB)

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })

  const [sessionRole, setSessionRole] = useState<Role | null>(() => {
    if (typeof window === "undefined") return null
    return (sessionStorage.getItem(`match-role-${matchId}`) as Role | null) ?? null
  })

  function handleRoleSelect(role: Role) {
    prewarmSpeech()
    sessionStorage.setItem(`match-role-${matchId}`, role)
    setSessionRole(role)
  }

  // Redirect to summary only if the match was ALREADY complete when the page loaded.
  // Do not redirect when the win happens live — MatchWinReveal needs to play.
  const wasAlreadyCompleteRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (!isLoading && wasAlreadyCompleteRef.current === null) {
      wasAlreadyCompleteRef.current = isMatchWon
      if (isMatchWon) router.replace(`/matches/${matchId}`)
    }
  }, [isLoading, isMatchWon, matchId, router])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load match.</p>
      </div>
    )
  }

  const myPlayerId = me?.playerId ?? null
  const derivedRole: Role =
    myPlayerId && playerA?.id === myPlayerId ? "playerA"
    : myPlayerId && playerB?.id === myPlayerId ? "playerB"
    : "spectator"

  const myRole: Role = sessionRole ?? derivedRole

  const showRolePrompt =
    !sessionRole && derivedRole === "spectator" && !!me && !!playerA && !!playerB

  return (
    <>
      {showRolePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-3 w-full max-w-xs">
            <p className="text-sm font-semibold text-center text-foreground">Who are you in this match?</p>
            <button
              onClick={() => handleRoleSelect("playerA")}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              {playerA.name}
            </button>
            <button
              onClick={() => handleRoleSelect("playerB")}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              {playerB.name}
            </button>
            <button
              onClick={() => handleRoleSelect("spectator")}
              className="w-full py-2 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              Just spectating
            </button>
          </div>
        </div>
      )}
      <LiveScoringLayout myRole={myRole} />
    </>
  )
}
