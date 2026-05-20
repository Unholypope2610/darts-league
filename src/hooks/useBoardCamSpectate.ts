"use client"

import { useEffect, useRef, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import { createPeerConnection, waitForIceGathering } from "@/lib/webrtc"

export function useBoardCamSpectate(matchId: string, playerId: string) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)

  useEffect(() => {
    if (!matchId || !playerId) return

    const supabase = getSupabase()
    const channel = supabase.channel(`boardcam:${matchId}:${playerId}`)
    let connected = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const clearRetry = () => {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
    }

    const sendReady = () => {
      channel.send({ type: "broadcast", event: "READY", payload: {} })
    }

    // Retry READY with backoff until a stream arrives.
    // Handles all timing scenarios: broadcaster not yet subscribed, OFFER lost,
    // silent answer failures, ICE failures, etc.
    const scheduleRetry = (delayMs: number) => {
      clearRetry()
      retryTimer = setTimeout(() => {
        if (!connected) {
          sendReady()
          scheduleRetry(Math.min(delayMs * 1.5, 8000))
        }
      }, delayMs)
    }

    channel.on("broadcast", { event: "OFFER" }, async ({ payload }) => {
      pcRef.current?.close()

      const pc = createPeerConnection()
      pcRef.current = pc

      const stream = new MediaStream()

      pc.ontrack = ({ track }) => {
        stream.addTrack(track)
        setRemoteStream(new MediaStream(stream.getTracks()))
        setIsConnected(true)
        connected = true
        clearRetry()
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          connected = true
          clearRetry()
        }
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setIsConnected(false)
          setRemoteStream(null)
          connected = false
          scheduleRetry(2000)
        }
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await waitForIceGathering(pc)
        channel.send({ type: "broadcast", event: "ANSWER", payload: pc.localDescription })
      } catch {
        // If answer creation fails, trigger a fresh offer via READY retry
        scheduleRetry(2000)
      }
    })

    channel.on("broadcast", { event: "HANGUP" }, () => {
      pcRef.current?.close()
      pcRef.current = null
      setIsConnected(false)
      setRemoteStream(null)
      connected = false
      clearRetry()
    })

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        sendReady()
        scheduleRetry(3000)
      }
    })

    return () => {
      connected = true  // stops any pending retry from firing after unmount
      clearRetry()
      pcRef.current?.close()
      channel.unsubscribe()
    }
  }, [matchId, playerId])

  return { remoteStream, isConnected }
}
