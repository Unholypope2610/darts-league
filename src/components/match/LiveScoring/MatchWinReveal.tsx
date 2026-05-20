"use client"

import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { formatAverage } from "@/lib/utils/format"
import { calculateAverage, count180s, highestCheckout, doublesPercentage } from "@/lib/utils/stats"

export function MatchWinReveal() {
  const router = useRouter()
  const qc = useQueryClient()
  const { isMatchWon, isMatchDraw, winnerId, playerA, playerB, playerALegsWon, playerBLegsWon, allVisits, matchId } =
    useLiveMatchStore()

  function handleBack() {
    qc.invalidateQueries({ queryKey: ["casual-matches"] })
    qc.invalidateQueries({ queryKey: ["fixtures"] })
    if (matchId) qc.invalidateQueries({ queryKey: ["match", matchId] })
    router.back()
  }

  const winner = winnerId === playerA?.id ? playerA : playerB
  const loser = winnerId === playerA?.id ? playerB : playerA

  // For draws show playerA left; for wins show winner left
  const left = isMatchDraw ? playerA : winner
  const right = isMatchDraw ? playerB : loser

  function getVisits(id: string | undefined) {
    if (!id) return []
    return allVisits.filter((v) => v.playerId === id)
  }

  function calcAvg(id: string | undefined) {
    if (!id) return "—"
    return formatAverage(calculateAverage(getVisits(id)))
  }

  function calcDbl(id: string | undefined) {
    if (!id) return "—"
    const d = doublesPercentage(getVisits(id))
    return d > 0 ? `${d.toFixed(1)}%` : "—"
  }

  function calc180s(id: string | undefined) {
    if (!id) return "—"
    return String(count180s(getVisits(id)))
  }

  function calcHighCO(id: string | undefined) {
    if (!id) return "—"
    const h = highestCheckout(getVisits(id))
    return h > 0 ? String(h) : "—"
  }

  const statRows = [
    { label: "Avg",   lv: calcAvg(left?.id),    rv: calcAvg(right?.id) },
    { label: "D%",    lv: calcDbl(left?.id),    rv: calcDbl(right?.id) },
    { label: "180s",  lv: calc180s(left?.id),   rv: calc180s(right?.id) },
    { label: "Hi CO", lv: calcHighCO(left?.id), rv: calcHighCO(right?.id) },
  ]

  return (
    <AnimatePresence>
      {isMatchWon && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center gap-6 p-6"
        >
          {/* Trophy / Handshake */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="text-7xl"
          >
            {isMatchDraw ? "🤝" : "🏆"}
          </motion.div>

          {/* Winner name or Draw */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-3"
          >
            {isMatchDraw ? (
              <h1 className="text-4xl font-black tracking-tight text-yellow-400">It's a Draw!</h1>
            ) : (
              <>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Winner</span>
                <PlayerAvatar name={winner?.name ?? ""} avatarUrl={winner?.avatarUrl} size="xl" />
                <h1 className="text-4xl font-black tracking-tight text-emerald-400">{winner?.name}</h1>
              </>
            )}
          </motion.div>

          {/* Score */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-4"
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
            className="w-full max-w-xs rounded-xl bg-muted/40 border border-border overflow-hidden"
          >
            {/* Player name headers */}
            <div className="grid grid-cols-3 gap-1 px-3 py-2 border-b border-border/50">
              <div className="text-center text-xs font-semibold text-foreground truncate">{left?.name ?? ""}</div>
              <div />
              <div className="text-center text-xs font-semibold text-foreground truncate">{right?.name ?? ""}</div>
            </div>

            {/* Stat rows */}
            {statRows.map(({ label, lv, rv }) => (
              <div key={label} className="grid grid-cols-3 gap-1 px-3 py-2 border-b border-border/30 last:border-0">
                <div className="text-center font-score font-bold text-sm">{lv}</div>
                <div className="text-center text-[11px] text-muted-foreground">{label}</div>
                <div className="text-center font-score font-bold text-sm">{rv}</div>
              </div>
            ))}
          </motion.div>

          {/* Action */}
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9 }}
            onClick={handleBack}
            className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
          >
            Back to Fixtures
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
