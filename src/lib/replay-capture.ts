// Per-player capture function registry — both cameras may be active simultaneously.
// The replay always comes from the throwing player's stream, not any other.

const _fns = new Map<string, () => Blob | null>()

export function setReplayCaptureFunc(playerId: string, fn: (() => Blob | null) | null): void {
  if (fn) _fns.set(playerId, fn)
  else _fns.delete(playerId)
}

export function captureReplayForPlayer(playerId: string): Blob | null {
  return _fns.get(playerId)?.() ?? null
}

export function isPlayerCameraRecording(playerId: string): boolean {
  return _fns.has(playerId)
}
