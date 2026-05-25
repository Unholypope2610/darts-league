"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"
import { createPeerConnection } from "@/lib/webrtc"
import { setReplayCaptureFunc, type CaptureResult } from "@/lib/replay-capture"
import { useLiveMatchStore } from "@/stores/live-match.store"

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

interface OverlayData {
  playerName: string
  playerRemainder: number
  playerLegsWon: number
  opponentName: string
  opponentRemainder: number
  opponentLegsWon: number
  bestOf: number
}

// --- WebM timestamp normalizer ---
// MediaRecorder chunks carry timestamps relative to when recording started.
// A replay clipped from the middle of a long session would have, e.g., the
// first cluster at 20000 ms, causing browsers to show the video as starting
// at 0:20. We patch every cluster's Timecode element so the first one starts
// at 0, making the video fully seekable from the beginning.

function ebmlVIntSize(d: Uint8Array, pos: number): number {
  const b = d[pos]
  if (b >= 0x80) return 1
  if (b >= 0x40) return 2
  if (b >= 0x20) return 3
  if (b >= 0x10) return 4
  return 8
}

function ebmlVInt(d: Uint8Array, pos: number): number {
  const sz = ebmlVIntSize(d, pos)
  let v = d[pos] & (0xFF >> sz)
  for (let i = 1; i < sz; i++) v = v * 256 + d[pos + i]
  return v
}

function findClusterTimecode(d: Uint8Array, cPos: number): { writePos: number; size: number; value: number } | null {
  let pos = cPos + 4 + ebmlVIntSize(d, cPos + 4) // past cluster ID + size VINT
  for (let i = pos; i < Math.min(pos + 128, d.length - 8); i++) {
    if (d[i] === 0xE7) { // Timecode element ID
      const tcSzVLen = ebmlVIntSize(d, i + 1)
      const tcSz = ebmlVInt(d, i + 1)
      const wp = i + 1 + tcSzVLen
      let value = 0
      for (let j = 0; j < tcSz; j++) value = value * 256 + d[wp + j]
      return { writePos: wp, size: tcSz, value }
    }
  }
  return null
}

// Accepts and returns ArrayBuffer so results are always valid BlobParts.
function normalizeWebMTimestamps(chunks: ArrayBuffer[]): ArrayBuffer[] {
  const views = chunks.map(b => new Uint8Array(b))
  let offset = 0
  outer: for (const d of views) {
    for (let i = 0; i < d.length - 8; i++) {
      if (d[i] === 0x1F && d[i+1] === 0x43 && d[i+2] === 0xB6 && d[i+3] === 0x75) {
        const tc = findClusterTimecode(d, i)
        if (tc) { offset = tc.value; break outer }
      }
    }
  }
  if (offset === 0) return chunks
  return chunks.map(buf => {
    const copy = buf.slice(0) // ArrayBuffer.slice → fresh ArrayBuffer
    const d = new Uint8Array(copy)
    for (let i = 0; i < d.length - 8; i++) {
      if (d[i] === 0x1F && d[i+1] === 0x43 && d[i+2] === 0xB6 && d[i+3] === 0x75) {
        const tc = findClusterTimecode(d, i)
        if (tc) {
          let v = Math.max(0, tc.value - offset)
          for (let j = tc.size - 1; j >= 0; j--) { d[tc.writePos + j] = v & 0xFF; v = Math.floor(v / 256) }
        }
      }
    }
    return copy
  })
}

function clamp(n: string, max: number) {
  return n.length > max ? n.slice(0, max - 1) + "…" : n
}

