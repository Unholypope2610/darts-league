"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils/cn"
import { useLiveMatchStore } from "@/stores/live-match.store"
import { prewarmSpeech } from "@/lib/utils/speech"

const DIGITS = ["7", "8", "9", "4", "5", "6", "1", "2", "3"]

export function NumericKeypad() {
  const {
    dartInput, inputDigit, clearInput, backspace,
    submitVisit, submitBust, isSubmitting,
    playerARemainder, playerBRemainder, currentTurnPlayerId, playerA,
  } = useLiveMatchStore()

  const hasPrewarmedRef = useRef(false)

  function handlePress(fn: () => void) {
    if (!hasPrewarmedRef.current) {
      prewarmSpeech()
      hasPrewarmedRef.current = true
    }
    fn()
  }

  const currentRemainder = currentTurnPlayerId === playerA?.id ? playerARemainder : playerBRemainder
  const score = dartInput === "" ? null : parseInt(dartInput, 10)
  const bustEnabled = currentRemainder <= 181

  // Keyboard bindings
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key >= "0" && e.key <= "9") inputDigit(e.key)
      if (e.key === "Enter") submitVisit()
      if (e.key === "Backspace") backspace()
      if (e.key === "Escape") clearInput()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [inputDigit, submitVisit, backspace, clearInput])

  return (
    <div className="flex flex-col gap-2 w-full max-w-xs mx-auto select-none">
      {/* Score display with inline confirm tick */}
      <div className="flex items-center gap-2 h-14 rounded-xl bg-muted border border-border px-3">
        <span className="flex-1 font-score text-3xl font-bold tracking-tight">
          {dartInput === "" ? (
            <span className="text-muted-foreground text-xl">Enter score</span>
          ) : (
            dartInput
          )}
        </span>
        <button
          onClick={() => handlePress(submitVisit)}
          disabled={score === null || isSubmitting}
          className={cn(
            "h-11 w-11 shrink-0 rounded-lg text-xl font-bold transition-all touch-manipulation",
            score !== null && !isSubmitting
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
              : "bg-muted text-muted-foreground/40 cursor-not-allowed",
          )}
          style={{ touchAction: "manipulation" }}
          aria-label="Confirm score"
        >
          ✓
        </button>
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((d) => (
          <button
            key={d}
            onClick={() => handlePress(() => inputDigit(d))}
            className={cn(
              "h-14 rounded-xl text-xl font-bold transition-all",
              "bg-muted hover:bg-muted/80 active:scale-95 active:bg-primary/10",
              "touch-manipulation",
            )}
            style={{ touchAction: "manipulation" }}
          >
            {d}
          </button>
        ))}
        {/* Bottom row: backspace, 0, BUST */}
        <button
          onClick={backspace}
          className="h-14 rounded-xl text-xl font-bold bg-muted hover:bg-muted/80 active:scale-95 touch-manipulation"
          aria-label="Backspace"
          style={{ touchAction: "manipulation" }}
        >
          ⌫
        </button>
        <button
          onClick={() => inputDigit("0")}
          className="h-14 rounded-xl text-xl font-bold bg-muted hover:bg-muted/80 active:scale-95 touch-manipulation"
          style={{ touchAction: "manipulation" }}
        >
          0
        </button>
        <button
          onClick={() => handlePress(submitBust)}
          disabled={!bustEnabled || isSubmitting}
          className={cn(
            "h-14 rounded-xl text-sm font-bold transition-all touch-manipulation",
            bustEnabled && !isSubmitting
              ? "bg-destructive/80 text-destructive-foreground hover:bg-destructive active:scale-95"
              : "bg-muted text-muted-foreground/30 cursor-not-allowed",
          )}
          style={{ touchAction: "manipulation" }}
          aria-label="Bust"
        >
          BUST
        </button>
      </div>

    </div>
  )
}
