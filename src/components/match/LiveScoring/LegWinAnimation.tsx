"use client"

import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useLiveMatchStore } from "@/stores/live-match.store"

export function LegWinAnimation() {
  const { isLegWinAnimating, legWinnerId, playerA, playerB, playerALegsWon, playerBLegsWon, dismissLegWin } =
    useLiveMatchStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const winner = legWinnerId === playerA?.id ? playerA : playerB

  useEffect(() => {
    if (!isLegWinAnimating) return

    let animId: number
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    interface Particle {
      x: number; y: number; vx: number; vy: number
      color: string; size: number; alpha: number
    }

    const particles: Particle[] = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 4 + 2,
      color: ["#10b981", "#34d399", "#6ee7b7", "#fbbf24", "#f59e0b"][Math.floor(Math.random() * 5)],
      size: Math.random() * 8 + 4,
      alpha: 1,
    }))

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.1
        p.alpha -= 0.008
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.6)
        ctx.restore()
      })
      if (particles.some((p) => p.alpha > 0)) {
        animId = requestAnimationFrame(draw)
      }
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [isLegWinAnimating])

  useEffect(() => {
    if (!isLegWinAnimating) return
    const t = setTimeout(() => dismissLegWin(), 2200)
    return () => clearTimeout(t)
  }, [isLegWinAnimating, dismissLegWin])

  return (
    <AnimatePresence>
      {isLegWinAnimating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="relative flex flex-col items-center gap-2 bg-background/90 backdrop-blur-sm rounded-2xl px-10 py-8 border-2 border-emerald-500 shadow-2xl shadow-emerald-500/30"
          >
            <span className="text-5xl">🎯</span>
            <span className="text-2xl font-black tracking-tight text-emerald-400">LEG!</span>
            <span className="text-xl font-bold">{winner?.name}</span>
            <div className="flex gap-3 mt-1 font-score text-3xl font-black">
              <span className={legWinnerId === playerA?.id ? "text-emerald-400" : "text-muted-foreground"}>
                {playerALegsWon}
              </span>
              <span className="text-muted-foreground">–</span>
              <span className={legWinnerId === playerB?.id ? "text-emerald-400" : "text-muted-foreground"}>
                {playerBLegsWon}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
