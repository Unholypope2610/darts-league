"use client"

import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { formatAverage } from "@/lib/utils/format"
import { calculateAverage, calculateFirst9Average, doublesPercentage, count180s, highestCheckout } from "@/lib/utils/stats"
import type { MatchWithLegs } from "@/types/api"

function calcStats(m: MatchWithLegs, playerId: string) {
  const allVisits = m.legs.flatMap((l) => l.visits)
  const pVisits = allVisits.filter((v) => v.playerId === playerId)
  const pLegs = m.legs.filter((l) => l.winnerId === playerId)
  const checkoutVisits = pVisits.filter((v) => v.isCheckout)
  const totalDartsAtDouble = pVisits.reduce((sum, v) => sum + v.doublesAttempted, 0)

  return {
    avg: formatAverage(calculateAverage(pVisits)),
    first9: formatAverage(calculateFirst9Average(pVisits)),
    dblPct: doublesPercentage(pVisits) > 0 ? `${doublesPercentage(pVisits).toFixed(1)}%` : "—",
    checkoutsStr: totalDartsAtDouble > 0 ? `${checkoutVisits.length}/${totalDartsAtDouble}` : "—",
    c180s: count180s(pVisits),
    hiCO: highestCheckout(pVisits) > 0 ? String(highestCheckout(pVisits)) : "—",
    hiScore: pVisits.filter((v) => !v.isBust).reduce((max, v) => Math.max(max, v.scoreThrown), 0) || "—",
    bestLeg: pLegs.length > 0 ? `${Math.min(...pLegs.map((l) => l.dartsThrown))} darts` : "—",
    worstLeg: pLegs.length > 0 ? `${Math.max(...pLegs.map((l) => l.dartsThrown))} darts` : "—",
  }
}

export function MatchWinReveal() {
  const router = useRouter()
  const qc = useQueryClient()
  const { isMatchWon, isMatchDraw, winnerId, playerA, playerB, playerALegsWon, playerBLegsWon, matchId } =
    useLiveMatchStore()

  // Fetch fresh match data from the API so stats always match the match summary modal
  const { data: match } = useQuery<MatchWithLegs>({
    queryKey: ["match-result", matchId],
    queryFn: () => fetch(`/api/matches/${matchId}`).then((r) => r.json()),
    enabled: !!matchId && isMatchWon,
    staleTime: 0,
  })

  function handleBack() {
    qc.invalidateQueries({ queryKey: ["casual-matches"] })
    qc.invalidateQueries({ queryKey: ["fixtures"] })
    if (matchId) qc.invalidateQueries({ queryKey: ["match", matchId] })
    router.back()
  }

  const winner = winnerId === playerA?.id ? playerA : playerB

  // For draws show playerA left; for wins show winner left
  const left = isMatchDraw ? playerA : winner
  const right = isMatchDraw ? playerB : (winner?.id === playerA?.id ? playerB : playerA)

  const leftStats = match && left ? calcStats(match, left.id) : null
  const rightStats = match && right ? calcStats(match, right.id) : null

  const statRows = leftStats && rightStats ? [
    { label: "3-dart Avg",     lv: leftStats.avg,          rv: rightStats.avg },
    { label: "First 9 Avg",   lv: leftStats.first9,        rv: rightStats.first9 },
    { label: "Doubles %",     lv: leftStats.dblPct,        rv: rightStats.dblPct },
    { label: "Checkouts",     lv: leftStats.checkoutsStr,  rv: rightStats.checkoutsStr },
    { label: "180s",          lv: leftStats.c180s,         rv: rightStats.c180s },
    { label: "Highest Finish",lv: leftStats.hiCO,          rv: rightStats.hiCO },
    { label: "Highest Score", lv: leftStats.hiScore,       rv: rightStats.hiScore },
    { label: "Best Leg",      lv: leftStats.bestLeg,       rv: rightStats.bestLeg },
    { label: "Worst Leg",     lv: leftStats.worstLeg,      rv: rightStats.worstLeg },
  ] : null

  return (
    <AnimatePresence>
      {isMatchWon && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 p-4 overflow-y-auto"
        >
          {/* Trophy / Handshake */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="text-6xl flex-shrink-0"
          >
            {isMatchDraw ? "🤝" : "🏆"}
          </motion.div>

          {/* Winner name or Draw */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-2 flex-shrink-0"
          >
            {isMatchDraw ? (
              <h1 className="text-4xl font-black tracking-tight text-yellow-400">It's a Draw!</h1>
            ) : (
              <>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Winner</span>
                <PlayerAvatar name={winner?.name ?? ""} avatarUrl={winner?.avatarUrl} size="lg" />
                <h1 className="text-3xl font-black tracking-tight text-emerald-400">{winner?.name}</h1>
              </>
            )}
          </motion.div>

          {/* Score */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-4 flex-shrink-0"
          >
            <span className="font-score text-5xl font-black text-emerald-400">
              {isMatchDraw ? playerALegsWon : (winnerId === playerA?.id ? playerALegsWon : playerBLegsWon)}
            </span>
            <span className="text-2xl text-muted-foreground">–</span>
            <span className="font-score text-5xl font-black text-muted-foreground">
              {isMatchDraw ? playerBLegsWon : (winnerId === playerA?.id ? playerBLegsWon : playerALegsWon)}
            </span>
          </motion.div>

          {/* Stats comparison table */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="w-full max-w-sm rounded-xl bg-muted/40 border border-border overflow-hidden flex-shrink-0"
          >
            {/* Player name headers */}
            <div className="grid grid-cols-3 px-3 py-2 border-b border-border/50">
              <div className="text-center text-xs font-semibold text-foreground truncate">{left?.name ?? ""}</div>
              <div />
              <div className="text-center text-xs font-semibold text-foreground truncate">{right?.name ?? ""}</div>
            </div>

            {statRows ? (
              statRows.map(({ label, lv, rv }) => (
                <div key={label} className="grid grid-cols-3 px-3 py-1.5 border-b border-border/30 last:border-0">
                  <div className="text-center font-score font-bold text-sm">{lv}</div>
                  <div className="text-center text-[10px] text-muted-foreground leading-tight">{label}</div>
                  <div className="text-center font-score font-bold text-sm">{rv}</div>
                </div>
              ))
            ) : (
              // Loading placeholder while fetch completes
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="grid grid-cols-3 px-3 py-2 border-b border-border/30 last:border-0">
                  <div className="text-center text-sm text-muted-foreground/40">—</div>
                  <div />
                  <div className="text-center text-sm text-muted-foreground/40">—</div>
                </div>
              ))
            )}
          </motion.div>

          {/* Action */}
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9 }}
            onClick={handleBack}
            className="flex-shrink-0 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
          >
            Back to Fixtures
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
