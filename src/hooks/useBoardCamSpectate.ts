"use client"

import { useEffect, useRef, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import { createPeerConnection } from "@/lib/webrtc"

export function useBoardCamSpectate(matchId: string, playerId: string) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  // Stable per-session ID so the broadcaster keeps a separate PC for each viewer
  const spectatorId = useRef(crypto.randomUUID())

  useEffect(() => {
    if (!matchId || !playerId) return

    const supabase = getSupabase()
    const channel = supabase.channel(`boardcam:${matchId}:${playerId}`)
    const myId = spectatorId.current
    let connected = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    // Trickle ICE: queue broadcaster candidates that arrive before remote desc is set
    const pendingCandidates: RTCIceCandidateInit[] = []
    let remoteDescSet = false

    const clearRetry = () => {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
    }

    const sendReady = () => {
      channel.send({ type: "broadcast", event: "READY", payload: { spectatorId: myId } })
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

    // Register before subscribing so no candidates from our offer are missed
    channel.on("broadcast", { event: "ICE_CANDIDATE_B" }, async ({ payload }) => {
      const { spectatorId: sid, candidate } = payload as { spectatorId: string; candidate: RTCIceCandidateInit }
      if (sid !== myId || !candidate) return
      if (remoteDescSet && pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
        } catch { /* stale */ }
      } else {
        pendingCandidates.push(candidate)
      }
    })

    channel.on("broadcast", { event: "OFFER" }, async ({ payload }) => {
      const { spectatorId: sid, type, sdp } = payload as { spectatorId: string; type: RTCSdpType; sdp: string }
      if (sid !== myId) return

      pcRef.current?.close()
      remoteDescSet = false
      pendingCandidates.length = 0

      const pc = createPeerConnection()
      pcRef.current = pc

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          channel.send({
            type: "broadcast",
            event: "ICE_CANDIDATE_S",
            payload: { spectatorId: myId, candidate: candidate.toJSON() },
          })
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
        await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }))
        remoteDescSet = true

        for (const c of pendingCandidates) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch { /* stale */ }
        }
        pendingCandidates.length = 0

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        channel.send({
          type: "broadcast",
          event: "ANSWER",
          payload: { spectatorId: myId, type: answer.type, sdp: answer.sdp },
        })
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
      connected = true
      clearRetry()
      pcRef.current?.close()
      channel.unsubscribe()
    }
  }, [matchId, playerId])

  return { remoteStream, isConnected }
}
