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

export function generateRoomLayoutMatrix(criteria: LayoutBrief, catalogue: LiveCatalogueItem[]): LayoutMatrixResult {
  const { width: W, length: L, height: H } = criteria.roomDimensions;
  const matrix = buildFloorMatrix(W, L);
  const usable = catalogue
    .filter((c) => c.available && c.price != null)
    .sort((a, b) => a.componentId.localeCompare(b.componentId));
  const budget = criteria.totalBudget;
  const skipped: string[] = [];
  const assets: CuratedAsset[] = [];
  const boxes: Box[] = [];
  let spend = 0;

  // Style-matched pieces first, then the cheapest that still fits the remaining budget.
  const pick = (roles: Role[]) => {
    const pool = usable.filter((c) => roles.includes(c.role));
    const fits = pool.filter((c) => spend + (c.price ?? 0) <= budget);
    const ranked = [...fits].sort((a, b) => Number(matchesStyle(b, criteria.style)) - Number(matchesStyle(a, criteria.style)) || (b.price ?? 0) - (a.price ?? 0));
    if (!ranked.length) skipped.push(pool.length ? `${roles[0]} (over budget)` : `No available ${roles[0]}`);
    return ranked[0];
  };
  const place = (item: LiveCatalogueItem, x: number, z: number, rotation: Vec3, box: Box) => {
    spend += item.price ?? 0;
    boxes.push(box);
    mark(matrix, box, W, L);
    assets.push(toAsset(item, [x, 0, z], rotation));
  };

  // 1. Sofa: centred on X, slightly behind the room centre so the table fits in front.
  let sofaFront = 0;
  const sofa = pick(["anchor"]);
  if (sofa) {
    const { w, d } = footprint(sofa);
    const z = -Math.min(L * 0.12, Math.max(0, L / 2 - WALL_MARGIN - d / 2));
    place(sofa, 0, z, [0, 0, 0], boxAt(0, z, w, d));
    sofaFront = z + d / 2;
  }

  // 2. Coffee table: 0.6 m clearance in front (+Z) of the sofa box.
  const table = pick(["table"]);
  if (table) {
    const { w, d } = footprint(table);
    const z = sofa ? sofaFront + TABLE_CLEARANCE + d / 2 : 0;
    const box = boxAt(0, z, w, d);
    if (box.maxZ <= L / 2 - WALL_MARGIN) place(table, 0, z, [0, 0, 0], box);
    else skipped.push(`${table.name} (no room in front of sofa)`);
  }

  // 3. Accent/lighting: corner of the emptiest perimeter quadrant.
  const accent = pick(["light", "accent"]);
  if (accent) {
    const { w, d } = footprint(accent);
    const corners: Array<[number, number]> = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    const half = (sx: number, sz: number) => {
      let n = 0;
      for (let r = 0; r < matrix.rows; r++) for (let c = 0; c < matrix.cols; c++) {
        if ((c < matrix.cols / 2 ? -1 : 1) === sx && (r < matrix.rows / 2 ? -1 : 1) === sz && matrix.occupied[r][c]) n++;
      }
      return n;
    };
    const spot = corners
      .map(([sx, sz]) => {
        const x = sx * (W / 2 - WALL_MARGIN - w / 2);
        const z = sz * (L / 2 - WALL_MARGIN - d / 2);
        return { x, z, used: half(sx, sz), box: boxAt(x, z, w, d) };
      })
      .filter((s) => !boxes.some((b) => overlaps(b, s.box)))
      .sort((a, b) => a.used - b.used)[0];
    if (spot) place(accent, spot.x, spot.z, [0, Math.atan2(-spot.x, -spot.z), 0], spot.box);
    else skipped.push(`${accent.name} (no free quadrant)`);
  }

  return {
    matrix,
    skipped,
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
