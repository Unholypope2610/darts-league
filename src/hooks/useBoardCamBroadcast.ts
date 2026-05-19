"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"
import { createPeerConnection } from "@/lib/webrtc"

export function useBoardCamBroadcast(matchId: string, playerId: string) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLocalStream(null)
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
      setLocalStream(stream)

      const supabase = getSupabase()
      const channel = supabase.channel(`boardcam:${matchId}:${playerId}`)
      channelRef.current = channel

      channel.on("broadcast", { event: "ANSWER" }, async ({ payload }) => {
        if (!pcRef.current) return
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload))
      })

      channel.on("broadcast", { event: "ICE_SPECTATOR" }, async ({ payload }) => {
        if (!pcRef.current) return
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(payload)) } catch {}
      })

      channel.subscribe()

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
    } catch {
      setError("Camera access denied or unavailable")
      stop()
    }
  }, [matchId, playerId, stop])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { isStreaming, error, localStream, start, stop }
}
