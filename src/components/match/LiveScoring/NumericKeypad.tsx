"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils/cn"
import { useLiveMatchStore } from "@/stores/live-match.store"

const SHORTCUTS = [26, 41, 45, 60, 85, 100, 140, 180]
const DIGITS = ["7", "8", "9", "4", "5", "6", "1", "2", "3"]

export function NumericKeypad() {
  const { dartInput, inputDigit, inputShortcut, clearInput, backspace, submitVisit, undoLastVisit, isSubmitting } =
    useLiveMatchStore()

  const score = dartInput === "" ? null : parseInt(dartInput, 10)

  // Keyboard bindings
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key >= "0" && e.key <= "9") inputDigit(e.key)
      if (e.key === "Enter") submitVisit()
      if (e.key === "Backspace") backspace()
      if (e.key === "u" || e.key === "U") undoLastVisit()
      if (e.key === "Escape") clearInput()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [inputDigit, submitVisit, backspace, undoLastVisit, clearInput])

  return (
    <div className="flex flex-col gap-2 w-full max-w-xs mx-auto select-none">
      {/* Shortcut buttons */}
      <div className="grid grid-cols-4 gap-1.5">
        {SHORTCUTS.map((s) => (
          <button
            key={s}
            onClick={() => inputShortcut(s, s === 180 ? 3 : 3)}
            className={cn(
              "py-2 rounded-lg text-sm font-bold transition-all",
              "bg-muted hover:bg-primary/20 hover:text-primary active:scale-95",
              "touch-manipulation",
            )}
            style={{ touchAction: "manipulation" }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Score display */}
      <div className="flex items-center justify-center h-14 rounded-xl bg-muted border border-border">
        <span className="font-score text-3xl font-bold tracking-tight">
          {dartInput === "" ? (
            <span className="text-muted-foreground text-xl">Enter score</span>
          ) : (
            dartInput
          )}
        </span>
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((d) => (
          <button
            key={d}
            onClick={() => inputDigit(d)}
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
        {/* Bottom row: backspace, 0, confirm */}
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
          onClick={submitVisit}
          disabled={score === null || isSubmitting}
          className={cn(
            "h-14 rounded-xl text-xl font-bold transition-all touch-manipulation",
            score !== null && !isSubmitting
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
          style={{ touchAction: "manipulation" }}
          aria-label="Confirm score"
        >
          ✓
        </button>
      </div>

      {/* Undo button */}
      <button
        onClick={() => undoLastVisit()}
        disabled={isSubmitting}
        className="py-2.5 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 active:scale-95 text-muted-foreground hover:text-foreground transition-all touch-manipulation"
        style={{ touchAction: "manipulation" }}
        aria-label="Undo last visit (U)"
      >
        ↩ Undo (U)
      </button>
    </div>
  )
}
