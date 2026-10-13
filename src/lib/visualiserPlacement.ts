export type PlacementSlot = [number, number, number];

export const DEFAULT_SLOT_SPACING = 1.4;
export const MIN_SLOT_SPACING = 0.6;
export const MAX_SLOT_SPACING = 3;
export const SLOT_SPACING_STEP = 0.2;
/** Grid step used by the optional snap-to-grid drag mode. */
export const SNAP_GRID_STEP = 0.25;
const GRID_RANGE = 6;

/** Round a coordinate to the nearest grid line. */
export const snapCoordinate = (value: number, step: number = SNAP_GRID_STEP): number =>
  Math.round(value / step) * step;

const clampSpacing = (spacing: number) =>
  Math.min(MAX_SLOT_SPACING, Math.max(MIN_SLOT_SPACING, spacing));

export function pickFreeSlot(
  occupied: { position: [number, number, number] }[],
  spacing: number = DEFAULT_SLOT_SPACING,
): PlacementSlot {
  const gap = clampSpacing(spacing);
  const slots: PlacementSlot[] = [];
  for (let x = -GRID_RANGE; x <= GRID_RANGE; x++) {
    for (let z = -GRID_RANGE; z <= GRID_RANGE; z++) {
      slots.push([x * gap, 0, z * gap]);
    }
  }
  slots.sort(
    (a, b) => (a[0] * a[0] + a[2] * a[2]) - (b[0] * b[0] + b[2] * b[2]),
  );
  const isOccupied = (slot: PlacementSlot) =>
    occupied.some(
      (object) =>
        Math.abs(object.position[0] - slot[0]) < gap * 0.5 &&
        Math.abs(object.position[2] - slot[2]) < gap * 0.5,
    );
  return slots.find((slot) => !isOccupied(slot)) ?? [0, 0, 0];
}

/** Default footprint radius (m) when a piece has no recorded dimensions. */
export const DEFAULT_FOOTPRINT_RADIUS = 0.6;
const FOOTPRINT_MARGIN = 0.15;

/** Half the diagonal of a W×D footprint (mm) at the given scale, in metres. */
export function footprintRadius(dims: { w: number; d: number } | null | undefined, scale = 1): number {
  if (!dims || !(dims.w > 0) || !(dims.d > 0)) return DEFAULT_FOOTPRINT_RADIUS * scale;
  return (Math.hypot(dims.w, dims.d) / 2000) * scale;
}

/**
 * Like pickFreeSlot, but respects each piece's real footprint (size × scale),
 * so a new piece never lands inside a large or scaled-up existing one.
 */
export function pickFootprintSlot(
  occupied: { position: [number, number, number]; radius: number }[],
  radius: number,
  spacing: number = DEFAULT_SLOT_SPACING,
): PlacementSlot {
  const step = Math.max(0.2, clampSpacing(spacing) / 2);
  const slots: PlacementSlot[] = [];
  for (let x = -24; x <= 24; x++) for (let z = -24; z <= 24; z++) slots.push([x * step, 0, z * step]);
  slots.sort((a, b) => (a[0] * a[0] + a[2] * a[2]) - (b[0] * b[0] + b[2] * b[2]));
  const free = (s: PlacementSlot) =>
    occupied.every((o) => Math.hypot(o.position[0] - s[0], o.position[2] - s[2]) >= o.radius + radius + FOOTPRINT_MARGIN);
  return slots.find(free) ?? [0, 0, 0];
}


/**
 * Re-lays out every object on the grid at the given spacing, preserving each
 * object's current relative order (sorted by distance from centre, then row)
 * so the scene keeps its rough arrangement while the gaps change.
 */
export function respaceObjects<T extends { position: [number, number, number]; positionLocked?: boolean }>(
  objects: T[],
  spacing: number = DEFAULT_SLOT_SPACING,
): T[] {
  const ordered = [...objects].sort((a, b) => {
    const da = a.position[0] * a.position[0] + a.position[2] * a.position[2];
    const db = b.position[0] * b.position[0] + b.position[2] * b.position[2];
    if (da !== db) return da - db;
    return a.position[2] - b.position[2] || a.position[0] - b.position[0];
  });
  const placed: { position: [number, number, number] }[] = objects.filter(object => object.positionLocked);
  return ordered.map((object) => {
    if (object.positionLocked) return object;
    const position = pickFreeSlot(placed, spacing);
    placed.push({ position });
    return { ...object, position };
  });
}
