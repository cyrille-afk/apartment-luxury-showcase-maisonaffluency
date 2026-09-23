export const ROOM_MAP = {
  "living-room": ["sofas", "armchairs", "daybeds", "coffee-tables", "side-tables", "credenzas", "rugs", "floor-lights"],
  "dining-room": ["dining-tables", "chairs", "bar-stools", "credenzas", "rugs", "ceiling-lights"],
  bedroom: ["beds", "nightstands", "dressers", "daybeds", "benches", "armchairs", "wardrobes", "table-lights", "rugs"],
  office: ["desks", "office-chairs", "bookcases", "credenzas", "table-lights", "floor-lights"],
} as const;

export type RoomSlug = keyof typeof ROOM_MAP;

export const ROOM_LABELS: Record<RoomSlug, string> = {
  "living-room": "Living Room",
  "dining-room": "Dining Room",
  bedroom: "Bedroom",
  office: "Office",
};

export function isRoomSlug(value: string | null): value is RoomSlug {
  return value !== null && Object.prototype.hasOwnProperty.call(ROOM_MAP, value);
}
