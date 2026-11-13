import type { AICuratedSceneSchema, CuratedAsset, Vec3 } from "@/types/aiCuratedScene";
import { toAsset, type LayoutBrief, type LiveCatalogueItem, type Role } from "@/lib/mockAiLayoutService";

/**
 * Deterministic, rule-based room layout. Same criteria + catalogue → same scene.
 * Places three components on the floor grid without overlap:
 *  - sofa near the grid centre,
 *  - coffee table 0.6 m in front of the sofa (clearance between their boxes),
 *  - accent/lighting piece in the emptiest perimeter quadrant.
 * Prices are the live approved-member RRPs passed in; unpriced or unavailable
 * pieces are never placed and the total never exceeds the budget.
 */
export const GRID_CELL = 0.5; // metres per floor-grid cell
export const TABLE_CLEARANCE = 0.6; // metres between sofa front and table
const WALL_MARGIN = 0.4;

const DEFAULT_SIZE: Record<Role, { w: number; d: number }> = {
  anchor: { w: 2.4, d: 1.0 },
  table: { w: 1.2, d: 0.7 },
  seat: { w: 0.8, d: 0.8 },
  accent: { w: 0.5, d: 0.5 },
  light: { w: 0.5, d: 0.5 },
};

export interface Box { minX: number; maxX: number; minZ: number; maxZ: number }
export interface FloorMatrix { cols: number; rows: number; cell: number; occupied: boolean[][] }

export const footprint = (item: LiveCatalogueItem) =>
  item.dimensionsCubic ? { w: item.dimensionsCubic.w, d: item.dimensionsCubic.d } : DEFAULT_SIZE[item.role];

export const boxAt = (x: number, z: number, w: number, d: number): Box => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
export const overlaps = (a: Box, b: Box) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

export function buildFloorMatrix(width: number, length: number, cell = GRID_CELL): FloorMatrix {
  const cols = Math.max(1, Math.round(width / cell));
  const rows = Math.max(1, Math.round(length / cell));
  return { cols, rows, cell, occupied: Array.from({ length: rows }, () => Array(cols).fill(false)) };
}

function mark(m: FloorMatrix, b: Box, width: number, length: number) {
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    const x = -width / 2 + (c + 0.5) * m.cell;
    const z = -length / 2 + (r + 0.5) * m.cell;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) m.occupied[r][c] = true;
  }
}

const STYLE_TOKENS: Record<LayoutBrief["style"], string[]> = {
  "quiet-luxury": ["quiet luxury", "quiet-luxury", "understated", "refined", "luxury"],
  sculptural: ["sculptural", "organic", "statement"],
  "warm-minimal": ["warm minimal", "warm-minimal", "minimal", "minimalist", "warm"],
};
const matchesStyle = (item: LiveCatalogueItem, style: LayoutBrief["style"]) =>
  item.styleTokens.some((t) => STYLE_TOKENS[style].some((s) => t.toLowerCase().includes(s)));

export interface LayoutMatrixResult { scene: AICuratedSceneSchema; skipped: string[]; matrix: FloorMatrix }

/** Room/style are ranking preferences; a thin strict pool expands to priced catalogue pieces. */
export function selectLayoutCandidates(criteria: LayoutBrief, catalogue: LiveCatalogueItem[]): LiveCatalogueItem[] {
  const usable = catalogue.filter((c) => c.available && c.price != null && c.price > 0 && c.price <= criteria.totalBudget);
  const roomMatch = (c: LiveCatalogueItem) => !c.category || /living|lounge|salon|seating|sofa|chair|table|console|stool|lighting|lamp/i.test(c.category);
  const strict = usable.filter((c) => roomMatch(c) && matchesStyle(c, criteria.style));
  return [...(strict.length >= 3 ? strict : usable)].sort((a, b) =>
    Number(Boolean(b.projectPriority)) - Number(Boolean(a.projectPriority)) || Number(roomMatch(b)) - Number(roomMatch(a)) ||
    Number(matchesStyle(b, criteria.style)) - Number(matchesStyle(a, criteria.style)) ||
    (a.price ?? 0) - (b.price ?? 0) || a.componentId.localeCompare(b.componentId));
}

