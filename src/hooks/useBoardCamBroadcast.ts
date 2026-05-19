"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"
import { createPeerConnection } from "@/lib/webrtc"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export function useBoardCamBroadcast(matchId: string) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    channelRef.current?.send({ type: "broadcast", event: "HANGUP", payload: {} })
    channelRef.current?.unsubscribe()
    channelRef.current = null
    setIsStreaming(false)
  }, [])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream

      const channel = supabase.channel(`boardcam:${matchId}`)
      channelRef.current = channel

      channel.on("broadcast", { event: "ANSWER" }, async ({ payload }) => {
        if (!pcRef.current) return
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload))
      })

      channel.on("broadcast", { event: "ICE_SPECTATOR" }, async ({ payload }) => {
        if (!pcRef.current) return
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(payload)) } catch {}
      })

      await channel.subscribe()

      const pc = createPeerConnection()
      pcRef.current = pc
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) channel.send({ type: "broadcast", event: "ICE_BROADCASTER", payload: candidate.toJSON() })
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      channel.send({ type: "broadcast", event: "OFFER", payload: offer })

      setIsStreaming(true)
      setError(null)
    } catch (e) {
      setError("Camera access denied or unavailable")
      stop()
    }
  }, [matchId, stop])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { isStreaming, error, stream: streamRef.current, start, stop }
}
