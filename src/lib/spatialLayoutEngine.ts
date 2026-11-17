import { resolveDimensions } from "./productDimensions";

export const SOFA_COFFEE_CLEARANCE_M = 0.45;
export const SOFA_SIDE_TABLE_CLEARANCE_M = 0.15;
export const SOFA_CONSOLE_CLEARANCE_M = 0.3;
export const LOUNGE_INWARD_ANGLE = 35 * Math.PI / 180;
export const DINING_CHAIR_SPACING_M = 0.15;
export const DINING_TABLE_CLEARANCE_M = 0.15;
const FALLBACK_DIMENSION_M = 0.8;
const SECONDARY_CLEARANCE_M = 0.3;

export type SpatialRole = "sofa" | "dining-table" | "coffee-table" | "lounge-chair" | "dining-chair" | "chair" | "side-table" | "console" | "other";
export type SpatialDimensionsM = { width: number; depth: number; height: number };
export type SpatialLayoutItem = {
  id: string;
  product_name?: string;
  name?: string;
  category?: string | null;
  subcategory?: string | null;
  dimensions?: string | null;
  width_mm?: number | null;
  depth_mm?: number | null;
  height_mm?: number | null;
  size_variants?: Array<{ label?: string | null; base?: string | null; top?: string | null }> | null;
};
export type SpatialPlacement<T extends SpatialLayoutItem> = {
  item: T;
  x: number;
  z: number;
  rotationY: number;
  isAnchor: boolean;
  role: SpatialRole;
  dimensions: SpatialDimensionsM;
};

const positive = (value: number | null | undefined) => value != null && Number.isFinite(value) && value > 0 ? value : null;
const idOf = (item: SpatialLayoutItem) => item.id;

/** Real recorded dimensions in metres; the fallback is only an unconfirmed drawing volume. */
export function spatialDimensionsM(item: SpatialLayoutItem): SpatialDimensionsM {
  const resolved = resolveDimensions(item);
  return {
    width: (positive(item.width_mm) ?? resolved?.w ?? FALLBACK_DIMENSION_M * 1000) / 1000,
    depth: (positive(item.depth_mm) ?? resolved?.d ?? FALLBACK_DIMENSION_M * 1000) / 1000,
    height: (positive(item.height_mm) ?? resolved?.h ?? FALLBACK_DIMENSION_M * 1000) / 1000,
  };
}

export function spatialRole(item: SpatialLayoutItem): SpatialRole {
  const text = `${item.category ?? ""} ${item.subcategory ?? ""} ${item.product_name ?? item.name ?? ""}`.toLowerCase();
  if (/\b(sofa|canap[eé]|settee|sectional)\b/i.test(text)) return "sofa";
  if (/\bdining\b/i.test(text) && /\b(table|desk)\b/i.test(text)) return "dining-table";
  if (/\b(console|sideboard|credenza)\b/i.test(text)) return "console";
  if (/\b(coffee|cocktail|centre|center|low)\b[\s-]*\btable\b/i.test(text) || /\b(coffee|cocktail) table\b/i.test(text)) return "coffee-table";
  if (/\b(side|end|bedside|occasional|accent)[\s-]*table\b/i.test(text)) return "side-table";
  if (/\bdining\b/i.test(text) && /\b(chair|seating|seat)\b/i.test(text)) return "dining-chair";
  if (/\b(lounge chair|armchair|club chair|accent chair|berg[eè]re|fauteuil)\b/i.test(text)) return "lounge-chair";
  if (/\b(chair|seating|seat)\b/i.test(text)) return "chair";
  return "other";
}

/** Pinned Anchor wins; otherwise the largest sofa/dining-table footprint, then the first saved piece. */
export function selectSpatialAnchor<T extends SpatialLayoutItem>(items: T[], pinnedId?: string | null): number {
  if (!items.length) return -1;
  const pinned = pinnedId == null ? -1 : items.findIndex(item => idOf(item) === pinnedId);
  if (pinned >= 0) return pinned;
  let best = -1;
  let bestArea = -1;
  items.forEach((item, index) => {
    const role = spatialRole(item);
    if (role !== "sofa" && role !== "dining-table") return;
    const { width, depth } = spatialDimensionsM(item);
    const area = width * depth;
    if (area > bestArea) { best = index; bestArea = area; }
  });
  return best >= 0 ? best : 0;
}

type Footprint = { x: number; z: number; width: number; depth: number; rotationY: number };
const axes = (rotationY: number) => [
  { x: Math.cos(rotationY), z: -Math.sin(rotationY) },
  { x: Math.sin(rotationY), z: Math.cos(rotationY) },
];
const radiusOn = (box: Footprint, axis: { x: number; z: number }) => {
  const [xAxis, zAxis] = axes(box.rotationY);
  return Math.abs(axis.x * xAxis.x + axis.z * xAxis.z) * box.width / 2
    + Math.abs(axis.x * zAxis.x + axis.z * zAxis.z) * box.depth / 2;
};