function drawOverlay(ctx: CanvasRenderingContext2D, data: OverlayData, w: number, h: number) {
  const barH = Math.max(48, Math.round(h * 0.12))
  const pad = Math.round(w * 0.035)
  const mid = w / 2

  ctx.fillStyle = "rgba(0,0,0,0.75)"
  ctx.fillRect(0, 0, w, barH)

  const nameSize = Math.max(10, Math.round(barH * 0.27))
  const scoreSize = Math.max(16, Math.round(barH * 0.47))
  const legSize = Math.max(11, Math.round(barH * 0.30))

  const nameY = barH * 0.36
  const scoreY = barH * 0.82

  // Player (left, green)
  ctx.textBaseline = "middle"
  ctx.font = `600 ${nameSize}px system-ui,sans-serif`
  ctx.fillStyle = "#10b981"
  ctx.textAlign = "left"
  ctx.fillText(clamp(data.playerName, 10).toUpperCase(), pad, nameY)

  ctx.font = `bold ${scoreSize}px monospace`
  ctx.fillStyle = "#ffffff"
  ctx.fillText(String(data.playerRemainder), pad, scoreY)

  // Opponent (right, red)
  ctx.font = `600 ${nameSize}px system-ui,sans-serif`
  ctx.fillStyle = "#ef4444"
  ctx.textAlign = "right"
  ctx.fillText(clamp(data.opponentName, 10).toUpperCase(), w - pad, nameY)

  ctx.font = `bold ${scoreSize}px monospace`
  ctx.fillStyle = "#ffffff"
  ctx.fillText(String(data.opponentRemainder), w - pad, scoreY)

  // Legs score (center)
  ctx.font = `bold ${legSize}px system-ui,sans-serif`
  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.fillText(`${data.playerLegsWon} - ${data.opponentLegsWon}`, mid, barH / 2)
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
  // Chunks stored as ArrayBuffer (valid BlobPart) so timestamps can be patched at capture time.
  const chunksRef = useRef<{ data: ArrayBuffer; time: number }[]>([])
  // EBML header bytes (before first Cluster) — prepended when building the replay blob.
  const initHeadersRef = useRef<ArrayBuffer | null>(null)
  const initChunkRef = useRef<{ data: ArrayBuffer; time: number } | null>(null)
  // One peer connection per spectator so viewers don't kill each other's feeds
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const creatingOfferRef = useRef<Set<string>>(new Set())
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null)

  // Canvas composition refs for burning overlay into recording
  const drawIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const requestDataIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const offscreenVideoRef = useRef<HTMLVideoElement | null>(null)
  const canvasStreamRef = useRef<MediaStream | null>(null)

  // Overlay base data (names, legs, bestOf) — updated immediately from store
  const overlayBaseRef = useRef<Omit<OverlayData, "playerRemainder" | "opponentRemainder"> | null>(null)
  // Remainder targets from store vs animated display values.
  // Display stays at the pre-throw score during a visit and counts down to the
  // new value after the score is entered, so the burned-in overlay shows what
  // the player was on rather than the post-throw remainder.
  const playerRemainderTargetRef = useRef(501)
  const playerRemainderDisplayRef = useRef(501)
  const opponentRemainderTargetRef = useRef(501)
  const opponentRemainderDisplayRef = useRef(501)

  // Subscribe to store for live overlay data
  const playerA = useLiveMatchStore((s) => s.playerA)
  const playerB = useLiveMatchStore((s) => s.playerB)
  const playerARemainder = useLiveMatchStore((s) => s.playerARemainder)
  const playerBRemainder = useLiveMatchStore((s) => s.playerBRemainder)
  const playerALegsWon = useLiveMatchStore((s) => s.playerALegsWon)
  const playerBLegsWon = useLiveMatchStore((s) => s.playerBLegsWon)
  const bestOf = useLiveMatchStore((s) => s.bestOf)

  useEffect(() => {
    if (!playerA || !playerB) {
      overlayBaseRef.current = null
      return
    }
    const isA = playerId === playerA.id
    overlayBaseRef.current = {
      playerName: isA ? playerA.name : playerB.name,
      playerLegsWon: isA ? playerALegsWon : playerBLegsWon,
      opponentName: isA ? playerB.name : playerA.name,
      opponentLegsWon: isA ? playerBLegsWon : playerALegsWon,
      bestOf,
    }
    const newPlayer = isA ? playerARemainder : playerBRemainder
    const newOpp = isA ? playerBRemainder : playerARemainder
    // Jump display up immediately (new leg reset); animate down when score is entered
    if (newPlayer > playerRemainderDisplayRef.current) playerRemainderDisplayRef.current = newPlayer
    if (newOpp > opponentRemainderDisplayRef.current) opponentRemainderDisplayRef.current = newOpp
    playerRemainderTargetRef.current = newPlayer
    opponentRemainderTargetRef.current = newOpp
  }, [playerId, playerA, playerB, playerARemainder, playerBRemainder, playerALegsWon, playerBLegsWon, bestOf])

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

  const stopRecorder = useCallback(() => {
    if (drawIntervalRef.current !== null) {
      clearInterval(drawIntervalRef.current)
      drawIntervalRef.current = null
    }
    if (requestDataIntervalRef.current !== null) {
      clearInterval(requestDataIntervalRef.current)
      requestDataIntervalRef.current = null
    }
    canvasStreamRef.current?.getTracks().forEach((t) => t.stop())
    canvasStreamRef.current = null
    if (offscreenVideoRef.current) {
      offscreenVideoRef.current.onloadedmetadata = null
      offscreenVideoRef.current.srcObject = null
      offscreenVideoRef.current = null
    }
    setReplayCaptureFunc(playerId, null)
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
    recorderRef.current = null
    chunksRef.current = []
    initHeadersRef.current = null
    initChunkRef.current = null
  }, [playerId])

  const startRecorder = useCallback((stream: MediaStream) => {
    // Prefer MP4/H.264 — plays on iOS Safari; fall back to WebM for Chrome/Android
    const mimeType =
      MediaRecorder.isTypeSupported("video/mp4;codecs=avc1") ? "video/mp4;codecs=avc1" :
      MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" :
      MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : null
    if (!mimeType) return
    chunksRef.current = []
    initHeadersRef.current = null
    initChunkRef.current = null

    // Feed raw stream into an off-screen video element so we can drawImage it onto canvas
    const vid = document.createElement("video")
    vid.srcObject = stream
    vid.muted = true
    vid.playsInline = true
    offscreenVideoRef.current = vid

    vid.onloadedmetadata = () => {
      const rawW = vid.videoWidth || 640
      const rawH = vid.videoHeight || 480
      const scale = Math.min(1, 1280 / Math.max(rawW, rawH))
      const cW = Math.round(rawW * scale)
      const cH = Math.round(rawH * scale)

      const canvas = document.createElement("canvas")
      canvas.width = cW
      canvas.height = cH
      const ctx = canvas.getContext("2d")!

      const cs = canvas.captureStream(25)
      canvasStreamRef.current = cs

      // Draw camera frame + overlay at 25fps.
      // Remainders animate toward target at 10pts/frame so the overlay shows the
      // pre-throw score during the visit and counts down after the score is entered.
      drawIntervalRef.current = setInterval(() => {
        if (vid.readyState >= 2) ctx.drawImage(vid, 0, 0, cW, cH)
        const base = overlayBaseRef.current
        if (base) {
          const step = 10
          if (playerRemainderDisplayRef.current > playerRemainderTargetRef.current) {
            playerRemainderDisplayRef.current = Math.max(
              playerRemainderTargetRef.current,
              playerRemainderDisplayRef.current - step,
            )
          }
          if (opponentRemainderDisplayRef.current > opponentRemainderTargetRef.current) {
            opponentRemainderDisplayRef.current = Math.max(
              opponentRemainderTargetRef.current,
              opponentRemainderDisplayRef.current - step,
            )
          }
          drawOverlay(ctx, {
            ...base,
            playerRemainder: playerRemainderDisplayRef.current,
            opponentRemainder: opponentRemainderDisplayRef.current,
          }, cW, cH)
        }
      }, 40)

      const isWebm = mimeType.includes("webm")
      const recorder = new MediaRecorder(cs, { mimeType })
      recorderRef.current = recorder
      // Eagerly convert each MediaRecorder chunk to ArrayBuffer so timestamps can
      // be patched synchronously at capture time (no async needed in captureFunc).
      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return
        const wallTime = Date.now()
        e.data.arrayBuffer().then(buf => {
          const chunk = { data: buf, time: wallTime }
          chunksRef.current.push(chunk)

          if (!initChunkRef.current) {
            initChunkRef.current = chunk
            if (isWebm) {
              // Extract the EBML header bytes that precede the first Cluster
              const d = new Uint8Array(buf)
              for (let i = 0; i < d.length - 4; i++) {
                if (d[i] === 0x1F && d[i+1] === 0x43 && d[i+2] === 0xB6 && d[i+3] === 0x75) {
                  initHeadersRef.current = buf.slice(0, i)
                  return
                }
              }
            }
            initHeadersRef.current = buf // MP4 init segment, or WebM fallback
          }

          const cutoff = wallTime - 30_000
          while (chunksRef.current.length > 0 && chunksRef.current[0].time < cutoff) {
            chunksRef.current.shift()
          }
        })
      }
      // Use recorder.start() without timeslice + explicit requestData() every 1 s.
      // iOS Safari ignores the timeslice argument on MP4 recordings and only fires
      // ondataavailable when stop() is called, producing one giant chunk that makes
      // the rolling buffer useless. requestData() IS honoured on iOS.
      recorder.start()
      requestDataIntervalRef.current = setInterval(() => {
        if (recorderRef.current?.state === "recording") recorderRef.current.requestData()
      }, 1000)
      setReplayCaptureFunc(playerId, (): CaptureResult | null => {
        if (!initHeadersRef.current) return null
        const cutoff = Date.now() - 25_000
        const filtered = chunksRef.current.filter(
          (c) => c !== initChunkRef.current && c.time >= cutoff
        )
        if (filtered.length < 2) return null
        const durationMs = Date.now() - filtered[0].time
        const parts = isWebm ? normalizeWebMTimestamps(filtered.map(c => c.data)) : filtered.map(c => c.data)
        return {
          blob: new Blob([initHeadersRef.current, ...parts], { type: mimeType }),
          durationMs,
        }
      })
    }

    vid.play().catch(() => {})
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

  const switchRearCamera = useCallback(async (deviceId: string) => {
    if (!streamRef.current || isSwitchingRef.current) return
    isSwitchingRef.current = true
    try {
      // Stop the active camera before opening the new one — Android refuses to
      // open a second camera while the first stream is still alive.
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      stopRecorder()

      // Try exact deviceId first (forces the correct physical camera).
      // Fall back to ideal for devices that throw OverconstrainedError on exact.
      let newStream: MediaStream
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: false,
        })
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { ideal: deviceId } },
          audio: false,
        })
      }

      const videoTrack = newStream.getVideoTracks()[0]
      await Promise.all(
        Array.from(pcsRef.current.values()).map(async (pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video")
          if (sender) await sender.replaceTrack(videoTrack)
        })
      )
      streamRef.current = newStream
      setLocalStream(newStream)
      detectZoom(newStream)
      startRecorder(newStream)
      await detectRearCameras(newStream)
    } catch {
      stop()
      setError("Camera switch failed — tap Start Cam to reconnect")
    } finally {
      isSwitchingRef.current = false
    }
  }, [stop, stopRecorder, detectZoom, startRecorder, detectRearCameras])

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
    if (!streamRef.current || isSwitchingRef.current) return
    isSwitchingRef.current = true
    const newFacing: FacingMode = facingMode === "environment" ? "user" : "environment"
    try {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      stopRecorder()

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: false,
      })

      const videoTrack = newStream.getVideoTracks()[0]
      await Promise.all(
        Array.from(pcsRef.current.values()).map(async (pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video")
          if (sender) await sender.replaceTrack(videoTrack)
        })
      )
      streamRef.current = newStream
      setLocalStream(newStream)
      setFacingMode(newFacing)
      detectZoom(newStream)
      await detectRearCameras(newStream)
      startRecorder(newStream)
    } catch {
      stop()
      setError("Camera flip failed — tap Start Cam to reconnect")
    } finally {
      isSwitchingRef.current = false
    }
  }, [facingMode, stop, stopRecorder, detectZoom, startRecorder, detectRearCameras])

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
