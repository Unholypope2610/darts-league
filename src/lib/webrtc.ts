const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS })
}

/** Wait for ICE gathering to finish so all candidates are embedded in the SDP. */
export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve()
      return
    }
    const timeout = setTimeout(resolve, timeoutMs)
    const handler = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timeout)
        pc.removeEventListener("icegatheringstatechange", handler)
        resolve()
      }
    }
    pc.addEventListener("icegatheringstatechange", handler)
  })
}
