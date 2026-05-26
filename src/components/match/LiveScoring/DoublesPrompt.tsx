"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useLiveMatchStore } from "@/stores/live-match.store"

export function DoublesPrompt() {
  const { pendingDoublesPrompt, confirmDoublesPrompt } = useLiveMatchStore()
  const [dartsUsed, setDartsUsed] = useState(3)
  const [doublesAttempted, setDoublesAttempted] = useState<number | null>(null)

  if (!pendingDoublesPrompt) return null

  const isCheckout = pendingDoublesPrompt.type === "checkout"

  function handleConfirm() {
    if (doublesAttempted === null) return
    confirmDoublesPrompt(isCheckout ? dartsUsed : null, doublesAttempted)
    setDartsUsed(3)
    setDoublesAttempted(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="relative w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl px-6 py-6 flex flex-col gap-5"
      >
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Before you continue</p>
          <p className="text-lg font-black">Darts at the Double</p>
        </div>

        {isCheckout && (
          <div>
            <p className="text-sm font-semibold mb-2">How many darts did you use to finish?</p>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setDartsUsed(n)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    dartsUsed === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold mb-2">
            {isCheckout ? "How many were at the double?" : "How many darts at the double this visit?"}
          </p>
          <div className="flex gap-2">
            {(isCheckout ? [1, 2, 3] : [0, 1, 2, 3]).map((n) => (
              <button
                key={n}
                onClick={() => setDoublesAttempted(n)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  doublesAttempted === n
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={doublesAttempted === null}
          className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirm
        </button>

        <button
          onClick={() => {
            confirmDoublesPrompt(isCheckout ? dartsUsed : null, 0)
            setDartsUsed(3)
            setDoublesAttempted(null)
          }}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip (don&apos;t record doubles)
        </button>
      </motion.div>
    </div>
  )
}
