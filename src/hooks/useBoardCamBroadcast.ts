"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"
import { createPeerConnection, waitForIceGathering } from "@/lib/webrtc"

type FacingMode = "environment" | "user"

interface ZoomCapabilities {
  min: number
  max: number
  step: number
}

export function useBoardCamBroadcast(matchId: string, playerId: string) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<FacingMode>("environment")
  const [zoomCapabilities, setZoomCapabilities] = useState<ZoomCapabilities | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const streamRef = useRef<MediaStream | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null)
  const isCreatingOfferRef = useRef(false)
  const pendingReadyRef = useRef(false)

  const detectZoom = useCallback((stream: MediaStream) => {
    const track = stream.getVideoTracks()[0]
    if (!track) return
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
      zoom?: { min: number; max: number; step: number }
    }
    if (capabilities.zoom) {
      setZoomCapabilities(capabilities.zoom)
      setZoomLevel(capabilities.zoom.min)
    } else {
      setZoomCapabilities(null)
      setZoomLevel(1)
    }
  }, [])

  const createOffer = useCallback(async () => {
    if (!streamRef.current || !channelRef.current) return
    // If already building an offer, queue a re-offer for after it completes.
    // This handles the race where a spectator sends READY during ICE gathering.
    if (isCreatingOfferRef.current) {
      pendingReadyRef.current = true
      return
    }
    isCreatingOfferRef.current = true
    try {
      pcRef.current?.close()
      const pc = createPeerConnection()
      pcRef.current = pc

      streamRef.current.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Non-trickle ICE: wait for all candidates to be gathered before sending.
      // This eliminates race conditions where candidates arrive before setRemoteDescription.
      await waitForIceGathering(pc)

      channelRef.current?.send({ type: "broadcast", event: "OFFER", payload: pc.localDescription })
    } finally {
      isCreatingOfferRef.current = false
      // Run the queued re-offer if a READY arrived while we were gathering
      if (pendingReadyRef.current) {
        pendingReadyRef.current = false
        createOffer()
      }
    }
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
    setZoomCapabilities(null)
    setZoomLevel(1)
  }, [])

  const start = useCallback(async (facing: FacingMode = "environment") => {
    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      streamRef.current = stream
      setLocalStream(stream)
      setFacingMode(facing)
      setIsStreaming(true)
      setError(null)

      detectZoom(stream)

      const supabase = getSupabase()
      const channel = supabase.channel(`boardcam:${matchId}:${playerId}`)
      channelRef.current = channel

      channel.on("broadcast", { event: "ANSWER" }, async ({ payload }) => {
        if (!pcRef.current) return
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload))
      })

      // Re-offer when a spectator joins after streaming started
      channel.on("broadcast", { event: "READY" }, async () => {
        if (!streamRef.current) return
        await createOffer()
      })

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await createOffer()
        }
      })
    } catch {
      setError("Camera access denied or unavailable")
      stop()
    }
  }, [matchId, playerId, createOffer, stop, detectZoom])

  const flipCamera = useCallback(async () => {
    if (!streamRef.current) return
    const newFacing: FacingMode = facingMode === "environment" ? "user" : "environment"
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacing }, audio: false })
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video")
        if (sender) await sender.replaceTrack(newStream.getVideoTracks()[0])
      }
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = newStream
      setLocalStream(newStream)
      setFacingMode(newFacing)
      detectZoom(newStream)
    } catch {
      // Camera flip not supported on this device
    }
  }, [facingMode, detectZoom])

  const setZoom = useCallback(async (zoom: number) => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    await track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] })
    setZoomLevel(zoom)
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { isStreaming, error, localStream, facingMode, zoomCapabilities, zoomLevel, setZoom, start, stop, flipCamera }
}
