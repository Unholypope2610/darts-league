import { create } from "zustand"

export type FacingMode = "environment" | "user"

export interface ZoomCapabilities {
  min: number
  max: number
  step: number
}

export interface RearCamera {
  deviceId: string
  label: string
}

interface CameraStore {
  stream: MediaStream | null
  facingMode: FacingMode
  zoomLevel: number
  zoomCapabilities: ZoomCapabilities | null
  rearCameras: RearCamera[]
  activeCameraId: string | null
  error: string | null
  _patch: (p: Partial<Omit<CameraStore, "_patch">>) => void
}

export const useCameraStore = create<CameraStore>((set) => ({
  stream: null,
  facingMode: "environment",
  zoomLevel: 1,
  zoomCapabilities: null,
  rearCameras: [],
  activeCameraId: null,
  error: null,
  _patch: (p) => set(p as Partial<CameraStore>),
}))
