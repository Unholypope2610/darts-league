"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"
import { createPeerConnection } from "@/lib/webrtc"
import { setReplayCaptureFunc, type CaptureResult } from "@/lib/replay-capture"

type FacingMode = "environment" | "user"

interface ZoomCapabilities {
  min: number
  max: number
  step: number
}

interface RearCamera {
  deviceId: string
  label: string
}

function deriveShortLabel(rawLabel: string, indexAmongRear: number): string {
  const l = rawLabel.toLowerCase()
  if (l.includes("ultra") || l.includes("wide")) return "W"
  if (l.includes("tele")) return "T"
  return String(indexAmongRear + 1)
}

export function useBoardCamBroadcast(matchId: string, playerId: string) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<FacingMode>("environment")
  const [zoomCapabilities, setZoomCapabilities] = useState<ZoomCapabilities | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [rearCameras, setRearCameras] = useState<RearCamera[]>([])
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null)
  const isSwitchingRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<{ data: Blob; time: number }[]>([])
  // EBML header bytes extracted from the first MediaRecorder chunk (before first Cluster).
  // Always prepended when building the replay blob so the file is valid even after the
  // init chunk has been trimmed from the rolling buffer.
  const initHeadersRef = useRef<Blob | null>(null)
  const initChunkRef = useRef<{ data: Blob; time: number } | null>(null)
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

  const detectRearCameras = useCallback(async (stream: MediaStream) => {
    const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null
    setActiveCameraId(activeDeviceId)
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoInputs = devices.filter((d) => d.kind === "videoinput")
    let rearInputs = videoInputs.filter((d) => /back|rear|environment/i.test(d.label))
    if (rearInputs.length < 2) rearInputs = videoInputs
    const cameras: RearCamera[] = []
    let idx = 0
    for (const device of rearInputs) {
      cameras.push({ deviceId: device.deviceId, label: deriveShortLabel(device.label, idx) })
      idx++
    }
    setRearCameras(cameras)
  }, [])

  const switchRearCamera = useCallback(async (deviceId: string) => {
    if (!streamRef.current || isSwitchingRef.current) return
    isSwitchingRef.current = true
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      })
      pcsRef.current.forEach(async (pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video")
        if (sender) await sender.replaceTrack(newStream.getVideoTracks()[0])
      })
      streamRef.current.getTracks().forEach((t) => t.stop())
      stopRecorder()
      streamRef.current = newStream
      setLocalStream(newStream)
      detectZoom(newStream)
      startRecorder(newStream)
      setActiveCameraId(deviceId)
      await detectRearCameras(newStream)
    } catch { /* device unavailable */ }
    finally { isSwitchingRef.current = false }
  }, [stopRecorder, detectZoom, startRecorder, detectRearCameras])

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
    initHeadersRef.current = null
    initChunkRef.current = null
    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        const chunk = { data: e.data, time: Date.now() }
        chunksRef.current.push(chunk)

        // First chunk: async-extract just the header bytes (EBML/Info/Tracks, before the
        // first Cluster 0x1F43B675). These are needed for a valid WebM regardless of how
        // old the init chunk is — the rolling trim would otherwise discard them.
        if (!initChunkRef.current) {
          initChunkRef.current = chunk
          e.data.arrayBuffer().then(buf => {
            const b = new Uint8Array(buf)
            for (let i = 0; i < b.length - 4; i++) {
              if (b[i] === 0x1F && b[i+1] === 0x43 && b[i+2] === 0xB6 && b[i+3] === 0x75) {
                initHeadersRef.current = new Blob([buf.slice(0, i)], { type: mimeType })
                return
              }
            }
            initHeadersRef.current = e.data // fallback: no Cluster found in first chunk
          })
        }

        const cutoff = Date.now() - 30_000
        while (chunksRef.current.length > 0 && chunksRef.current[0].time < cutoff) {
          chunksRef.current.shift()
        }
      }
    }
    recorder.start(1000)
    setReplayCaptureFunc(playerId, (): CaptureResult | null => {
      if (!initHeadersRef.current) return null // headers still being extracted
      const cutoff = Date.now() - 25_000
      // Exclude the init chunk — its headers are already in initHeadersRef, and including
      // the chunk itself would either duplicate headers (if recent) or add a timestamp gap
      // (if old). Data-only chunks following it are all we need.
      const filtered = chunksRef.current.filter(
        (c) => c !== initChunkRef.current && c.time >= cutoff
      )
      if (filtered.length < 5) return null
      const durationMs = Date.now() - filtered[0].time
      return {
        blob: new Blob([initHeadersRef.current!, ...filtered.map((c) => c.data)], { type: mimeType }),
        durationMs,
      }
    })
  }, [playerId])

  const stopRecorder = useCallback(() => {
    setReplayCaptureFunc(playerId, null)
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
    recorderRef.current = null
    chunksRef.current = []
    initHeadersRef.current = null
    initChunkRef.current = null
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
    setRearCameras([])
    setActiveCameraId(null)
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
      await detectRearCameras(stream)
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
  }, [matchId, playerId, createOffer, stop, detectZoom, startRecorder, detectRearCameras])

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
      await detectRearCameras(newStream)
      startRecorder(newStream)
    } catch {
      // Camera flip not supported on this device
    }
  }, [facingMode, detectZoom, stopRecorder, startRecorder, detectRearCameras])

  const setZoom = useCallback((zoom: number) => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    setZoomLevel(zoom)
    track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] }).catch(() => {})
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { isStreaming, error, localStream, facingMode, zoomCapabilities, zoomLevel, setZoom, start, stop, flipCamera, rearCameras, activeCameraId, switchRearCamera }
}
