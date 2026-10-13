export type RoomFloorFinish = "oak-chevron" | "micro-cement" | "none";

export function roomFloorFinish(value: unknown): RoomFloorFinish {
  return value === "micro-cement" || value === "none" ? value : "oak-chevron";
}

/** Clamp a persisted floor-glare value (0–100) to a safe slider range. */
export function clampFloorGlare(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 50;
}

/** Full cyclorama wall height in metres (the 100% reference). */
export const WALL_FULL_HEIGHT_M = 4.5;

/** Clamp a persisted wall-height percentage (20–100) to a safe slider range. */
export function clampWallHeight(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(20, Math.round(value))) : 100;
}