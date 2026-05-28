"use client"

import { useRef, useCallback } from "react"
import { useCameraStore } from "@/stores/camera.store"
import { detectZoom, detectRearCameras } from "@/lib/utils/camera-utils"
import type { FacingMode } from "@/stores/camera.store"

export function useDashboardCam() {
  const store = useCameraStore()
  const isSwitchingRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    store._patch({
      stream: null,
      facingMode: "environment",
      zoomLevel: 1,
      zoomCapabilities: null,
      rearCameras: [],
      activeCameraId: null,
      error: null,
    })
  }, [store])

  const start = useCallback(async (facing: FacingMode = "environment") => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      store._patch({ error: "Camera not supported in this browser — try updating your browser or use Chrome/Safari" })
      return
    }
    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      streamRef.current = stream
      stream.getVideoTracks()[0].onended = () => {
        store._patch({ stream: null, error: "Camera disconnected — tap Start Cam to reconnect" })
        streamRef.current = null
      }
      const zoomCaps = detectZoom(stream)
      const { rearCameras, activeCameraId } = await detectRearCameras(stream)
      store._patch({
        stream,
        facingMode: facing,
        zoomLevel: zoomCaps?.min ?? 1,
        zoomCapabilities: zoomCaps,
        rearCameras,
        activeCameraId,
        error: null,
      })
    } catch {
      store._patch({ error: "Camera access denied or unavailable" })
    }
  }, [store])

  const flip = useCallback(async () => {
    if (!streamRef.current || isSwitchingRef.current) return
    isSwitchingRef.current = true
    const newFacing: FacingMode = store.facingMode === "environment" ? "user" : "environment"
    try {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacing }, audio: false })
      streamRef.current = newStream
      newStream.getVideoTracks()[0].onended = () => {
        store._patch({ stream: null, error: "Camera disconnected — tap Start Cam to reconnect" })
        streamRef.current = null
      }
      const zoomCaps = detectZoom(newStream)
      const { rearCameras, activeCameraId } = await detectRearCameras(newStream)
      store._patch({
        stream: newStream,
        facingMode: newFacing,
        zoomLevel: zoomCaps?.min ?? 1,
        zoomCapabilities: zoomCaps,
        rearCameras,
        activeCameraId,
      })
    } catch {
      stop()
      store._patch({ error: "Camera flip failed — tap Start Cam to reconnect" })
    } finally {
      isSwitchingRef.current = false
    }
  }, [store, stop])

  const setZoom = useCallback((zoom: number) => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    store._patch({ zoomLevel: zoom })
    track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] }).catch(() => {})
  }, [store])

  const switchRearCamera = useCallback(async (deviceId: string) => {
    if (!streamRef.current || isSwitchingRef.current) return
    isSwitchingRef.current = true
    try {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      let newStream: MediaStream
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false })
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { ideal: deviceId } }, audio: false })
      }
      streamRef.current = newStream
      newStream.getVideoTracks()[0].onended = () => {
        store._patch({ stream: null, error: "Camera disconnected — tap Start Cam to reconnect" })
        streamRef.current = null
      }
      const zoomCaps = detectZoom(newStream)
      const { rearCameras, activeCameraId } = await detectRearCameras(newStream)
      store._patch({
        stream: newStream,
        zoomLevel: zoomCaps?.min ?? 1,
        zoomCapabilities: zoomCaps,
        rearCameras,
        activeCameraId,
      })
    } catch {
      stop()
      store._patch({ error: "Camera switch failed — tap Start Cam to reconnect" })
    } finally {
      isSwitchingRef.current = false
    }
  }, [store, stop])

  return {
    isStreaming: !!(store.stream?.active),
    stream: store.stream,
    facingMode: store.facingMode,
    zoomLevel: store.zoomLevel,
    zoomCapabilities: store.zoomCapabilities,
    rearCameras: store.rearCameras,
    activeCameraId: store.activeCameraId,
    error: store.error,
    start,
    stop,
    flip,
    setZoom,
    switchRearCamera,
  }
}
