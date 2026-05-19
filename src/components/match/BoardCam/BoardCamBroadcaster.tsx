"use client"

import { useRef, useEffect } from "react"
import { useBoardCamBroadcast } from "@/hooks/useBoardCamBroadcast"
import { cn } from "@/lib/utils/cn"

interface BoardCamBroadcasterProps {
  matchId: string
}

export function BoardCamBroadcaster({ matchId }: BoardCamBroadcasterProps) {
  const { isStreaming, error, start, stop } = useBoardCamBroadcast(matchId)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (isStreaming && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
    }
  }, [isStreaming])

  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              isStreaming ? "bg-red-500 animate-pulse" : "bg-muted-foreground",
            )}
          />
          <span className="text-xs font-medium">Board Cam</span>
        </div>
        <button
          onClick={isStreaming ? stop : start}
          className={cn(
            "text-xs px-3 py-1 rounded-lg font-medium transition-all",
            isStreaming
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-muted hover:bg-muted/80 text-foreground",
          )}
        >
          {isStreaming ? "Stop" : "Start Camera"}
        </button>
      </div>
      {isStreaming && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-24 object-cover rounded-lg bg-black"
        />
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
