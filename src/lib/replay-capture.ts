// Per-player capture function registry — both cameras may be active simultaneously.
// The replay always comes from the throwing player's stream, not any other.

export interface CaptureResult {
  blob: Blob
  durationMs: number
}

const _fns = new Map<string, () => CaptureResult | null>()

export function setReplayCaptureFunc(playerId: string, fn: (() => CaptureResult | null) | null): void {
  if (fn) _fns.set(playerId, fn)
  else _fns.delete(playerId)
}

export function captureReplayForPlayer(playerId: string): CaptureResult | null {
  return _fns.get(playerId)?.() ?? null
}

export function isPlayerCameraRecording(playerId: string): boolean {
  return _fns.has(playerId)
}

// Returns the first recording player ID — used in local play where one camera covers both players
export function getAnyRecordingPlayerId(): string | null {
  return _fns.keys().next().value ?? null
}
