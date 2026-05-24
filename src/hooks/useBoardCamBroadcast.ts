"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"
import { createPeerConnection } from "@/lib/webrtc"
import { setReplayCaptureFunc } from "@/lib/replay-capture"

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
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<{ data: Blob; time: number }[]>([])
  // One peer connection per spectator so viewers don't kill each other's feeds
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const creatingOfferRef = useRef<Set<string>>(new Set())
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null)

  const detectZoom = useCallback((stream: MediaStream) => {
    const track = stream.getVideoTracks()[0]
    if (!track) return
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
      zoom?: { min?: number; max?: number; step?: number }
    }
    const z = capabilities.zoom
    if (!z) {
      setZoomCapabilities(null)
      setZoomLevel(1)
      return
    }
    // iOS returns zoom but may omit or NaN individual fields — normalize to safe values
    // (the old slider UI silently worked around this; +/- buttons need explicit guards)
    const min = Number.isFinite(z.min) ? z.min! : 1
    const max = Number.isFinite(z.max) && z.max! > min ? z.max! : min + 4
    const step = Number.isFinite(z.step) && z.step! > 0 ? z.step! : 1
    setZoomCapabilities({ min, max, step })
    setZoomLevel(min)
  }, [])

  const createOffer = useCallback(async (spectatorId: string) => {
    if (!streamRef.current || !channelRef.current) return
    // Prevent concurrent offers for the same spectator
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

  const startRecorder = useCallback((stream: MediaStream) => {
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm"
    if (!MediaRecorder.isTypeSupported(mimeType)) return
    chunksRef.current = []
    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push({ data: e.data, time: Date.now() })
        const cutoff = Date.now() - 30_000
        while (chunksRef.current.length > 0 && chunksRef.current[0].time < cutoff) {
          chunksRef.current.shift()
        }
      }
    }
    recorder.start(1000)
    setReplayCaptureFunc(playerId, () => {
      const cutoff = Date.now() - 25_000
      const chunks = chunksRef.current.filter((c) => c.time >= cutoff).map((c) => c.data)
      return chunks.length >= 5 ? new Blob(chunks, { type: mimeType }) : null
    })
  }, [playerId])

  const stopRecorder = useCallback(() => {
    setReplayCaptureFunc(playerId, null)
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
    recorderRef.current = null
    chunksRef.current = []
  }, [playerId])

  const stop = useCallback(() => {
    stopRecorder()
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
  }, [stopRecorder])

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
      startRecorder(stream)

      const supabase = getSupabase()
      const channel = supabase.channel(`boardcam:${matchId}:${playerId}`)
      channelRef.current = channel

      channel.on("broadcast", { event: "ANSWER" }, async ({ payload }) => {
        const { spectatorId, type, sdp } = payload as { spectatorId: string; type: RTCSdpType; sdp: string }
        const pc = pcsRef.current.get(spectatorId)
        if (!pc) return
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }))
        } catch { /* stale answer */ }
      })

      channel.on("broadcast", { event: "ICE_CANDIDATE_S" }, async ({ payload }) => {
        const { spectatorId, candidate } = payload as { spectatorId: string; candidate: RTCIceCandidateInit }
        const pc = pcsRef.current.get(spectatorId)
        if (!pc || !candidate) return
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch { /* stale candidate */ }
      })

      channel.on("broadcast", { event: "READY" }, async ({ payload }) => {
        const { spectatorId } = payload as { spectatorId: string }
        if (!streamRef.current || !spectatorId) return
        await createOffer(spectatorId)
      })

      channel.subscribe(() => {
        // Spectators' READY signals drive offer creation — nothing to do on subscribe
      })
    } catch {
      setError("Camera access denied or unavailable")
      stop()
    }
  }, [matchId, playerId, createOffer, stop, detectZoom, startRecorder])

  const flipCamera = useCallback(async () => {
    if (!streamRef.current) return
    const newFacing: FacingMode = facingMode === "environment" ? "user" : "environment"
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacing }, audio: false })
      pcsRef.current.forEach(async (pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video")
        if (sender) await sender.replaceTrack(newStream.getVideoTracks()[0])
      })
      streamRef.current.getTracks().forEach((t) => t.stop())
      stopRecorder()
      streamRef.current = newStream
      setLocalStream(newStream)
      setFacingMode(newFacing)
      detectZoom(newStream)
      startRecorder(newStream)
    } catch {
      // Camera flip not supported on this device
    }
  }, [facingMode, detectZoom, stopRecorder, startRecorder])

  const setZoom = useCallback((zoom: number) => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    setZoomLevel(zoom)
    track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] }).catch(() => {})
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { isStreaming, error, localStream, facingMode, zoomCapabilities, zoomLevel, setZoom, start, stop, flipCamera }
}
