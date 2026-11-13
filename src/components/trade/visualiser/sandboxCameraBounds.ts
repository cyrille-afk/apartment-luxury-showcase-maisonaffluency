import type { RoomBounds } from "@/lib/activeProjectLayout";

export const CAMERA_WALL_MARGIN_M = 0.5;
/** The front of a project room is open, so the camera may step back out through it this far. */
export const CAMERA_FRONT_RETREAT_M = 8;

/** Centre-origin room interior; safely collapses very small rooms to centre. */
export function sandboxCameraPosition(position: readonly number[], bounds: RoomBounds, frontRetreat = CAMERA_FRONT_RETREAT_M): [number, number, number] {
  const halfWidth = Math.max(0, bounds.width / 2 - CAMERA_WALL_MARGIN_M);
  const halfDepth = Math.max(0, bounds.depth / 2 - CAMERA_WALL_MARGIN_M);
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
  const minY = Math.min(CAMERA_WALL_MARGIN_M, bounds.height / 2);
  const maxY = Math.max(minY, bounds.height - CAMERA_WALL_MARGIN_M);
  return [clamp(position[0], -halfWidth, halfWidth), clamp(position[1], minY, maxY), clamp(position[2], -halfDepth, Math.max(halfDepth, bounds.depth / 2 + frontRetreat))];
}