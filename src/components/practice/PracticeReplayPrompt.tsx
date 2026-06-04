"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { captureReplayForPlayer } from "@/lib/replay-capture"
import { getSupabase } from "@/lib/supabase"

const COUNTDOWN_SECS = 15
const BUCKET = "Replays"

export interface PendingPracticeReplay {
  playerId: string
  label: string
  context: Record<string, unknown>
  autoSave?: boolean
}

interface Props {
  pending: PendingPracticeReplay | null
  sessionId: string
  gameMode: string
  onDismiss: () => void
}

async function injectDuration(blob: Blob, durationMs: number): Promise<Blob> {
  const buf = await blob.arrayBuffer()
  const b = new Uint8Array(buf)
  const durEl = new Uint8Array(11)
  durEl[0] = 0x44; durEl[1] = 0x89; durEl[2] = 0x88
  new DataView(durEl.buffer).setFloat64(3, durationMs, false)
  const limit = Math.min(b.length - 20, 65536)
  for (let i = 0; i < limit; i++) {
    if (b[i] !== 0x15 || b[i+1] !== 0x49 || b[i+2] !== 0xA9 || b[i+3] !== 0x66) continue
    const v = b[i + 4]
    let infoSize: number, vintLen: number
    if      (v & 0x80) { infoSize = v & 0x7F;                    vintLen = 1 }
    else if (v & 0x40) { infoSize = ((v & 0x3F) << 8) | b[i+5]; vintLen = 2 }
    else continue
    const dataStart = i + 4 + vintLen
    const dataEnd   = dataStart + infoSize
    for (let j = dataStart; j < dataEnd - 10; j++) {
      if (b[j] === 0x44 && b[j+1] === 0x89 && b[j+2] === 0x88) {
        const out = new Uint8Array(buf)
        new DataView(out.buffer).setFloat64(j + 3, durationMs, false)
        return new Blob([out], { type: blob.type })
      }
    }
    const newSize = infoSize + 11
    if (vintLen === 1 && newSize > 0x7E) continue
    if (vintLen === 2 && newSize > 0x3FFF) continue
    const newVint = vintLen === 1
      ? new Uint8Array([0x80 | newSize])
      : new Uint8Array([0x40 | (newSize >> 8), newSize & 0xFF])
    const out = new Uint8Array(b.length + 11)
    let off = 0
    const cp = (from: number, to: number) => { out.set(b.subarray(from, to), off); off += to - from }
    cp(0, i + 4)
    out.set(newVint, off); off += newVint.length
    cp(dataStart, dataEnd)
    out.set(durEl, off); off += 11
    cp(dataEnd, b.length)
    return new Blob([out], { type: blob.type })
  }
  return blob
}

export function PracticeReplayPrompt({ pending, sessionId, gameMode, onDismiss }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECS)
  const [status, setStatus] = useState<"idle" | "buffering" | "saving" | "saved" | "noVideo" | "error">("idle")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!pending) {
      setSecondsLeft(COUNTDOWN_SECS)
      setStatus("idle")
      return
    }

    setSecondsLeft(COUNTDOWN_SECS)
    setStatus("idle")

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { onDismiss(); return 0 }
        return s - 1
      })
    }, 1000)

    // Half It manual saves: start saving immediately since user already tapped
    if (pending.autoSave) {
      void handleSave(pending)
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  async function handleSave(p = pending) {
    if (!p) return

    let result = captureReplayForPlayer(p.playerId)
    if (!result) {
      setStatus("buffering")
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500))
        result = captureReplayForPlayer(p.playerId)
        if (result) break
      }
    }

    if (!result) { setStatus("noVideo"); return }

    setStatus("saving")
    if (timerRef.current) clearInterval(timerRef.current)

    try {
      const contentType = result.blob.type || "video/webm"
      let blob = result.blob
      if (contentType.includes("webm")) {
        try { blob = await injectDuration(result.blob, result.durationMs) } catch { /* use original */ }
      }

      const urlRes = await fetch("/api/replays/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scorerPlayerId: p.playerId, mimeType: contentType }),
      })
      if (!urlRes.ok) throw new Error("Failed to get upload URL")
      const { token, path } = await urlRes.json() as { signedUrl: string; token: string; path: string }

      const supabase = getSupabase()
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(path, token, blob, { contentType })
      if (uploadError) throw new Error(uploadError.message)

      const metaRes = await fetch("/api/replays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey: path,
          practiceSessionId: sessionId,
          gameMode,
          practiceContext: p.context,
          scorerPlayerId: p.playerId,
          scoreThrown: 0,
          durationMs: result.durationMs,
        }),
      })
      if (!metaRes.ok) throw new Error("Failed to save metadata")

      setStatus("saved")
      setTimeout(() => onDismiss(), 1200)
    } catch {
      setStatus("error")
      setTimeout(() => onDismiss(), 2000)
    }
  }

  const progress = secondsLeft / COUNTDOWN_SECS

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          key="practice-replay-prompt"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="fixed bottom-24 right-3 z-[60] w-[220px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Action Replay
            </span>
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors leading-none text-base"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>

          <div className="px-3 pb-2 text-center">
            <div className="text-sm font-black leading-snug text-foreground">
              {pending.label}
            </div>
          </div>

          {!pending.autoSave && (
            <div className="mx-3 mb-2 h-1 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: "100%" }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.9, ease: "linear" }}
              />
            </div>
          )}

          <div className="px-3 pb-3">
            <button
              onClick={() => { if (status === "idle" || status === "noVideo") void handleSave() }}
              disabled={status === "saving" || status === "buffering" || status === "saved"}
              className="w-full py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground transition-all active:scale-95 disabled:opacity-60"
            >
              {status === "saving" && "Saving…"}
              {status === "buffering" && "Buffering…"}
              {status === "saved" && "Saved!"}
              {status === "noVideo" && "Retry Save"}
              {status === "error" && "Save failed — try again"}
              {status === "idle" && "Save Replay"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
