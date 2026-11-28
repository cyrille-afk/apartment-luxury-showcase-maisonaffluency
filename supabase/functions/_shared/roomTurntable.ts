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

export const ROOM_MASTER_VIEWS = [
  { label: "01 · Master Perspective", azimuth: 0, elevation: 8 },
  { label: "02 · Terrace Side Angle", azimuth: -25, elevation: 8 },
  { label: "03 · Living Wall Angle", azimuth: 25, elevation: 8 },
] as const;

export function requireRoomTurntable(zone: unknown, views: unknown, master?: unknown, verified?: unknown): asserts zone is RoomZone {
  if (!validRoomZone(zone) || zone.width > 95 || zone.height > 95) throw new Error("Select a tight crop of one room before generating.");
  if (typeof master !== "string" || !master || verified !== true) throw new Error("Verify the Eye-Level Furniture Proposal master render before generating room angles.");
  if (!Array.isArray(views) || views.length !== 3 || views.some((v, i) => !v || v.label !== ROOM_MASTER_VIEWS[i]?.label || v.azimuth !== ROOM_MASTER_VIEWS[i]?.azimuth || !Number.isFinite(v.elevation) || v.elevation < 0 || v.elevation > 15)) throw new Error("Use the master perspective and only -25° / +25° architectural shifts.");
}

export function roomFurnitureCounts(pieces: { product_name: string }[]) {
  const counts = new Map<string, number>();
  for (const piece of pieces) counts.set(piece.product_name, (counts.get(piece.product_name) ?? 0) + 1);
  return [...counts].map(([name,count]) => ({ name,count }));
}

export function roomTurntablePrompt(zone: RoomZone, views: { label: string; azimuth: number; elevation: number }[], master: string, verified: boolean, pieces: { product_name: string }[]): string {
  requireRoomTurntable(zone, views, master, verified);
  if (!pieces.length) throw new Error("Attach every placed catalogue piece from the master render.");
  return `IMAGE 1 is the VERIFIED EYE-LEVEL FURNITURE PROPOSAL MASTER for ${zone.room_name}. It is the sole architectural, furniture-placement and finish authority. Never reconstruct the apartment from a floor plan.
The gallery has THREE views: 01 · Master Perspective is the original IMAGE 1, preserved unchanged by the application. Generate ONLY 02 · Terrace Side Angle (-25° shift) and 03 · Living Wall Angle (+25° shift) as nearby architectural perspectives of THIS EXACT SAME scene. No reverse views, rear cameras, 360° orbit, bedrooms or unrelated rooms.
Camera height 1.5m, architectural 30mm lens, straight verticals. Move only the camera a small -25° or +25° relative to the master. Do not rotate or relocate furniture.
STRICT ARCHITECTURE LOCK: preserve the solid plaster wall on the LEFT and the single continuous curved glass bay on the FRONT/RIGHT. Glazing NEVER wraps 360° or continues behind the console. Preserve walls, flooring, terrace door and openings exactly as IMAGE 1. No additional windows, doors, balcony openings, partitions or islands; unknown walls remain solid plaster.
STRICT INSTANCE INVENTORY (${pieces.length} pieces total): ${roomFurnitureCounts(pieces).map(p => `${p.count} × ${p.name}`).join("; ")}.
This inventory is exact across BOTH generated panels, not per-reference suggestions. For the client's five-piece scene: exactly 2 OUM/GUM armchairs, 1 Rift CTS coffee table, 1 Moco/Mono STS side table and 1 Yoma CLW Console. OUM/GUM and Moco/Mono are name aliases, NOT additional pieces; follow the supplied studio photos and inventory. Never add a third armchair. Do not omit, clone, substitute or redesign any piece.
The Yoma CLW Console stays FLUSH AGAINST THE SOLID LEFT WALL at its master position; never float it mid-room or put glazing behind it. Retain the coffee table, side table and two chairs at their exact master floor positions, with natural occlusion. Original studio photos confirm identity only, never permission to restage or change locked finishes. Preserve Rift CTS's 108 × 108 cm rounded-square stone slab and wood legs.
Output ONE 16:9 two-panel contact sheet: equal LEFT and RIGHT halves, no gutters, borders, text or extra panels. LEFT = Terrace Side Angle (-25°); RIGHT = Living Wall Angle (+25°). Do NOT regenerate the master perspective.`;
}
