import type { AICuratedSceneSchema, ArchitecturalAnchor } from "@/types/aiCuratedScene";
import { applyTradeDiscount } from "@/lib/tradePricing";
import { footprint } from "@/lib/roomLayoutMatrix";
import { toAsset, type LayoutBrief, type LiveCatalogueItem, type Role } from "@/lib/mockAiLayoutService";

/**
 * Bridge between the AI architect prompt (origin bottom-left, x = width, y = length,
 * clockwise degrees, trade_cost budget) and the centred scene used by the 3D view.
 * The model's output is never trusted: every placement is re-checked here.
 */
export const COFFEE_TABLE_GAP = 0.6;
const GAP_TOLERANCE = 0.05;
const ANCHOR_DEPTH: Record<ArchitecturalAnchor["type"], number> = { window: 0.3, door: 0.9, wall_opening: 0.6 };

const CATEGORY: Record<Role, string> = { anchor: "sofa", table: "coffee_table", seat: "accent_chair", accent: "side_table", light: "floor_lamp" };

export interface ArchitectCatalogRow { sku: string; name: string; category: string; style_tokens: string[]; width_m: number; depth_m: number; height_m: number; trade_cost: number | null }
export interface ArchitectPlacement { sku: string; category: string; position: [number, number, number]; rotation: number; layout_logic_justification: string }
export interface ArchitectOutput { layout_metadata: { total_items_placed: number; total_trade_spend_eur: number; budget_buffer_remaining: number }; placements: ArchitectPlacement[] }

/** Trade cost = live RRP less the viewer's tier discount; unpriced or unavailable pieces get null (POR). */
export function buildArchitectCatalog(items: LiveCatalogueItem[], discountPct: number): ArchitectCatalogRow[] {
  return items.map((c) => {
    const { w, d } = footprint(c);
    const cents = c.available && c.price != null ? applyTradeDiscount(Math.round(c.price * 100), discountPct) : null;
    return { sku: c.componentId, name: c.name, category: CATEGORY[c.role], style_tokens: c.styleTokens.slice(0, 8), width_m: w, depth_m: d, height_m: c.dimensionsCubic?.h ?? 0.8, trade_cost: cents != null ? cents / 100 : null };
  });
}

/** Scene anchors (centred) → prompt anchors (bottom-left origin) with an occupied footprint. */
export function anchorsForPrompt(anchors: ArchitecturalAnchor[], W: number, L: number) {
  return anchors.map((a) => {
    const alongX = Math.abs(Math.sin(a.rotation[1])) < 0.5;
    const len = a.scale[0];
    const dep = ANCHOR_DEPTH[a.type];
    return { type: a.type, position: [round(a.position[0] + W / 2), round(a.position[2] + L / 2), round(a.position[1])], width_m: alongX ? len : dep, length_m: alongX ? dep : len };
  });
}

type Rect = { x0: number; x1: number; y0: number; y1: number };
const rect = (cx: number, cy: number, w: number, d: number): Rect => ({ x0: cx - w / 2, x1: cx + w / 2, y0: cy - d / 2, y1: cy + d / 2 });
const hit = (a: Rect, b: Rect) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.y0 < b.y1 - 1e-6 && a.y1 > b.y0 + 1e-6;
const round = (n: number) => Math.round(n * 1000) / 1000;

export interface ArchitectValidation { ok: boolean; errors: string[]; scene: AICuratedSceneSchema | null; tradeSpend: number }

export function validateArchitectLayout(out: ArchitectOutput, brief: LayoutBrief, catalogue: LiveCatalogueItem[], rows: ArchitectCatalogRow[], anchors: ArchitecturalAnchor[]): ArchitectValidation {
  const { width: W, length: L, height: H } = brief.roomDimensions;
  const errors: string[] = [];
  const bySku = new Map(rows.map((r) => [r.sku, r]));
  const items = new Map(catalogue.map((c) => [c.componentId, c]));
  const anchorRects = anchorsForPrompt(anchors, W, L).map((a) => rect(a.position[0], a.position[1], a.width_m, a.length_m));
  const placed: Array<{ p: ArchitectPlacement; r: Rect; row: ArchitectCatalogRow }> = [];
  let spend = 0;

  for (const p of out.placements ?? []) {
    const row = bySku.get(p.sku);
    if (!row) { errors.push(`${p.sku}: not in catalogue`); continue; }
    if (row.trade_cost == null) { errors.push(`${row.name}: Price upon Request — cannot be placed`); continue; }
    if (![0, 90, 180, 270].includes(p.rotation)) { errors.push(`${row.name}: rotation ${p.rotation} not allowed`); continue; }
    const turned = p.rotation === 90 || p.rotation === 270;
    const r = rect(p.position[0], p.position[1], turned ? row.depth_m : row.width_m, turned ? row.width_m : row.depth_m);
    if (r.x0 < -1e-6 || r.y0 < -1e-6 || r.x1 > W + 1e-6 || r.y1 > L + 1e-6) errors.push(`${row.name}: outside the room`);
    if (anchorRects.some((a) => hit(a, r))) errors.push(`${row.name}: blocks a window or door`);
    for (const q of placed) if (hit(q.r, r)) errors.push(`${row.name} overlaps ${q.row.name}`);
    spend += row.trade_cost;
    placed.push({ p, r, row });
  }
  if (spend > brief.totalBudget + 1e-6) errors.push(`Trade spend €${spend.toFixed(2)} exceeds budget €${brief.totalBudget.toFixed(2)}`);

  const sofa = placed.find((x) => x.row.category === "sofa");
  const table = placed.find((x) => x.row.category === "coffee_table");
  if (sofa && table) {
    const g = gapInFront(sofa.r, sofa.p.rotation, table.r);
    if (g == null || Math.abs(g - COFFEE_TABLE_GAP) > GAP_TOLERANCE) errors.push(`Coffee table gap ${g == null ? "not in front of sofa" : `${g.toFixed(2)} m`} (must be ${COFFEE_TABLE_GAP} m)`);
  }

  if (errors.length) return { ok: false, errors, scene: null, tradeSpend: spend };
  const assets = placed.map(({ p }) => toAsset(items.get(p.sku)!, [round(p.position[0] - W / 2), 0, round(p.position[1] - L / 2)], [0, (p.rotation * Math.PI) / 180, 0]));
  const rrp = assets.reduce((s, a) => s + a.priceAtCuration, 0);
  return {
    ok: true, errors, tradeSpend: spend,
    scene: { roomDimensions: { width: W, length: L, height: H }, architecturalAnchors: anchors, curatedAssets: assets, financialSummary: { totalBudget: brief.totalBudget, allocatedSpend: rrp, remainingBuffer: brief.totalBudget - rrp } },
  };
}

/** Clear distance from the sofa's front edge to the table, along the sofa's facing direction. */
export function gapInFront(s: Rect, rotation: number, t: Rect): number | null {
  const overlapX = s.x0 < t.x1 && s.x1 > t.x0;
  const overlapY = s.y0 < t.y1 && s.y1 > t.y0;
  switch (rotation) {
    case 0: return overlapX ? round(t.y0 - s.y1) : null;
    case 180: return overlapX ? round(s.y0 - t.y1) : null;
    case 90: return overlapY ? round(t.x0 - s.x1) : null;
    case 270: return overlapY ? round(s.x0 - t.x1) : null;
    default: return null;
  }
}
