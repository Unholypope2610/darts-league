import { getCheckoutSuggestion } from "@/lib/algorithms/checkout-suggestions"

let cachedVoice: SpeechSynthesisVoice | null = null

// Set to true by the live match page when the viewer is a spectator so the
// caller is always active regardless of the per-device localStorage setting.
let spectatorOverride = false

export function setSpectatorCallerOverride(enabled: boolean) {
  spectatorOverride = enabled
}

function isCallerEnabled(): boolean {
  if (spectatorOverride) return true
  if (typeof window === "undefined") return true
  return localStorage.getItem("masterCallerEnabled") !== "false"
}

function getVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice
  const voices = window.speechSynthesis.getVoices()
  cachedVoice =
    voices.find((v) => v.lang.startsWith("en-GB")) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null
  return cachedVoice
}

function speak(text: string, rate = 0.88, pitch = 1.0) {
  // iOS pauses synthesis when app loses focus; resume before speaking
  window.speechSynthesis.resume()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = rate
  u.pitch = pitch
  u.volume = 1
  const v = getVoice()
  if (v) u.voice = v
  window.speechSynthesis.speak(u)
}

// Call this inside a synchronous user-gesture handler to unlock iOS speech synthesis
export function prewarmSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  const u = new SpeechSynthesisUtterance("")
  u.volume = 0
  window.speechSynthesis.speak(u)
  // Trigger voice list load so getVoice() has voices ready
  window.speechSynthesis.getVoices()
}

function scoreToCall(score: number): string {
  if (score === 180) return "One hundred and eighty!"
  if (score === 171) return "One hundred and seventy one"
  if (score === 170) return "One hundred and seventy"
  if (score === 167) return "One hundred and sixty seven"
  if (score === 160) return "One hundred and sixty"
  if (score === 100) return "One hundred!"
  return String(score)
}

export function announceVisit(
  score: number,
  nextPlayerRemainder: number,
  nextPlayerName: string,
  isCheckout: boolean,
  isBust: boolean,
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  if (!isCallerEnabled()) return
  window.speechSynthesis.cancel()

  if (isBust) {
    speak("Bust!", 0.85, 0.85)
    if (getCheckoutSuggestion(nextPlayerRemainder)) {
      const firstName = nextPlayerName.split(" ")[0]
      speak(`${firstName} requires ${nextPlayerRemainder}`, 0.88, 1.0)
    }
    return
  }

  speak(scoreToCall(score), 0.88, score === 180 ? 1.25 : 1.0)

  if (isCheckout) {
    speak("Game shot!", 0.82, 1.15)
  } else if (getCheckoutSuggestion(nextPlayerRemainder)) {
    const firstName = nextPlayerName.split(" ")[0]
    speak(`${firstName} requires ${nextPlayerRemainder}`, 0.88, 1.0)
  }
}

export function announceFirstThrow(name: string, nickname: string | null) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  if (!isCallerEnabled()) return
  window.speechSynthesis.cancel()
  const parts = name.trim().split(/\s+/)
  const firstName = parts[0]
  const surname = parts.slice(1).join(" ")
  const text = nickname
    ? `${firstName}, ${nickname}, ${surname ? surname + "," : ""} to throw first`.replace(/\s+/g, " ").trim()
    : `${name} to throw first`
  speak(text, 0.85, 1.0)
}

export function announceLegWin(winnerName: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  if (!isCallerEnabled()) return
  window.speechSynthesis.cancel()
  speak(`${winnerName.split(" ")[0]} wins the leg!`, 0.85, 1.1)
}

export function announceMatchWin(winnerName: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  if (!isCallerEnabled()) return
  window.speechSynthesis.cancel()
  speak(`${winnerName.split(" ")[0]} wins the match!`, 0.82, 1.15)
}

// ── Practice Arena caller functions ──────────────────────────────────────────

export function announceBobs27Round(target: string, dartsHit: number, pointsChange: number) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  if (!isCallerEnabled()) return
  const label = target === "D25" ? "Bull" : target.replace("D", "Double ")
  if (dartsHit === 0) {
    speak(`${label}. Missed. Minus ${Math.abs(pointsChange)}.`, 0.88, 1.0)
  } else if (dartsHit === 3) {
    speak(`${label}. Perfect! Plus ${pointsChange}.`, 0.85, 1.1)
  } else {
    speak(`${label}. ${dartsHit} hit${dartsHit > 1 ? "s" : ""}. Plus ${pointsChange}.`, 0.88, 1.0)
  }
}

export function announceCricketDart(target: string, multiplier: number) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  if (!isCallerEnabled()) return
  const targetLabel = target === "BULL" ? "Bull" : target
  const multLabel = multiplier === 3 ? "Triple" : multiplier === 2 ? "Double" : "Single"
  speak(`${multLabel} ${targetLabel}!`, 0.85, 1.05)
}

export function announceHalfItRound(
  target: { type: string; value?: number },
  pointsScored: number,
  wasHalved: boolean,
  newTotal: number,
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  if (!isCallerEnabled()) return
  if (wasHalved) {
    speak(`No score. Halved to ${newTotal}.`, 0.85, 1.0)
  } else if (pointsScored > 0) {
    // Only say total if it differs from this round's score (i.e. not the very first round)
    const suffix = newTotal !== pointsScored ? `. Total: ${newTotal}` : ""
    speak(`${pointsScored}${suffix}.`, 0.88, 1.0)
  }
}
