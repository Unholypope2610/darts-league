"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true)
      return
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => setInstalled(true))
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  async function handleClick() {
    if (installEvent) {
      await installEvent.prompt()
      const { outcome } = await installEvent.userChoice
      if (outcome === "accepted") setInstalled(true)
      setInstallEvent(null)
    } else {
      setShowHint(!showHint)
    }
  }

  if (installed) return null

  const hint = isIOS
    ? 'Tap the Share button in Safari then "Add to Home Screen"'
    : 'In Chrome, click the install icon (⊕) in the address bar, or use the browser menu → "Install Darts League"'

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
      >
        <Download className="w-3.5 h-3.5" />
        Install
      </button>

      {showHint && (
        <div className="absolute top-10 right-0 z-50 bg-card border border-border rounded-xl p-4 shadow-xl w-64 text-sm">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-medium">Install Darts League</p>
            <button onClick={() => setShowHint(false)}>
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
        </div>
      )}
    </div>
  )
}