export function generateRoomLayoutMatrix(criteria: LayoutBrief, catalogue: LiveCatalogueItem[]): LayoutMatrixResult {
  const { width: W, length: L, height: H } = criteria.roomDimensions;
  const matrix = buildFloorMatrix(W, L);
  const usable = selectLayoutCandidates(criteria, catalogue);
  const budget = criteria.totalBudget;
  const skipped: string[] = [];
  const assets: CuratedAsset[] = [];
  const boxes: Box[] = [];
  let spend = 0;
  // Keep a circulation strip clear at the existing right-wall doorway.
  const door = boxAt(W / 2 - 0.45, L / 4, 0.9, 1.8);
  const fits = (b: Box) => b.minX >= -W / 2 + WALL_MARGIN && b.maxX <= W / 2 - WALL_MARGIN &&
    b.minZ >= -L / 2 + WALL_MARGIN && b.maxZ <= L / 2 - WALL_MARGIN && !overlaps(b, door) &&
    !boxes.some((q) => overlaps(b, { minX: q.minX - 0.15, maxX: q.maxX + 0.15, minZ: q.minZ - 0.15, maxZ: q.maxZ + 0.15 }));
  const placedIds = new Set<string>();
  const place = (item: LiveCatalogueItem, x: number, z: number, yaw = 0) => {
    const size = footprint(item);
    const turned = Math.abs(Math.sin(yaw)) > 0.5;
    const b = boxAt(x, z, turned ? size.d : size.w, turned ? size.w : size.d);
    if (spend + (item.price ?? 0) > budget || (item.dimensionsCubic?.h ?? 0) > H || !fits(b)) return false;
    spend += item.price ?? 0;
    placedIds.add(item.componentId);
    boxes.push(b); mark(matrix, b, W, L);
    assets.push(toAsset(item, [x, 0, z], [0, yaw, 0]));
    return true;
  };
  // Anchor a conversation group centrally; try smaller candidates if one cannot fit.
  let sofaFront: number | null = null;
  let sofaWidth = 2.4;
  for (const item of usable.filter((c) => c.role === "anchor")) {
    const { w, d } = footprint(item);
    const z = -Math.min(L * 0.12, Math.max(0, L / 2 - WALL_MARGIN - d / 2));
    if (place(item, 0, z)) { sofaFront = z + d / 2; sofaWidth = w; break; }
  }
  for (const item of usable.filter((c) => c.role === "table")) {
    const { d } = footprint(item);
    if (place(item, 0, sofaFront == null ? 0 : sofaFront + TABLE_CLEARANCE + d / 2)) break;
  }
  const roleOrder: Role[] = ["seat", "accent", "light", "anchor", "table"];
  for (const role of roleOrder) for (const item of usable.filter((c) => c.role === role && !placedIds.has(c.componentId))) {
    if (spend + (item.price ?? 0) > budget) { skipped.push(`${item.name} (over budget)`); continue; }
    const { w, d } = footprint(item);
    const perimeter = /console|sideboard|credenza|cabinet/i.test(item.name + " " + (item.category ?? ""));
    const preferred: Array<[number, number, number]> = perimeter
      ? [[0, -L / 2 + WALL_MARGIN + d / 2, 0], [-W / 2 + WALL_MARGIN + d / 2, 0, Math.PI / 2]]
      : role === "seat"
        ? [[-sofaWidth / 2 - d / 2 - 0.6, 0.5, Math.PI / 2], [sofaWidth / 2 + d / 2 + 0.6, 0.5, -Math.PI / 2]]
        : [[sofaWidth / 2 + w / 2 + 0.25, -L * 0.12, 0], [-W / 2 + WALL_MARGIN + w / 2, -L / 2 + WALL_MARGIN + d / 2, 0]];
    let done = preferred.some(([x, z, yaw]) => place(item, x, z, yaw));
    // Deterministic perimeter-first search keeps every additional fitting piece, not just three roles.
    if (!done) {
      const spots: Array<[number, number]> = [];
      for (let z = -L / 2 + WALL_MARGIN + d / 2; z <= L / 2 - WALL_MARGIN - d / 2; z += 0.25)
        for (let x = -W / 2 + WALL_MARGIN + w / 2; x <= W / 2 - WALL_MARGIN - w / 2; x += 0.25) spots.push([x, z]);
      spots.sort((a, b) => (Math.min(W / 2 - Math.abs(a[0]), L / 2 - Math.abs(a[1])) - Math.min(W / 2 - Math.abs(b[0]), L / 2 - Math.abs(b[1]))));
      done = spots.some(([x, z]) => place(item, x, z));
    }
    if (!done) skipped.push(`${item.name} (no safe space)`);
  }
  return {
    matrix, skipped,
    scene: {
      roomDimensions: { width: W, length: L, height: H },
      architecturalAnchors: [
        { type: "window", position: [0, 1.5, -L / 2], rotation: [0, 0, 0], scale: [2.4, 1.8, 0.1] },
        { type: "door", position: [W / 2, 1.1, L / 4], rotation: [0, -Math.PI / 2, 0], scale: [1.0, 2.2, 0.1] },
      ],
      curatedAssets: assets,
      financialSummary: { totalBudget: budget, allocatedSpend: spend, remainingBuffer: budget - spend },
    },
  };
}
