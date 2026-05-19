"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { createPeerConnection } from "@/lib/webrtc"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export function useBoardCamSpectate(matchId: string) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)

  useEffect(() => {
    const channel = supabase.channel(`boardcam:${matchId}`)

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
  }, [matchId])

  return { remoteStream, isConnected }
}
