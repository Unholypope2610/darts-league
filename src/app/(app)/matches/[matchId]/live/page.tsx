"use client"

import { use, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useLiveMatch } from "@/hooks/useLiveMatch"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { LiveScoringLayout } from "@/components/match/LiveScoring/LiveScoringLayout"
import { Skeleton } from "@/components/ui/skeleton"

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default function LiveMatchPage({ params }: PageProps) {
  const { matchId } = use(params)
  const router = useRouter()
  const { isLoading, error } = useLiveMatch(matchId)
  const isMatchWon = useLiveMatchStore((s) => s.isMatchWon)

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

  return <LiveScoringLayout />
}
