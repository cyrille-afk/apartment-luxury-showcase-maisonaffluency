import { validRoomZone, type RoomZone } from "./roomZone.ts";

export const ROOM_CORNER_VIEWS = [
  { label: "Front-Left", azimuth: 45, elevation: 8 },
  { label: "Front-Right", azimuth: 135, elevation: 8 },
  { label: "Back-Right", azimuth: 225, elevation: 8 },
  { label: "Back-Left", azimuth: 315, elevation: 8 },
] as const;

export function moveRoomRig(zone: RoomZone, x: number, y: number): RoomZone {
  return { ...zone, x: Math.max(0, Math.min(100-zone.width, x-zone.width/2)), y: Math.max(0, Math.min(100-zone.height, y-zone.height/2)) };
}

export function requireRoomTurntable(zone: unknown, views: unknown): asserts zone is RoomZone {
  if (!validRoomZone(zone) || zone.width > 95 || zone.height > 95) throw new Error("Select a tight crop of one room before generating.");
  if (!Array.isArray(views) || views.length !== 4 || views.some((v, i) => !v || v.label !== ROOM_CORNER_VIEWS[i]?.label || v.azimuth !== ROOM_CORNER_VIEWS[i]?.azimuth || !Number.isFinite(v.elevation) || v.elevation < 0 || v.elevation > 15)) throw new Error("Use the four room corners at eye-level elevation (0–15°).");
}

export function roomTurntablePrompt(zone: RoomZone, views: { label: string; azimuth: number; elevation: number }[]): string {
  requireRoomTurntable(zone, views);
  return `IMAGE 1 is a tight crop of ONLY ${zone.room_name}, not the apartment. Render 4 interior eye-level perspectives from the 4 corners of THIS EXACT SAME ${zone.room_name} looking inward across the room.
Keep the exact same walls, curved glass windows, flooring, and furniture arrangement consistent across all 4 panels—strictly forbid showing bedrooms or unrelated rooms unless the selected room itself is a bedroom. Never travel into adjoining rooms, show a corridor view, or expand beyond the supplied room crop.
ONE ROOM, ONE SCENE, FOUR CAMERAS: reconstruct one room once, then move only the camera. Camera height 1.5m, architectural 30mm lens, straight verticals, low tilt; never a dollhouse/top-down view.
Single continuous curved glazed bay: preserve the exact connected curve and location shown in the crop. Do not split it into disconnected windows. Do not add ANY windows, doors, balcony openings, partitions or kitchen islands absent from the crop. Unknown walls remain solid, never invented openings.
All catalogue references must retain their sculptural silhouettes, bases, legs, metric dimensions and locked finishes; no generic substitutions. Keep the same instance count and fixed floor positions across all four panels. Occlusion is natural, not permission to omit or duplicate furniture. If a locked room render is supplied, use it for the existing furniture arrangement and surface appearance, not its camera.
Output ONE square 2×2 contact sheet with exactly equal quadrants, NO gutters, borders, labels, text, watermarks or additional panels. Order: top-left Front-Left, top-right Front-Right, bottom-left Back-Right, bottom-right Back-Left.
${views.map(v => `${v.label}: corner azimuth ${v.azimuth}°, elevation ${v.elevation}°, looking inward at the room centre.`).join("\n")}`;
}