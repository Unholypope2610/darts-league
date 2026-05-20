"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"
import { createPeerConnection } from "@/lib/webrtc"

type FacingMode = "environment" | "user"

export function useBoardCamBroadcast(matchId: string, playerId: string) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<FacingMode>("environment")
  const streamRef = useRef<MediaStream | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null)

  const createOffer = useCallback(async () => {
    if (!streamRef.current || !channelRef.current) return
    // Close any existing PC before creating a fresh one
    pcRef.current?.close()
    const pc = createPeerConnection()
    pcRef.current = pc

    streamRef.current.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!))

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        channelRef.current?.send({ type: "broadcast", event: "ICE_BROADCASTER", payload: candidate.toJSON() })
      }
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    channelRef.current?.send({ type: "broadcast", event: "OFFER", payload: offer })
  }, [])

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

  const start = useCallback(async (facing: FacingMode = "environment") => {
    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
      } catch {
        // Fall back to any available camera if the requested facing mode isn't available
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      streamRef.current = stream
      setLocalStream(stream)
      setFacingMode(facing)

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

      // When a spectator joins after we started streaming, re-offer so they get the feed
      channel.on("broadcast", { event: "READY" }, async () => {
        if (!streamRef.current) return
        await createOffer()
      })

      // Wait until actually subscribed before sending the offer
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await createOffer()
          setIsStreaming(true)
          setError(null)
        }
      })
    } catch {
      setError("Camera access denied or unavailable")
      stop()
    }
  }, [matchId, playerId, createOffer, stop])

  const flipCamera = useCallback(async () => {
    if (!streamRef.current) return
    const newFacing: FacingMode = facingMode === "environment" ? "user" : "environment"
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacing }, audio: false })
      // Replace the video track on the existing peer connection without renegotiation
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video")
        if (sender) await sender.replaceTrack(newStream.getVideoTracks()[0])
      }
      // Stop old tracks and swap stream
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = newStream
      setLocalStream(newStream)
      setFacingMode(newFacing)
    } catch {
      // Camera flip not supported on this device; silently ignore
    }
  }, [facingMode])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { isStreaming, error, localStream, facingMode, start, stop, flipCamera }
}
