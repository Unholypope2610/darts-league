"use client"

import { use } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, ArrowLeft, BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { PracticeSessionWithRounds, Bobs27RoundData, CricketRoundData, HalfItRoundData } from "@/types/api"

interface PageProps { params: Promise<{ sessionId: string }> }

const MODE_LABELS: Record<string, string> = { BOBS_27: "Bob's 27", CRICKET: "Cricket", HALF_IT: "Half It" }

function halfItTargetLabel(t: { type: string; value?: number; wildcardTargets?: [number, number] }): string {
  if (t.type === "NUMBER") return String(t.value)
  if (t.type === "DOUBLES") return "Doubles"
  if (t.type === "TREBLES") return "Trebles"
  if (t.type === "BULL") return "Bull"
  if (t.type === "3_DIFF_COLOURS") return "3 Diff Colours"
  if (t.type === "3_SAME_COLOUR") return "3 Same Colour"
  if (t.type === "WILDCARD") return "Exact Number"
  return t.type
}

function Bobs27Summary({ session }: { session: PracticeSessionWithRounds }) {
  const playerRounds: Record<string, Bobs27RoundData[]> = {}
  for (const p of session.players) playerRounds[p.playerId] = []
  for (const r of session.rounds) {
    playerRounds[r.playerId] = playerRounds[r.playerId] ?? []
    playerRounds[r.playerId].push(r.data as Bobs27RoundData)
  }

  return (
    <div className="flex flex-col gap-4">
      {session.players.map((p) => {
        const pRounds = playerRounds[p.playerId] ?? []
        const finalScore = pRounds[pRounds.length - 1]?.runningScore ?? 27
        const hits = pRounds.filter((r) => r.dartsHit > 0).length
        const misses = pRounds.filter((r) => r.dartsHit === 0).length
        const perfects = pRounds.filter((r) => r.dartsHit === 3).length
        const isWinner = session.winnerId === p.playerId

        return (
          <div key={p.playerId} className={cn("rounded-xl border p-4 bg-card", isWinner ? "border-amber-500/40" : "border-border")}>
            <div className="flex items-center gap-3 mb-3">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="md" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{p.name}</p>
                  {isWinner && <Trophy className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="font-score text-2xl font-black text-primary">{finalScore}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[{ label: "Hits", value: hits }, { label: "Misses", value: misses }, { label: "Perfects", value: perfects }].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted p-2">
                  <p className="font-score font-bold text-lg">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CricketSummary({ session }: { session: PracticeSessionWithRounds }) {
  const points: Record<string, number> = {}
  const totalMarks: Record<string, number> = {}
  const totalDarts: Record<string, number> = {}
  for (const p of session.players) { points[p.playerId] = 0; totalMarks[p.playerId] = 0; totalDarts[p.playerId] = 0 }
  for (const r of session.rounds) {
    const d = r.data as CricketRoundData
    totalDarts[r.playerId] = (totalDarts[r.playerId] ?? 0) + d.darts.length
    for (const marks of Object.values(d.marksEarned)) totalMarks[r.playerId] = (totalMarks[r.playerId] ?? 0) + marks
    points[r.playerId] = (points[r.playerId] ?? 0) + d.totalPointsEarned
  }

  return (
    <div className="flex flex-col gap-4">
      {session.players.map((p) => {
        const mpd = totalDarts[p.playerId] > 0 ? (totalMarks[p.playerId] / totalDarts[p.playerId]).toFixed(2) : "0.00"
        const isWinner = session.winnerId === p.playerId
        return (
          <div key={p.playerId} className={cn("rounded-xl border p-4 bg-card", isWinner ? "border-amber-500/40" : "border-border")}>
            <div className="flex items-center gap-3 mb-3">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="md" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{p.name}</p>
                  {isWinner && <Trophy className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="text-sm text-muted-foreground">{points[p.playerId] ?? 0} pts · {totalDarts[p.playerId] ?? 0} darts</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[{ label: "Marks Per Dart", value: mpd }, { label: "Total Marks", value: totalMarks[p.playerId] ?? 0 }].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted p-2">
                  <p className="font-score font-bold text-lg">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HalfItSummary({ session }: { session: PracticeSessionWithRounds }) {
  const playerRounds: Record<string, HalfItRoundData[]> = {}
  for (const p of session.players) playerRounds[p.playerId] = []
  for (const r of session.rounds) {
    playerRounds[r.playerId] = playerRounds[r.playerId] ?? []
    playerRounds[r.playerId].push(r.data as HalfItRoundData)
  }

  // Per-round lookup: roundsByPlayer[playerId][roundIndex] = HalfItRoundData
  const roundsByPlayer: Record<string, Record<number, HalfItRoundData>> = {}
  for (const r of session.rounds) {
    roundsByPlayer[r.playerId] = roundsByPlayer[r.playerId] ?? {}
    roundsByPlayer[r.playerId][r.roundNumber - 1] = r.data as HalfItRoundData
  }

  return (
    <div className="flex flex-col gap-4">
      {session.players.map((p) => {
        const pRounds = playerRounds[p.playerId] ?? []
        const finalScore = pRounds[pRounds.length - 1]?.runningScore ?? 0
        const halves = pRounds.filter((r) => r.wasHalved).length
        const bestRound = Math.max(0, ...pRounds.map((r) => r.pointsScored))
        const isWinner = session.winnerId === p.playerId

        return (
          <div key={p.playerId} className={cn("rounded-xl border p-4 bg-card", isWinner ? "border-amber-500/40" : "border-border")}>
            <div className="flex items-center gap-3 mb-3">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="md" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{p.name}</p>
                  {isWinner && <Trophy className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="font-score text-2xl font-black text-primary">{finalScore}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[{ label: "Halved", value: halves }, { label: "Best Round", value: bestRound }, { label: "Rounds", value: pRounds.length }].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted p-2">
                  <p className="font-score font-bold text-lg">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Per-round breakdown */}
      {session.targetSequence && session.targetSequence.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-2 text-left text-muted-foreground font-semibold">Rnd</th>
                <th className="py-2 px-2 text-left text-muted-foreground font-semibold">Target</th>
                {session.players.map((p) => (
                  <th key={p.playerId} className="py-2 px-2 text-right text-muted-foreground font-semibold">{p.name.split(" ")[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {session.targetSequence.map((t, idx) => (
                <tr key={idx} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 px-2 text-muted-foreground font-semibold">{idx + 1}</td>
                  <td className="py-1.5 px-2 font-semibold">{halfItTargetLabel(t)}</td>
                  {session.players.map((p) => {
                    const pr = roundsByPlayer[p.playerId]?.[idx]
                    return (
                      <td key={p.playerId} className="py-1.5 px-2 text-right font-score">
                        {pr ? (
                          <span className={
                            pr.wasHalved ? "text-red-400"
                            : pr.pointsScored > 0 ? "text-emerald-400"
                            : "text-muted-foreground"
                          }>
                            {pr.wasHalved ? "÷2" : pr.pointsScored > 0 ? `+${pr.pointsScored}` : "0"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">─</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function SessionStatsPage({ params }: PageProps) {
  const { sessionId } = use(params)

  const { data: session, isLoading } = useQuery<PracticeSessionWithRounds>({
    queryKey: ["practice", sessionId],
    queryFn: () => fetch(`/api/practice/${sessionId}`).then((r) => r.json()),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    )
  }

  if (!session) return <p className="text-center text-muted-foreground p-8">Session not found.</p>

  const gameSlug = session.gameMode.toLowerCase().replace("_", "")

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3">
        <Link href="/practice" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-black">{MODE_LABELS[session.gameMode]} — Results</h1>
          <p className="text-xs text-muted-foreground">{new Date(session.startedAt).toLocaleString()}</p>
        </div>
      </div>

      {session.gameMode === "BOBS_27" && <Bobs27Summary session={session} />}
      {session.gameMode === "CRICKET" && <CricketSummary session={session} />}
      {session.gameMode === "HALF_IT" && <HalfItSummary session={session} />}

      <Link
        href={`/practice/stats/${gameSlug}`}
        className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:border-primary/30 hover:text-foreground transition-all"
      >
        <BarChart2 className="w-4 h-4" />
        View All-Time Stats
      </Link>

      <Link
        href="/practice"
        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold active:scale-95 transition-all"
      >
        Back to Practice Arena
      </Link>
    </div>
  )
}
