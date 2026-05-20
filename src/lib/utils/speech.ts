let cachedVoice: SpeechSynthesisVoice | null = null

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
  if (score === 100) return "Ton!"
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
  window.speechSynthesis.cancel()

  if (isBust) {
    speak("Bust!", 0.85, 0.85)
    return
  }

  speak(scoreToCall(score), 0.88, score === 180 ? 1.25 : 1.0)

  if (isCheckout) {
    speak("Game shot!", 0.82, 1.15)
  } else if (nextPlayerRemainder <= 170 && nextPlayerRemainder > 1) {
    // Only call "requires" when the next player is in checkout range
    const firstName = nextPlayerName.split(" ")[0]
    speak(`${firstName} requires ${nextPlayerRemainder}`, 0.88, 1.0)
  }
}

export function announceLegWin(winnerName: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
  speak(`${winnerName.split(" ")[0]} wins the leg!`, 0.85, 1.1)
}

export function announceMatchWin(winnerName: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
  speak(`${winnerName.split(" ")[0]} wins the match!`, 0.82, 1.15)
}
