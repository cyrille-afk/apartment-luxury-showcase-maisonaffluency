import { validEyeLevelCamera, type EyeLevelCamera } from "./eyeLevelCamera.ts";

export const ROOM_TYPES = { living_room: "Living Room", dining_room: "Dining Room", primary_bedroom: "Primary Bedroom", study: "Study", terrace: "Terrace", kitchen: "Kitchen", bathroom: "Bathroom", other: "Other" } as const;
export type RoomType = keyof typeof ROOM_TYPES;
export type RoomZone = { x: number; y: number; width: number; height: number; room_type: RoomType; room_name: string };
export function validRoomZone(raw: unknown): raw is RoomZone {
  if (!raw || typeof raw !== "object") return false;
  const v = raw as RoomZone;
  return [v.x,v.y,v.width,v.height].every(Number.isFinite) && v.x >= 0 && v.y >= 0 && v.width >= 2 && v.height >= 2 && v.x + v.width <= 100.001 && v.y + v.height <= 100.001 && Object.hasOwn(ROOM_TYPES,v.room_type) && typeof v.room_name === "string" && v.room_name.trim().length > 0 && v.room_name.length <= 120;
}
export function roomCropCamera(camera: EyeLevelCamera, zone: RoomZone): EyeLevelCamera {
  if (!validRoomZone(zone) || !validEyeLevelCamera(camera)) throw new Error("Draw a room crop and place its camera.");
  const convert = (p: { x: number; y: number }) => {
    const x = (p.x-zone.x)/zone.width*100, y = (p.y-zone.y)/zone.height*100;
    if (x<0 || x>100 || y<0 || y>100) throw new Error("Keep the camera and sightline inside the selected room crop.");
    return { x,y };
  };
  return { position: convert(camera.position), target: convert(camera.target) };
}
export function roomArchitectureConstraint(type: RoomType): string {
  const forbidden: Partial<Record<RoomType,string>> = {
    living_room: "kitchen islands, kitchen cabinetry, counters, beds, bathroom fixtures",
    dining_room: "kitchen islands, kitchen cabinetry, beds, bathroom fixtures",
    primary_bedroom: "kitchen islands, kitchen cabinetry, bathroom fixtures",
    study: "kitchen islands, kitchen cabinetry, beds, bathroom fixtures",
    terrace: "kitchen islands, kitchen cabinetry, beds, bathroom fixtures",
  };
  return `ROOM AUTHORITY: ${ROOM_TYPES[type]}. IMAGE 1 contains ONLY this room, not the full apartment. Preserve its visible curved glass windows, exact glazing rhythm, plaster walls, openings and flooring. Never import adjacent rooms or invent unseen built-ins. ${forbidden[type] ? `STRICTLY FORBIDDEN in this room: ${forbidden[type]}. Even ambiguous plan symbols cannot authorize these fixtures.` : "No unrecorded fixtures or adjacent-room architecture."}`;
}