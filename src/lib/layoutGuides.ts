import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { RoomBounds } from "@/lib/activeProjectLayout";
import { resolveDimensions } from "@/lib/productDimensions";

/**
 * Dimension guides and clearance math for the layout views. Everything works
 * in room metres with the origin at the room centre — the same coordinate
 * space as LayoutPlanCanvas and the 3D scene (x = position[0], y = position[2]).
 */

/** Walkway at or above this reads as comfortable. */
export const CLEARANCE_COMFORTABLE_M = 0.9;
/** Below this the gap is blocked for walking (matches the 0.6 m coffee-table rule). */
export const CLEARANCE_TIGHT_M = 0.6;

const FALLBACK_FOOTPRINT_M = 0.6;

export type ClearanceLevel = "comfortable" | "tight" | "blocked";

export const clearanceLevel = (distance: number): ClearanceLevel =>
  distance >= CLEARANCE_COMFORTABLE_M ? "comfortable" : distance >= CLEARANCE_TIGHT_M ? "tight" : "blocked";

export type Vec = [number, number];

/** Oriented footprint rectangle: centre, half extents, yaw in radians. */
export type Footprint = { cx: number; cy: number; hw: number; hd: number; rot: number };

export const footprintOf = (object: PlacedObject): Footprint => {
  const dims = resolveDimensions(object);
  const scale = object.scale || 1;
  return {
    cx: object.position[0],
    cy: object.position[2],
    hw: (((dims?.w ?? FALLBACK_FOOTPRINT_M * 1000) / 1000) * scale) / 2,
    hd: (((dims?.d ?? FALLBACK_FOOTPRINT_M * 1000) / 1000) * scale) / 2,
    rot: object.rotation[1] || 0,
  };
};

export const footprintCorners = (f: Footprint): Vec[] => {
  const cos = Math.cos(f.rot);
  const sin = Math.sin(f.rot);
  const local: Vec[] = [
    [-f.hw, -f.hd],
    [f.hw, -f.hd],
    [f.hw, f.hd],
    [-f.hw, f.hd],
  ];
  return local.map(([x, y]) => [f.cx + x * cos - y * sin, f.cy + x * sin + y * cos]);
};

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1];
const cross = (a: Vec, b: Vec): number => a[0] * b[1] - a[1] * b[0];
const dist = (a: Vec, b: Vec): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Closest point on segment ab to point p. */
const closestOnSegment = (p: Vec, a: Vec, b: Vec): Vec => {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  if (len2 === 0) return a;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2));
  return [a[0] + ab[0] * t, a[1] + ab[1] * t];
};

const segmentsIntersect = (a: Vec, b: Vec, c: Vec, d: Vec): boolean => {
  const d1 = cross(sub(d, c), sub(a, c));
  const d2 = cross(sub(d, c), sub(b, c));
  const d3 = cross(sub(b, a), sub(c, a));
  const d4 = cross(sub(b, a), sub(d, a));
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
};