/** Separating-axis test for the actual rotated rectangles, not optimistic bounding circles. */
export function spatialFootprintsOverlap(a: Footprint, b: Footprint): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  for (const axis of [...axes(a.rotationY), ...axes(b.rotationY)]) {
    const distance = Math.abs(dx * axis.x + dz * axis.z);
    if (distance >= radiusOn(a, axis) + radiusOn(b, axis) - 1e-7) return false;
  }
  return true;
}

const footprintOf = <T extends SpatialLayoutItem>(placement: SpatialPlacement<T>): Footprint => ({
  x: placement.x, z: placement.z, rotationY: placement.rotationY,
  width: placement.dimensions.width, depth: placement.dimensions.depth,
});
const rotatedExtent = (dimensions: SpatialDimensionsM, rotationY: number) => {
  return {
    width: 2 * radiusOn({ x: 0, z: 0, width: dimensions.width, depth: dimensions.depth, rotationY }, { x: 1, z: 0 }),
    depth: 2 * radiusOn({ x: 0, z: 0, width: dimensions.width, depth: dimensions.depth, rotationY }, { x: 0, z: 1 }),
  };
};

function nearestFreePosition(candidate: Footprint, occupied: Footprint[]): { x: number; z: number } {
  if (!occupied.some(box => spatialFootprintsOverlap(candidate, box))) return { x: candidate.x, z: candidate.z };
  for (let ring = 1; ring <= 120; ring++) {
    const radius = ring * 0.1;
    const steps = Math.max(16, ring * 4);
    for (let step = 0; step < steps; step++) {
      const angle = step / steps * Math.PI * 2;
      const next = { ...candidate, x: candidate.x + Math.cos(angle) * radius, z: candidate.z + Math.sin(angle) * radius };
      if (!occupied.some(box => spatialFootprintsOverlap(next, box))) return { x: next.x, z: next.z };
    }
  }
  return { x: candidate.x, z: candidate.z };
}

type Candidate<T extends SpatialLayoutItem> = Omit<SpatialPlacement<T>, "isAnchor">;

function sofaCandidates<T extends SpatialLayoutItem>(anchor: Candidate<T>, secondary: T[]): Candidate<T>[] {
  const sofa = anchor.dimensions;
  const coffee = secondary.filter(item => spatialRole(item) === "coffee-table");
  const chairs = secondary.filter(item => ["lounge-chair", "chair"].includes(spatialRole(item)));
  const sideTables = secondary.filter(item => spatialRole(item) === "side-table");
  const consoles = secondary.filter(item => spatialRole(item) === "console");
  const specialised = new Set<T>([...coffee.slice(0, 1), ...chairs.slice(0, 2), ...sideTables.slice(0, 2), ...consoles]);
  const output: Candidate<T>[] = [anchor];
  const primaryCoffee = coffee[0];
  const coffeePlacement = primaryCoffee ? {
    item: primaryCoffee, role: "coffee-table" as const, dimensions: spatialDimensionsM(primaryCoffee), rotationY: 0,
    x: 0, z: (sofa.depth + spatialDimensionsM(primaryCoffee).depth) / 2 + SOFA_COFFEE_CLEARANCE_M,
  } : null;
  if (coffeePlacement) output.push(coffeePlacement);

  chairs.slice(0, 2).forEach((item, index) => {
    const side = index === 0 ? -1 : 1;
    const rotationY = side === -1 ? LOUNGE_INWARD_ANGLE : -LOUNGE_INWARD_ANGLE;
    const dimensions = spatialDimensionsM(item);
    const extent = rotatedExtent(dimensions, rotationY);
    const reference = coffeePlacement ? { x: coffeePlacement.x, z: coffeePlacement.z, width: coffeePlacement.dimensions.width } : { x: 0, z: (sofa.depth + dimensions.depth) / 2 + SOFA_COFFEE_CLEARANCE_M, width: sofa.width };
    output.push({ item, role: spatialRole(item), dimensions, rotationY, x: reference.x + side * (reference.width / 2 + extent.width / 2 + SECONDARY_CLEARANCE_M), z: reference.z });
  });
  sideTables.slice(0, 2).forEach((item, index) => {
    const dimensions = spatialDimensionsM(item);
    output.push({ item, role: "side-table", dimensions, rotationY: 0, x: (index === 0 ? -1 : 1) * (sofa.width / 2 + dimensions.width / 2 + SOFA_SIDE_TABLE_CLEARANCE_M), z: 0 });
  });
  let consoleX = 0;
  consoles.forEach((item, index) => {
    const dimensions = spatialDimensionsM(item);
    if (index > 0) consoleX += (spatialDimensionsM(consoles[index - 1]).width + dimensions.width) / 2 + SECONDARY_CLEARANCE_M;
    output.push({ item, role: "console", dimensions, rotationY: 0, x: consoleX, z: -(sofa.depth + dimensions.depth) / 2 - SOFA_CONSOLE_CLEARANCE_M });
  });
  for (const item of secondary) {
    if (specialised.has(item)) continue;
    const dimensions = spatialDimensionsM(item);
    output.push({ item, role: spatialRole(item), dimensions, rotationY: 0, x: 0, z: sofa.depth + dimensions.depth + 1 });
  }
  return output;
}

