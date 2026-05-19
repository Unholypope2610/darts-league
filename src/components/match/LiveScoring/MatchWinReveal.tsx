"use client"

import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { formatAverage } from "@/lib/utils/format"

export function MatchWinReveal() {
  const router = useRouter()
  const { isMatchWon, winnerId, playerA, playerB, playerALegsWon, playerBLegsWon, visits, matchId } =
    useLiveMatchStore()

  const winner = winnerId === playerA?.id ? playerA : playerB
  const loser = winnerId === playerA?.id ? playerB : playerA

  function calcAvg(playerId: string) {
    const pv = visits.filter((v) => v.playerId === playerId && !v.isBust)
    if (!pv.length) return "0.00"
    const totalScore = pv.reduce((a, v) => a + v.scoreThrown, 0)
    const totalDarts = pv.reduce((a, v) => a + v.dartsUsed, 0)
    return formatAverage((totalScore / totalDarts) * 3)
  }

  return (
    <AnimatePresence>
      {isMatchWon && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center gap-8 p-6"
        >
          {/* Trophy */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="text-7xl"
          >
            🏆
          </motion.div>

          {/* Winner name */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-3"
          >
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Winner</span>
            <PlayerAvatar name={winner?.name ?? ""} avatarUrl={winner?.avatarUrl} size="xl" />
            <h1 className="text-4xl font-black tracking-tight text-emerald-400">{winner?.name}</h1>
          </motion.div>

          {/* Score */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-4"
          >
            <span className="font-score text-5xl font-black text-emerald-400">
              {winnerId === playerA?.id ? playerALegsWon : playerBLegsWon}
            </span>
            <span className="text-2xl text-muted-foreground">–</span>
            <span className="font-score text-5xl font-black text-muted-foreground">
              {winnerId === playerA?.id ? playerBLegsWon : playerALegsWon}
            </span>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="grid grid-cols-2 gap-4 w-full max-w-xs"
          >
            {[winner, loser].map((p) =>
              p ? (
                <div key={p.id} className="rounded-xl bg-muted/50 p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">{p.name}</div>
                  <div className="font-score text-xl font-bold">{calcAvg(p.id)}</div>
                  <div className="text-xs text-muted-foreground">avg</div>
                </div>
              ) : null,
            )}
          </motion.div>

          {/* Action */}
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9 }}
            onClick={() => router.back()}
            className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
          >
            Back to Fixtures
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