const pointInPolygon = (p: Vec, poly: Vec[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export type ClearanceSpan = {
  /** Metres between the two closest points (0 when footprints overlap). */
  distance: number;
  level: ClearanceLevel;
  /** Closest point on the measured piece. */
  from: Vec;
  /** Closest point on the other piece or wall. */
  to: Vec;
};

/** Minimum distance between two oriented footprints, with the closest point pair. */
export const footprintClearance = (a: Footprint, b: Footprint): ClearanceSpan => {
  const ca = footprintCorners(a);
  const cb = footprintCorners(b);
  let best: { d: number; from: Vec; to: Vec } = { d: Infinity, from: ca[0], to: cb[0] };
  let touching = pointInPolygon(ca[0], cb) || pointInPolygon(cb[0], ca);
  for (let i = 0; i < 4; i++) {
    const a1 = ca[i];
    const a2 = ca[(i + 1) % 4];
    for (let j = 0; j < 4; j++) {
      const b1 = cb[j];
      const b2 = cb[(j + 1) % 4];
      if (segmentsIntersect(a1, a2, b1, b2)) touching = true;
      const candidates: [Vec, Vec][] = [
        [closestOnSegment(a1, b1, b2), a1],
        [closestOnSegment(a2, b1, b2), a2],
        [b1, closestOnSegment(b1, a1, a2)],
        [b2, closestOnSegment(b2, a1, a2)],
      ];
      for (const [onB, onA] of candidates) {
        const d = dist(onA, onB);
        if (d < best.d) best = { d, from: onA, to: onB };
      }
    }
  }
  if (touching) return { distance: 0, level: clearanceLevel(0), from: best.from, to: best.to };
  return { distance: best.d, level: clearanceLevel(best.d), from: best.from, to: best.to };
};

export type WallSide = "left" | "right" | "top" | "bottom";

/** Clearance from a footprint to each wall, using the footprint's axis-aligned bounds. */
export const wallClearances = (f: Footprint, bounds: RoomBounds): (ClearanceSpan & { side: WallSide })[] => {
  const cos = Math.abs(Math.cos(f.rot));
  const sin = Math.abs(Math.sin(f.rot));
  const aabbHw = f.hw * cos + f.hd * sin;
  const aabbHd = f.hw * sin + f.hd * cos;
  const walls: { side: WallSide; gap: number; from: Vec; to: Vec }[] = [
    { side: "right", gap: bounds.width / 2 - (f.cx + aabbHw), from: [f.cx + aabbHw, f.cy], to: [bounds.width / 2, f.cy] },
    { side: "left", gap: f.cx - aabbHw + bounds.width / 2, from: [f.cx - aabbHw, f.cy], to: [-bounds.width / 2, f.cy] },
    { side: "bottom", gap: bounds.depth / 2 - (f.cy + aabbHd), from: [f.cx, f.cy + aabbHd], to: [f.cx, bounds.depth / 2] },
    { side: "top", gap: f.cy - aabbHd + bounds.depth / 2, from: [f.cx, f.cy - aabbHd], to: [f.cx, -bounds.depth / 2] },
  ];
  return walls.map(({ side, gap, from, to }) => ({
    side,
    from,
    to,
    distance: Math.max(0, gap),
    level: clearanceLevel(Math.max(0, gap)),
  }));
};

export type PieceClearance = ClearanceSpan & { otherId: string; otherName: string };

/** Clearances from one placed piece to every other piece, nearest last. */
export const pieceClearances = (objects: PlacedObject[], targetId: string): PieceClearance[] => {
  const target = objects.find((o) => o.instanceId === targetId);
  if (!target) return [];
  const tf = footprintOf(target);
  return objects
    .filter((o) => o.instanceId !== targetId)
    .map((o) => ({ ...footprintClearance(tf, footprintOf(o)), otherId: o.instanceId, otherName: o.product_name }))
    .sort((a, b) => b.distance - a.distance);
};

/** Tightest gap anywhere in the room (piece-to-piece or piece-to-wall). */
export const tightestGap = (objects: PlacedObject[], bounds: RoomBounds): ClearanceSpan | null => {
  let best: ClearanceSpan | null = null;
  const consider = (span: ClearanceSpan) => {
    if (!best || span.distance < best.distance) best = span;
  };
  for (let i = 0; i < objects.length; i++) {
    const fi = footprintOf(objects[i]);
    for (const wall of wallClearances(fi, bounds)) consider(wall);
    for (let j = i + 1; j < objects.length; j++) {
      consider(footprintClearance(fi, footprintOf(objects[j])));
    }
  }
  return best;
};

/** Nearest clearance for a single piece (piece or wall), for compact readouts. */
export const nearestClearance = (
  objects: PlacedObject[],
  bounds: RoomBounds,
  targetId: string,
): { distance: number; level: ClearanceLevel; targetName: string } | null => {
  const target = objects.find((o) => o.instanceId === targetId);
  if (!target) return null;
  const tf = footprintOf(target);
  let best: { distance: number; level: ClearanceLevel; targetName: string } | null = null;
  for (const o of objects) {
    if (o.instanceId === targetId) continue;
    const span = footprintClearance(tf, footprintOf(o));
    if (!best || span.distance < best.distance) best = { distance: span.distance, level: span.level, targetName: o.product_name };
  }
  for (const wall of wallClearances(tf, bounds)) {
    if (!best || wall.distance < best.distance) best = { distance: wall.distance, level: wall.level, targetName: `${wall.side} wall` };
  }
  return best;
};

export const formatGap = (distance: number): string =>
  distance >= 1 ? `${distance.toFixed(2)} m` : `${Math.round(distance * 100)} cm`;
