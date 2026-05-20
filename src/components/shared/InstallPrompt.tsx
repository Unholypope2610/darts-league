"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true)
      return
    }

    // Detect iOS (no beforeinstallprompt support)
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

  async function handleInstall() {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === "accepted") setInstalled(true)
    setInstallEvent(null)
  }

  if (installed) return null

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSHint(!showIOSHint)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          Install
        </button>
        {showIOSHint && (
          <div className="absolute top-14 right-4 z-50 bg-card border border-border rounded-xl p-4 shadow-xl max-w-xs text-sm">
            <p className="font-medium mb-1">Install on iPhone</p>
            <p className="text-muted-foreground text-xs">Tap the <strong>Share</strong> button in Safari, then <strong>"Add to Home Screen"</strong></p>
            <button onClick={() => setShowIOSHint(false)} className="mt-3 text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
        )}
      </>
    )
  }

  if (!installEvent) return null

  return (
    <button
      onClick={handleInstall}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
    >
      <Download className="w-3.5 h-3.5" />
      Install App
    </button>
  )
}
