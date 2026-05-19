"use client"

import { useRef, useEffect, useState } from "react"
import { useBoardCamSpectate } from "@/hooks/useBoardCamSpectate"
import { cn } from "@/lib/utils/cn"

interface BoardCamSpectatorProps {
  matchId: string
}

export function BoardCamSpectator({ matchId }: BoardCamSpectatorProps) {
  const { remoteStream, isConnected } = useBoardCamSpectate(matchId)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 h-24 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">No board cam signal</p>
      </div>
    )
  }

  return (
    <div className={cn("rounded-xl overflow-hidden border border-emerald-500/30 relative", isFullscreen && "fixed inset-0 z-50 rounded-none border-0")}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-md px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs text-white font-medium">LIVE</span>
      </div>
      <button
        onClick={() => setIsFullscreen(!isFullscreen)}
        className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-md"
      >
        {isFullscreen ? "Exit" : "⛶"}
      </button>
    </div>
  )
}
