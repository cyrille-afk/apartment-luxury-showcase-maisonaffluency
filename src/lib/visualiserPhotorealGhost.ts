export const PHOTOREAL_GHOST_KEY = "trade-visualiser-photoreal-ghost-v1";

/** A moving preview or a partial tile is not a retained settled frame. */
export function canRetainPhotorealFrame(samples: number, elapsedSinceMove: number, settleMs: number, minSamples: number): boolean {
  return Number.isFinite(samples) && samples >= minSamples && elapsedSinceMove >= settleMs;
}

export function loadPhotorealGhostPreference(): boolean {
  try { return localStorage.getItem(PHOTOREAL_GHOST_KEY) === "true"; } catch { return false; }
}

export type PhotorealFrameCaptureRef = { current: (() => string | null) | null };