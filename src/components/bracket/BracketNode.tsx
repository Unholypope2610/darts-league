"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { useStartFixture } from "@/hooks/useFixtures"
import { cn } from "@/lib/utils/cn"

interface BracketNodeProps {
  node: {
    id: string
    round: number
    position: number
    seedA?: { id: string; name: string; avatarUrl?: string | null } | null
    seedB?: { id: string; name: string; avatarUrl?: string | null } | null
    winner?: { id: string; name: string } | null
    matchId?: string | null
    match?: { playerAScore: number; playerBScore: number; winnerId?: string | null } | null
  }
  canScore?: boolean
}

export function BracketNode({ node, canScore }: BracketNodeProps) {
  const router = useRouter()
  const { mutate: startFixture, isPending } = useStartFixture()
  const isComplete = !!node.winner
  const isFinal = node.round === 1

  function handleStart() {
    if (!node.matchId) {
      toast.error("No match linked to this bracket node")
      return
    }
    router.push(`/matches/${node.matchId}/live`)
  }

  const ROUND_LABELS: Record<number, string> = { 1: "Final", 2: "Semi-Final", 4: "Quarter-Final" }

  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-card w-52 overflow-hidden",
        isComplete ? "border-emerald-500/60" : "border-border",
        isFinal && isComplete && "border-amber-500/60 shadow-lg shadow-amber-500/10",
      )}
    >
      <div className="px-3 py-1.5 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
        {ROUND_LABELS[node.round] ?? `Round ${node.round}`}
      </div>
      {[node.seedA, node.seedB].map((seed, i) => {
        const isWinner = seed && node.winner?.id === seed.id
        const score = node.match ? (i === 0 ? node.match.playerAScore : node.match.playerBScore) : null
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 border-b last:border-0 border-border/50",
              isWinner && "bg-emerald-500/10",
            )}
          >
            {seed ? (
              <>
                <PlayerAvatar name={seed.name} avatarUrl={seed.avatarUrl} size="sm" />
                <span className={cn("flex-1 text-sm font-medium truncate", isWinner && "text-emerald-400")}>
                  {seed.name}
                </span>
                {score !== null && (
                  <span className={cn("font-score font-bold text-sm", isWinner ? "text-emerald-400" : "text-muted-foreground")}>
                    {score}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground italic">TBD</span>
            )}
          </div>
        )
      })}
      {/* Action */}
      {isComplete && node.matchId && (
        <div className="px-3 py-2 bg-muted/20">
          <Link
            href={`/matches/${node.matchId}`}
            className="block text-center text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground font-medium hover:bg-muted/70 transition-colors"
          >
            View Summary
          </Link>
        </div>
      )}
      {!isComplete && node.seedA && node.seedB && canScore && (
        <div className="px-3 py-2 bg-muted/20">
          {node.matchId ? (
            <Link
              href={`/matches/${node.matchId}/live`}
              className="block text-center text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90"
            >
              Score Match
            </Link>
          ) : (
            <button
              onClick={handleStart}
              disabled={isPending}
              className="w-full text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "…" : "Start Match"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