function diningCandidates<T extends SpatialLayoutItem>(anchor: Candidate<T>, secondary: T[]): Candidate<T>[] {
  const table = anchor.dimensions;
  const chairs = secondary.filter(item => ["dining-chair", "chair"].includes(spatialRole(item)));
  const specialised = new Set(chairs);
  const output: Candidate<T>[] = [anchor];
  const alongX = table.width >= table.depth;
  const sides = [chairs.filter((_, index) => index % 2 === 0), chairs.filter((_, index) => index % 2 === 1)];
  sides.forEach((sideChairs, sideIndex) => {
    const side = sideIndex === 0 ? -1 : 1;
    const total = sideChairs.reduce((sum, item) => sum + spatialDimensionsM(item).width, 0) + Math.max(0, sideChairs.length - 1) * DINING_CHAIR_SPACING_M;
    let cursor = -total / 2;
    sideChairs.forEach(item => {
      const dimensions = spatialDimensionsM(item);
      const across = cursor + dimensions.width / 2;
      cursor += dimensions.width + DINING_CHAIR_SPACING_M;
      const rotationY = alongX ? (side === -1 ? 0 : Math.PI) : (side === -1 ? Math.PI / 2 : -Math.PI / 2);
      output.push({
        item, role: spatialRole(item), dimensions, rotationY,
        x: alongX ? across : side * (table.width / 2 + DINING_TABLE_CLEARANCE_M + dimensions.depth / 2),
        z: alongX ? side * (table.depth / 2 + DINING_TABLE_CLEARANCE_M + dimensions.depth / 2) : across,
      });
    });
  });
  for (const item of secondary) {
    if (specialised.has(item)) continue;
    const dimensions = spatialDimensionsM(item);
    output.push({ item, role: spatialRole(item), dimensions, rotationY: 0, x: table.width + dimensions.width + 1, z: 0 });
  }
  return output;
}

function genericCandidates<T extends SpatialLayoutItem>(anchor: Candidate<T>, secondary: T[]): Candidate<T>[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(secondary.length + 1)));
  const maxWidth = Math.max(anchor.dimensions.width, ...secondary.map(item => spatialDimensionsM(item).width));
  const maxDepth = Math.max(anchor.dimensions.depth, ...secondary.map(item => spatialDimensionsM(item).depth));
  return [anchor, ...secondary.map((item, index) => ({
    item, role: spatialRole(item), dimensions: spatialDimensionsM(item), rotationY: 0,
    x: ((index + 1) % columns - (columns - 1) / 2) * (maxWidth + SECONDARY_CLEARANCE_M),
    z: (Math.floor((index + 1) / columns) - (columns - 1) / 2) * (maxDepth + SECONDARY_CLEARANCE_M),
  }))];
}

/** Deterministic, non-random room arrangement. Existing manual layouts do not pass through this utility. */
export function layoutSpatialItems<T extends SpatialLayoutItem>(items: T[], pinnedId?: string | null): SpatialPlacement<T>[] {
  const anchorIndex = selectSpatialAnchor(items, pinnedId);
  if (anchorIndex < 0) return [];
  const anchorItem = items[anchorIndex];
  const anchor: Candidate<T> = { item: anchorItem, role: spatialRole(anchorItem), dimensions: spatialDimensionsM(anchorItem), x: 0, z: 0, rotationY: 0 };
  const secondary = items.filter((_, index) => index !== anchorIndex);
  const candidates = anchor.role === "sofa" ? sofaCandidates(anchor, secondary)
    : anchor.role === "dining-table" ? diningCandidates(anchor, secondary)
      : genericCandidates(anchor, secondary);
  const occupied: Footprint[] = [];
  return candidates.map((candidate, index) => {
    const free = nearestFreePosition(footprintOf({ ...candidate, isAnchor: index === 0 }), occupied);
    const placement = { ...candidate, ...free, isAnchor: index === 0 };
    occupied.push(footprintOf(placement));
    return placement;
  });
}

export function spatialLayoutBounds<T extends SpatialLayoutItem>(placements: SpatialPlacement<T>[]) {
  if (!placements.length) return { width: 0, depth: 0 };
  const extents = placements.map(placement => {
    const extent = rotatedExtent(placement.dimensions, placement.rotationY);
    return { left: placement.x - extent.width / 2, right: placement.x + extent.width / 2, front: placement.z + extent.depth / 2, back: placement.z - extent.depth / 2 };
  });
  return {
    width: Math.max(...extents.map(extent => extent.right)) - Math.min(...extents.map(extent => extent.left)),
    depth: Math.max(...extents.map(extent => extent.front)) - Math.min(...extents.map(extent => extent.back)),
  };
}
