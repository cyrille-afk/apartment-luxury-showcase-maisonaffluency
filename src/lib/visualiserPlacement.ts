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
  origin: [number, number] = [0, 0],
): PlacementSlot {
  const step = Math.max(0.2, clampSpacing(spacing) / 2);
  const [ox, oz] = origin;
  const slots: PlacementSlot[] = [[ox, 0, oz]];
  for (let x = -24; x <= 24; x++) for (let z = -24; z <= 24; z++) slots.push([ox + x * step, 0, oz + z * step]);
  slots.sort((a, b) => ((a[0] - ox) ** 2 + (a[2] - oz) ** 2) - ((b[0] - ox) ** 2 + (b[2] - oz) ** 2));
  const free = (s: PlacementSlot) =>
    occupied.every((o) => Math.hypot(o.position[0] - s[0], o.position[2] - s[2]) >= o.radius + radius + FOOTPRINT_MARGIN);
  return slots.find(free) ?? [ox, 0, oz];
}

/** Back-to-back adds cascade +200 mm on X from the camera focus point. */
export const SPAWN_STAGGER_X = 0.2;

/** Where a ray from the camera along its view direction hits the Y = 0 floor; null if it never does. */
export function floorFocusPoint(
  camPos: [number, number, number],
  dir: [number, number, number],
): [number, number] | null {
  if (dir[1] >= -1e-4) return null;
  const t = -camPos[1] / dir[1];
  return [camPos[0] + dir[0] * t, camPos[2] + dir[2] * t];
}

export type FootprintObstacle = { position: [number, number, number]; radius: number };

/**
 * Collision-aware dragging: push a dragged piece's candidate position out of
 * every footprint it would overlap, so a piece can never be dropped inside or
 * on top of another. Iterates a few times so clusters of pieces resolve too.
 * Returns the adjusted [x, z] (the original when nothing overlaps).
 */
export function resolveDragPosition(
  x: number,
  z: number,
  selfRadius: number,
  obstacles: FootprintObstacle[],
): [number, number] {
  let px = x;
  let pz = z;
  for (let iteration = 0; iteration < 8; iteration++) {
    let moved = false;
    for (const obstacle of obstacles) {
      const minDist = obstacle.radius + selfRadius + FOOTPRINT_MARGIN;
      const dx = px - obstacle.position[0];
      const dz = pz - obstacle.position[2];
      const dist = Math.hypot(dx, dz);
      if (dist >= minDist) continue;
      if (dist < 1e-4) {
        // Dead centre on the obstacle: push out along +x arbitrarily.
        px = obstacle.position[0] + minDist;
      } else {
        const push = minDist / dist;
        px = obstacle.position[0] + dx * push;
        pz = obstacle.position[2] + dz * push;
      }
      moved = true;
    }
    if (!moved) break;
  }
  const clear = (cx: number, cz: number) =>
    obstacles.every(
      (o) => Math.hypot(cx - o.position[0], cz - o.position[2]) >= o.radius + selfRadius + FOOTPRINT_MARGIN,
    );
  if (clear(px, pz)) return [px, pz];
  // Tight clusters can make push-out oscillate; fall back to the nearest
  // clearly-free spot on a growing ring around the target.
  for (let ring = 1; ring <= 40; ring++) {
    const radiusStep = ring * 0.2;
    const steps = Math.max(8, ring * 8);
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const cx = x + Math.cos(angle) * radiusStep;
      const cz = z + Math.sin(angle) * radiusStep;
      if (clear(cx, cz)) return [cx, cz];
    }
  }
  return [px, pz];
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
