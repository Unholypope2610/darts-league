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

    channel.on("broadcast", { event: "OFFER" }, async ({ payload }) => {
      const pc = createPeerConnection()
      pcRef.current = pc

      const stream = new MediaStream()
      pc.ontrack = (e) => {
        e.streams[0].getTracks().forEach((t) => stream.addTrack(t))
        setRemoteStream(stream)
        setIsConnected(true)
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) channel.send({ type: "broadcast", event: "ICE_SPECTATOR", payload: candidate.toJSON() })
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setIsConnected(false)
          setRemoteStream(null)
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(payload))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      channel.send({ type: "broadcast", event: "ANSWER", payload: answer })
    })

    channel.on("broadcast", { event: "ICE_BROADCASTER" }, async ({ payload }) => {
      if (!pcRef.current) return
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(payload)) } catch {}
    })

    channel.on("broadcast", { event: "HANGUP" }, () => {
      setIsConnected(false)
      setRemoteStream(null)
    })

    channel.subscribe()

    return () => {
      pcRef.current?.close()
      channel.unsubscribe()
    }
  }, [matchId, playerId])

  return { remoteStream, isConnected }
}
