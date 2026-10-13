export type PlacementSlot = [number, number, number];

export const DEFAULT_SLOT_SPACING = 1.4;
export const MIN_SLOT_SPACING = 0.6;
export const MAX_SLOT_SPACING = 3;
export const SLOT_SPACING_STEP = 0.2;
const GRID_RANGE = 6;

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

/**
 * Re-lays out every object on the grid at the given spacing, preserving each
 * object's current relative order (sorted by distance from centre, then row)
 * so the scene keeps its rough arrangement while the gaps change.
 */
export function respaceObjects<T extends { position: [number, number, number] }>(
  objects: T[],
  spacing: number = DEFAULT_SLOT_SPACING,
): T[] {
  const ordered = [...objects].sort((a, b) => {
    const da = a.position[0] * a.position[0] + a.position[2] * a.position[2];
    const db = b.position[0] * b.position[0] + b.position[2] * b.position[2];
    if (da !== db) return da - db;
    return a.position[2] - b.position[2] || a.position[0] - b.position[0];
  });
  const placed: { position: [number, number, number] }[] = [];
  return ordered.map((object) => {
    const position = pickFreeSlot(placed, spacing);
    placed.push({ position });
    return { ...object, position };
  });
}
