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

    channel.on("broadcast", { event: "OFFER" }, async ({ payload }) => {
      // Close any existing connection before handling a re-offer
      pcRef.current?.close()

      const pc = createPeerConnection()
      pcRef.current = pc

      const stream = new MediaStream()
      pc.ontrack = ({ track }) => {
        // Use track directly — e.streams[0] can be empty on iOS/Safari
        stream.addTrack(track)
        setRemoteStream(new MediaStream(stream.getTracks()))
        setIsConnected(true)
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

      // Non-trickle ICE: wait for all candidates to be embedded in the SDP
      // before sending the answer. Eliminates ICE timing race conditions entirely.
      await waitForIceGathering(pc)

      channel.send({ type: "broadcast", event: "ANSWER", payload: pc.localDescription })
    })

    channel.on("broadcast", { event: "HANGUP" }, () => {
      pcRef.current?.close()
      pcRef.current = null
      setIsConnected(false)
      setRemoteStream(null)
    })

    // Announce readiness once subscribed — triggers broadcaster to re-offer if already streaming
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({ type: "broadcast", event: "READY", payload: {} })
      }
    })

    return () => {
      pcRef.current?.close()
      channel.unsubscribe()
    }
  }, [matchId, playerId])

  return { remoteStream, isConnected }
}
