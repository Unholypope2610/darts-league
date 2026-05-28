import type { ZoomCapabilities, RearCamera } from "@/stores/camera.store"

function deriveShortLabel(rawLabel: string, indexAmongRear: number): string {
  const l = rawLabel.toLowerCase()
  if (l.includes("ultra") || l.includes("wide")) return "W"
  if (l.includes("tele")) return "T"
  return String(indexAmongRear + 1)
}

export function detectZoom(stream: MediaStream): ZoomCapabilities | null {
  const track = stream.getVideoTracks()[0]
  if (!track) return null
  const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
    zoom?: { min?: number; max?: number; step?: number }
  }
  const z = capabilities.zoom
  if (!z) return null
  const min = Number.isFinite(z.min) ? z.min! : 1
  const max = Number.isFinite(z.max) && z.max! > min ? z.max! : min + 4
  const step = Number.isFinite(z.step) && z.step! > 0 ? z.step! : 1
  return { min, max, step }
}

export async function detectRearCameras(stream: MediaStream): Promise<{
  rearCameras: RearCamera[]
  activeCameraId: string | null
}> {
  const activeCameraId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null
  const devices = await navigator.mediaDevices.enumerateDevices()
  const videoInputs = devices.filter((d) => d.kind === "videoinput")
  let rearInputs = videoInputs.filter((d) => /back|rear|environment/i.test(d.label))
  if (rearInputs.length < 2) rearInputs = videoInputs
  const rearCameras: RearCamera[] = []
  let idx = 0
  for (const device of rearInputs) {
    rearCameras.push({ deviceId: device.deviceId, label: deriveShortLabel(device.label, idx) })
    idx++
  }
  return { rearCameras, activeCameraId }
}
