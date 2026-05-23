"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"
import { createPeerConnection } from "@/lib/webrtc"

type FacingMode = "environment" | "user"

interface ZoomCapabilities {
  min: number
  max: number
  step: number
}

// Software zoom range exposed to UI when hardware zoom is unavailable (iOS)
const SW_ZOOM_CAPS: ZoomCapabilities = { min: 1, max: 3, step: 0.5 }

export function useBoardCamBroadcast(matchId: string, playerId: string) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<FacingMode>("environment")
  const [zoomCapabilities, setZoomCapabilities] = useState<ZoomCapabilities | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)

  // streamRef = stream sent over WebRTC (canvas stream in SW mode, raw stream in HW mode)
  const streamRef = useRef<MediaStream | null>(null)
  // rawStreamRef = actual getUserMedia stream (always the real camera)
  const rawStreamRef = useRef<MediaStream | null>(null)

  // Canvas pipeline refs (only used when hardware zoom unavailable)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rawVideoRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const softwareZoomRef = useRef(1) // mutated directly by setZoom — no re-render lag in RAF loop
  const isSoftwareZoomRef = useRef(false)

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const creatingOfferRef = useRef<Set<string>>(new Set())
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null)

  // ── Canvas draw loop ────────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    const video = rawVideoRef.current
    if (!canvas || !video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(drawFrame)
      return
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) { rafRef.current = requestAnimationFrame(drawFrame); return }

    const zoom = softwareZoomRef.current
    const w = video.videoWidth
    const h = video.videoHeight
    const cropW = w / zoom
    const cropH = h / zoom
    ctx.drawImage(video, (w - cropW) / 2, (h - cropH) / 2, cropW, cropH, 0, 0, canvas.width, canvas.height)

    rafRef.current = requestAnimationFrame(drawFrame)
  }, [])

  const stopCanvasPipeline = useCallback(() => {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (rawVideoRef.current) { rawVideoRef.current.srcObject = null; rawVideoRef.current = null }
    canvasRef.current = null
    isSoftwareZoomRef.current = false
    softwareZoomRef.current = 1
  }, [])

  const startCanvasPipeline = useCallback(async (rawStream: MediaStream): Promise<MediaStream> => {
    const rawVideo = document.createElement("video")
    rawVideo.srcObject = rawStream
    rawVideo.muted = true
    rawVideo.playsInline = true
    rawVideo.autoplay = true
    rawVideoRef.current = rawVideo

    await new Promise<void>((resolve) => {
      rawVideo.onloadedmetadata = () => resolve()
      rawVideo.play().catch(() => {})
    })

    const canvas = document.createElement("canvas")
    canvas.width = rawVideo.videoWidth || 1280
    canvas.height = rawVideo.videoHeight || 720
    canvasRef.current = canvas

    softwareZoomRef.current = 1
    isSoftwareZoomRef.current = true
    rafRef.current = requestAnimationFrame(drawFrame)

    return canvas.captureStream(30)
  }, [drawFrame])

  // ── Zoom detection ──────────────────────────────────────────────────────────
  const detectZoom = useCallback((stream: MediaStream): boolean => {
    const track = stream.getVideoTracks()[0]
    if (!track) return false
    const caps = track.getCapabilities() as MediaTrackCapabilities & {
      zoom?: { min: number; max: number; step: number }
    }
    if (caps.zoom) {
      setZoomCapabilities(caps.zoom)
      setZoomLevel(caps.zoom.min)
      return true
    }
    return false
  }, [])

  // ── WebRTC offer ────────────────────────────────────────────────────────────
  const createOffer = useCallback(async (spectatorId: string) => {
    if (!streamRef.current || !channelRef.current) return
    if (creatingOfferRef.current.has(spectatorId)) return
    creatingOfferRef.current.add(spectatorId)
    try {
      pcsRef.current.get(spectatorId)?.close()
      const pc = createPeerConnection()
      pcsRef.current.set(spectatorId, pc)

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          channelRef.current?.send({
            type: "broadcast",
            event: "ICE_CANDIDATE_B",
            payload: { spectatorId, candidate: candidate.toJSON() },
          })
        }
      }

      streamRef.current.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      channelRef.current?.send({
        type: "broadcast",
        event: "OFFER",
        payload: { spectatorId, type: offer.type, sdp: offer.sdp },
      })
    } finally {
      creatingOfferRef.current.delete(spectatorId)
    }
  }, [])

  // ── Stop ────────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    stopCanvasPipeline()
    rawStreamRef.current?.getTracks().forEach((t) => t.stop())
    rawStreamRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLocalStream(null)
    pcsRef.current.forEach((pc) => pc.close())
    pcsRef.current.clear()
    channelRef.current?.send({ type: "broadcast", event: "HANGUP", payload: {} })
    channelRef.current?.unsubscribe()
    channelRef.current = null
    setIsStreaming(false)
    setZoomCapabilities(null)
    setZoomLevel(1)
  }, [stopCanvasPipeline])

  // ── Start ───────────────────────────────────────────────────────────────────
  const start = useCallback(async (facing: FacingMode = "environment") => {
    try {
      let rawStream: MediaStream
      try {
        rawStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
      } catch {
        rawStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      rawStreamRef.current = rawStream
      setFacingMode(facing)
      setError(null)

      const hasHardwareZoom = detectZoom(rawStream)

      let broadcastStream: MediaStream
      if (hasHardwareZoom) {
        broadcastStream = rawStream
      } else {
        // iOS and other devices without hardware zoom — canvas software zoom
        broadcastStream = await startCanvasPipeline(rawStream)
        setZoomCapabilities(SW_ZOOM_CAPS)
        setZoomLevel(1)
      }

      streamRef.current = broadcastStream
      setLocalStream(broadcastStream)
      setIsStreaming(true)

      const supabase = getSupabase()
      const channel = supabase.channel(`boardcam:${matchId}:${playerId}`)
      channelRef.current = channel

      channel.on("broadcast", { event: "ANSWER" }, async ({ payload }) => {
        const { spectatorId, type, sdp } = payload as { spectatorId: string; type: RTCSdpType; sdp: string }
        const pc = pcsRef.current.get(spectatorId)
        if (!pc) return
        try { await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp })) } catch { /* stale */ }
      })

      channel.on("broadcast", { event: "ICE_CANDIDATE_S" }, async ({ payload }) => {
        const { spectatorId, candidate } = payload as { spectatorId: string; candidate: RTCIceCandidateInit }
        const pc = pcsRef.current.get(spectatorId)
        if (!pc || !candidate) return
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch { /* stale */ }
      })

      channel.on("broadcast", { event: "READY" }, async ({ payload }) => {
        const { spectatorId } = payload as { spectatorId: string }
        if (!streamRef.current || !spectatorId) return
        await createOffer(spectatorId)
      })

      channel.subscribe(() => {})
    } catch {
      setError("Camera access denied or unavailable")
      stop()
    }
  }, [matchId, playerId, createOffer, stop, detectZoom, startCanvasPipeline])

  // ── Flip camera ─────────────────────────────────────────────────────────────
  const flipCamera = useCallback(async () => {
    const newFacing: FacingMode = facingMode === "environment" ? "user" : "environment"
    try {
      let newRawStream: MediaStream
      try {
        newRawStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacing }, audio: false })
      } catch {
        newRawStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }

      rawStreamRef.current?.getTracks().forEach((t) => t.stop())
      rawStreamRef.current = newRawStream

      if (isSoftwareZoomRef.current) {
        // Canvas pipeline: swap the raw video source — the canvas stream track in all PCs is unchanged
        if (rawVideoRef.current) {
          rawVideoRef.current.srcObject = newRawStream
          rawVideoRef.current.play().catch(() => {})
        }
      } else {
        // Hardware zoom: replace tracks in all peer connections
        pcsRef.current.forEach(async (pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video")
          if (sender) await sender.replaceTrack(newRawStream.getVideoTracks()[0])
        })
        streamRef.current = newRawStream
        setLocalStream(newRawStream)
        detectZoom(newRawStream)
      }
      setFacingMode(newFacing)
    } catch {
      // Camera flip not supported
    }
  }, [facingMode, detectZoom])

  // ── Zoom control ─────────────────────────────────────────────────────────────
  const setZoom = useCallback((zoom: number) => {
    setZoomLevel(zoom)
    if (isSoftwareZoomRef.current) {
      softwareZoomRef.current = zoom
    } else {
      const track = rawStreamRef.current?.getVideoTracks()[0]
      if (!track) return
      track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { isStreaming, error, localStream, facingMode, zoomCapabilities, zoomLevel, setZoom, start, stop, flipCamera }
}
