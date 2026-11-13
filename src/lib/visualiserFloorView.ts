export const FLOOR_EXTENSION_MIN = 0;
export const FLOOR_EXTENSION_MAX = 20;
export const FLOOR_EXTENSION_DEFAULT = 8;

/** Metres the floor (and camera retreat) extends beyond a project room's open front. */
export function clampFloorExtension(value: unknown): number {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return FLOOR_EXTENSION_DEFAULT;
  return Math.round(Math.min(FLOOR_EXTENSION_MAX, Math.max(FLOOR_EXTENSION_MIN, n)));
}

/** Floor texture size, 100% = catalogue scale. */
export function clampFloorPatternScale(value: unknown): number {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return 100;
  return Math.round(Math.min(200, Math.max(50, n)));
}
