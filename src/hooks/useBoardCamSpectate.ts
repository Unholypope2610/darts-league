"use client"

import { useEffect, useRef, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import { createPeerConnection } from "@/lib/webrtc"

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

    // Trickle ICE: queue broadcaster candidates that arrive before remote desc is set
    const pendingCandidates: RTCIceCandidateInit[] = []
    let remoteDescSet = false

    const clearRetry = () => {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
    }

    const sendReady = () => {
      channel.send({ type: "broadcast", event: "READY", payload: {} })
    }

    const scheduleRetry = (delayMs: number) => {
      clearRetry()
      retryTimer = setTimeout(() => {
        if (!connected) {
          sendReady()
          scheduleRetry(Math.min(delayMs * 1.5, 8000))
        }
      }, delayMs)
    }

    // Register ICE_CANDIDATE_B before subscribing so no candidates are missed
    channel.on("broadcast", { event: "ICE_CANDIDATE_B" }, async ({ payload }) => {
      if (!payload) return
      if (remoteDescSet && pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload))
        } catch { /* ignore stale candidates */ }
      } else {
        pendingCandidates.push(payload)
      }
    })

    channel.on("broadcast", { event: "OFFER" }, async ({ payload }) => {
      pcRef.current?.close()

      // Reset trickle ICE state for this new offer
      remoteDescSet = false
      pendingCandidates.length = 0

      const pc = createPeerConnection()
      pcRef.current = pc

      // Trickle ICE: send our candidates as they arrive
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          channel.send({ type: "broadcast", event: "ICE_CANDIDATE_S", payload: candidate.toJSON() })
        }
      }

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
        remoteDescSet = true

        // Drain any candidates that arrived before remote desc was set
        for (const c of pendingCandidates) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch { /* ignore */ }
        }
        pendingCandidates.length = 0

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        // Send answer immediately — don't wait for ICE gathering to complete
        channel.send({ type: "broadcast", event: "ANSWER", payload: pc.localDescription })
      } catch {
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
