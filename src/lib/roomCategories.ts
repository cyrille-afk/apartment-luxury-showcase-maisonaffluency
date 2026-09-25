export const ROOM_MAP = {
  estates: ["sofas", "armchairs", "dining-tables", "coffee-tables", "credenzas", "rugs", "ceiling-lights"],
  "living-room": ["sofas", "armchairs", "daybeds", "coffee-tables", "side-tables", "credenzas", "rugs", "floor-lights"],
  "dining-room": ["dining-tables", "chairs", "bar-stools", "credenzas", "rugs", "ceiling-lights"],
  bedroom: ["beds", "nightstands", "dressers", "daybeds", "benches", "armchairs", "wardrobes", "table-lights", "rugs"],
  bath: ["mirrors", "stools", "wall-lights", "bathroom-lights", "decorative-objects"],
  office: ["desks", "office-chairs", "bookcases", "credenzas", "table-lights", "floor-lights"],
  lighting: ["ceiling-lights", "wall-lights", "table-lights", "floor-lights", "bathroom-lights", "outdoor-lights"],
  outdoor: ["outdoor-seating", "outdoor-tables", "outdoor-lights", "decorative-objects"],
  modern: ["sofas", "armchairs", "chairs", "coffee-tables", "side-tables", "credenzas", "floor-lights"],
} as const;

export type RoomSlug = keyof typeof ROOM_MAP;

export const ROOM_LABELS: Record<RoomSlug, string> = {
  estates: "Estates",
  "living-room": "Living",
  "dining-room": "Dining",
  bedroom: "Bedroom",
  bath: "Bath",
  office: "Home Office",
  lighting: "Lighting",
  outdoor: "Outdoor",
  modern: "Modern",
};

export const ROOM_ALIASES: Record<string, RoomSlug> = {
  living: "living-room",
  dining: "dining-room",
  "home-office": "office",
};

export function resolveRoomSlug(value: string | null): RoomSlug | null {
  if (isRoomSlug(value)) return value;
  return value ? ROOM_ALIASES[value] ?? null : null;
}

export function isRoomSlug(value: string | null): value is RoomSlug {
  return value !== null && Object.prototype.hasOwnProperty.call(ROOM_MAP, value);
}
