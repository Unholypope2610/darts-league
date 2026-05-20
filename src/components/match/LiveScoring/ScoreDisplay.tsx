"use client"

import { AnimatePresence, motion } from "framer-motion"

interface ScoreDisplayProps {
  remainder: number
  isActive: boolean
  isBust?: boolean
}

export function ScoreDisplay({ remainder, isActive, isBust }: ScoreDisplayProps) {
  return (
    <div className="flex items-center justify-center h-16">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={isBust ? `bust-${remainder}` : remainder}
          initial={{ y: -20, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={
            isBust
              ? "font-score text-4xl font-black tracking-tighter text-red-500 line-through"
              : isActive
                ? "font-score text-5xl font-black tracking-tighter text-foreground"
                : "font-score text-5xl font-black tracking-tighter text-muted-foreground/60"
          }
        >
          {remainder}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
