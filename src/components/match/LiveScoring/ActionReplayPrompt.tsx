"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { captureReplayForPlayer } from "@/lib/replay-capture"
import { getSupabase } from "@/lib/supabase"

const COUNTDOWN_SECS = 10
const BUCKET = "Replays"

// Inject (or update) the EBML Duration element inside the WebM Info section.
// Chrome's MediaRecorder never writes Duration, so the browser can't display video length.
// We parse the EBML structure, find the Info element (0x1549A966), and insert
// a Duration float64 element (0x4489) with the known recording length.
async function injectDuration(blob: Blob, durationMs: number): Promise<Blob> {
  const buf = await blob.arrayBuffer()
  const b = new Uint8Array(buf)

  // Duration element bytes: ID(2) + VINT-size=8(1) + float64 big-endian(8) = 11 bytes
  const durEl = new Uint8Array(11)
  durEl[0] = 0x44; durEl[1] = 0x89; durEl[2] = 0x88
  new DataView(durEl.buffer).setFloat64(3, durationMs, false)

  // Search for Info element ID within first 64 KB (it's always near the start)
  const limit = Math.min(b.length - 20, 65536)
  for (let i = 0; i < limit; i++) {
    if (b[i] !== 0x15 || b[i+1] !== 0x49 || b[i+2] !== 0xA9 || b[i+3] !== 0x66) continue

    // Read VINT-encoded size at i+4
    const v = b[i + 4]
    let infoSize: number, vintLen: number
    if      (v & 0x80) { infoSize = v & 0x7F;                   vintLen = 1 }
    else if (v & 0x40) { infoSize = ((v & 0x3F) << 8) | b[i+5]; vintLen = 2 }
    else continue // 3+ byte VINT — very unlikely, skip

    const dataStart = i + 4 + vintLen
    const dataEnd   = dataStart + infoSize

    // If Duration (0x4489) already present: overwrite its float64 value in-place
    for (let j = dataStart; j < dataEnd - 10; j++) {
      if (b[j] === 0x44 && b[j+1] === 0x89 && b[j+2] === 0x88) {
        const out = new Uint8Array(buf)
        new DataView(out.buffer).setFloat64(j + 3, durationMs, false)
        return new Blob([out], { type: blob.type })
      }
    }

    // Duration absent — append it; update Info's VINT size (same width assumed safe)
    const newSize = infoSize + 11
    if (vintLen === 1 && newSize > 0x7E) continue // overflow — skip
    if (vintLen === 2 && newSize > 0x3FFF) continue
    const newVint = vintLen === 1
      ? new Uint8Array([0x80 | newSize])
      : new Uint8Array([0x40 | (newSize >> 8), newSize & 0xFF])

    const out = new Uint8Array(b.length + 11)
    let off = 0
    const cp = (from: number, to: number) => { out.set(b.subarray(from, to), off); off += to - from }
    cp(0, i + 4)                  // everything up to and including Info ID
    out.set(newVint, off); off += newVint.length  // updated size VINT
    cp(dataStart, dataEnd)        // original Info content (skip old VINT)
    out.set(durEl, off); off += 11  // new Duration element
    cp(dataEnd, b.length)         // Tracks + Clusters
    return new Blob([out], { type: blob.type })
  }

  return blob // Info not found — return unchanged (shouldn't happen)
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
      // Inject Duration element into EBML Info section so the browser can display video length
      let blob = result.blob
      try { blob = await injectDuration(result.blob, result.durationMs) } catch { /* use original */ }

      // Step 1: get a signed upload URL from the server
      const urlRes = await fetch("/api/replays/upload-url", { method: "POST" })
      if (!urlRes.ok) throw new Error("Failed to get upload URL")
      const { token, path } = await urlRes.json() as { signedUrl: string; token: string; path: string }

      // Step 2: upload blob directly to Supabase (bypasses Vercel payload limits)
      const supabase = getSupabase()
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(path, token, blob, { contentType: "video/webm" })
      if (uploadError) throw new Error(uploadError.message)

      // Step 3: save metadata via API (no blob, no size limit issue)
      const metaRes = await fetch("/api/replays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey: path,
          matchId,
          scoreThrown: pendingReplay.scoreThrown,
          isCheckout: pendingReplay.isCheckout,
          remainder: pendingReplay.remainder,
          opponentName: pendingReplay.opponentName,
          playerLegsWon: pendingReplay.playerLegsWon,
          oppLegsWon: pendingReplay.oppLegsWon,
          startingScore,
          durationMs: result.durationMs,
        }),
      })
      if (!metaRes.ok) throw new Error("Failed to save metadata")

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

          <div className="px-3 pb-2 text-center">
            <p className="text-[11px] text-muted-foreground leading-snug">
              vs {pendingReplay.opponentName}
            </p>
            <p className="text-[11px] font-semibold">
              {pendingReplay.playerLegsWon}–{pendingReplay.oppLegsWon} legs
            </p>
          </div>

          <div className="mx-3 mb-2 h-1 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: "100%" }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.9, ease: "linear" }}
            />
          </div>

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
