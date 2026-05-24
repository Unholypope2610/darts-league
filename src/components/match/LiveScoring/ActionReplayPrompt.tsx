"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { captureReplayForPlayer } from "@/lib/replay-capture"

const COUNTDOWN_SECS = 10

async function applyDurationFix(blob: Blob, durationMs: number): Promise<Blob> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fix = require("fix-webm-duration") as (b: Blob, d: number, cb: (fixed: Blob) => void) => void
    return await new Promise<Blob>((resolve) => fix(blob, durationMs, resolve))
  } catch {
    return blob
  }
}

export function ActionReplayPrompt() {
  const { pendingReplay, matchId, startingScore, clearPendingReplay } = useLiveMatchStore()
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECS)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "noVideo" | "error">("idle")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!pendingReplay) {
      setSecondsLeft(COUNTDOWN_SECS)
      setStatus("idle")
      return
    }

    setSecondsLeft(COUNTDOWN_SECS)
    setStatus("idle")

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearPendingReplay()
          return 0
        }
        return s - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [pendingReplay, clearPendingReplay])

  async function handleSave() {
    if (!pendingReplay || !matchId) return

    const result = captureReplayForPlayer(pendingReplay.playerId)
    if (!result) {
      setStatus("noVideo")
      setTimeout(() => clearPendingReplay(), 2000)
      return
    }

    setStatus("saving")
    if (timerRef.current) clearInterval(timerRef.current)

    try {
      const videoBlob = await applyDurationFix(result.blob, result.durationMs)

      const form = new FormData()
      form.append("video", videoBlob, "replay.webm")
      form.append("matchId", matchId)
      form.append("scoreThrown", String(pendingReplay.scoreThrown))
      form.append("isCheckout", String(pendingReplay.isCheckout))
      form.append("remainder", String(pendingReplay.remainder))
      form.append("opponentName", pendingReplay.opponentName)
      form.append("playerLegsWon", String(pendingReplay.playerLegsWon))
      form.append("oppLegsWon", String(pendingReplay.oppLegsWon))
      form.append("startingScore", String(startingScore))

      const res = await fetch("/api/replays", { method: "POST", body: form })
      if (!res.ok) throw new Error("Upload failed")

      setStatus("saved")
      setTimeout(() => clearPendingReplay(), 1200)
    } catch {
      setStatus("error")
      setTimeout(() => clearPendingReplay(), 2000)
    }
  }

  const progress = secondsLeft / COUNTDOWN_SECS

  return (
    <AnimatePresence>
      {pendingReplay && (
        <motion.div
          key="replay-prompt"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="fixed bottom-24 right-3 z-40 w-[220px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Action Replay
            </span>
            <button
              onClick={clearPendingReplay}
              className="text-muted-foreground hover:text-foreground transition-colors leading-none text-base"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>

          {/* Score */}
          <div className="px-3 pb-1 text-center">
            <div className="text-4xl font-black tabular-nums leading-none">
              {pendingReplay.scoreThrown}
            </div>
            {pendingReplay.isCheckout && (
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">
                Checkout!
              </div>
            )}
          </div>

          {/* Context */}
          <div className="px-3 pb-2 text-center">
            <p className="text-[11px] text-muted-foreground leading-snug">
              vs {pendingReplay.opponentName}
            </p>
            <p className="text-[11px] font-semibold">
              {pendingReplay.playerLegsWon}–{pendingReplay.oppLegsWon} legs
            </p>
          </div>

          {/* Countdown bar */}
          <div className="mx-3 mb-2 h-1 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: "100%" }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.9, ease: "linear" }}
            />
          </div>

          {/* Save button */}
          <div className="px-3 pb-3">
            <button
              onClick={handleSave}
              disabled={status === "saving"}
              className="w-full py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground transition-all active:scale-95 disabled:opacity-60"
            >
              {status === "saving" && "Saving…"}
              {status === "saved" && "Saved!"}
              {status === "noVideo" && "Buffer not ready yet"}
              {status === "error" && "Save failed — try again"}
              {status === "idle" && "Save Replay"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
