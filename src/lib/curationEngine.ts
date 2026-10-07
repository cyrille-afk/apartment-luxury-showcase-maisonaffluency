import type { AICuratedSceneSchema, CuratedAsset, Vec3 } from "@/types/aiCuratedScene";
import { toAsset, type LayoutBrief, type LiveCatalogueItem, type Role } from "@/lib/mockAiLayoutService";

/**
 * Client-side curation matrix for the AI Layout Studio: parses a text brief,
 * scores live catalogue pieces against style tokens, then runs a knapsack
 * sweep so the chosen set never exceeds the strict budget. Prices are live
 * EUR trade-member figures from fetchLiveCatalogue.
 */

/** Canonical style tokens and the phrases that imply them. */
const STYLE_VOCAB: Record<string, RegExp> = {
  "Warm Minimalism": /warm[\s-]*minimal|minimalis|pared[\s-]*back|serene/i,
  "Quiet Luxury": /quiet[\s-]*lux|understated|discreet|refined/i,
  "Mid-Century Luxury": /mid[\s-]*century|sixties|fifties|retro/i,
  Sculptural: /sculptur|organic|curv|biomorph/i,
  "Neutral Palette": /neutral|beige|sand|ivory|cream|stone|natural tones?/i,
  "Natural Materials": /oak|walnut|wood|linen|travertine|marble|bouclé|boucle/i,
};

/** Roles the brief can request, and their trigger words. */
const ROLE_VOCAB: Record<Role, RegExp> = {
  anchor: /sofa|couch|settee/i,
  light: /light|lamp|lighting/i,
  table: /coffee\s*table|centre\s*table|center\s*table/i,
  seat: /armchair|lounge\s*chair|chairs?\b/i,
  accent: /side\s*table|stool|ottoman|accent/i,
};

const DEFAULT_ROLES: Role[] = ["anchor", "light", "table"];

export interface ParsedBrief {
  raw: string;
  styleTokens: string[];
  budget: number | null;
  requiredRoles: Role[];
}

export function parseBrief(text: string): ParsedBrief {
  const raw = text.trim().slice(0, 2000);
  const styleTokens = Object.entries(STYLE_VOCAB).filter(([, re]) => re.test(raw)).map(([t]) => t);
  const m = raw.match(/(?:budget|max|under|up to|€|\$|eur|usd)[^\d]{0,12}([\d][\d,.\s]*)\s*(k|m)?/i);
  let budget: number | null = null;
  if (m) {
    const n = Number(m[1].replace(/[,\s]/g, ""));
    const mult = m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
    if (Number.isFinite(n) && n > 0) budget = Math.round(n * mult);
  }
  const named = (Object.keys(ROLE_VOCAB) as Role[]).filter((r) => ROLE_VOCAB[r].test(raw));
  return { raw, styleTokens, budget, requiredRoles: named.length ? named : DEFAULT_ROLES };
}

export interface MatrixRow {
  item: LiveCatalogueItem;
  score: number; // 0..1 style match
  matched: string[];
  eligible: boolean;
  reason?: string;
}

export interface CurationResult {
  parsed: ParsedBrief;
  budget: number;
  matrix: MatrixRow[];
  selected: Array<MatrixRow & { role: Role }>;
  total: number;
  utilisation: number; // 0..1 of budget
  unmet: Role[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function scoreItem(item: LiveCatalogueItem, tokens: string[]) {
  if (!tokens.length) return { score: 0.5, matched: [] as string[] };
  const own = new Set(item.styleTokens.map(norm));
  const matched = tokens.filter((t) => own.has(norm(t)));
  // Untagged pieces are neutral, not excluded — tokens are still being backfilled.
  if (!own.size) return { score: 0.4, matched };
  return { score: matched.length / tokens.length, matched };
}

/** Builds the curation matrix and selects a cohesive set within budget. */
export function curate(text: string, catalogue: LiveCatalogueItem[], fallbackBudget: number): CurationResult {
  const parsed = parseBrief(text);
  const budget = parsed.budget ?? fallbackBudget;

  const matrix: MatrixRow[] = catalogue.map((item) => {
    const { score, matched } = scoreItem(item, parsed.styleTokens);
    const reason = !item.available ? "Unavailable" : item.price == null ? "Price upon Request" : item.price > budget ? "Over budget" : undefined;
    return { item, score, matched, eligible: !reason && (parsed.styleTokens.length === 0 || score > 0), reason: reason ?? (score > 0 || !parsed.styleTokens.length ? undefined : "Style mismatch") };
  });
  const pool = matrix.filter((r) => r.eligible);

  // Multiple-choice knapsack: exactly one piece per required role.
  // Value = style score (dominant) + spend (tie-break: use budget well).
  const roles = parsed.requiredRoles;
  let best: { rows: MatrixRow[]; value: number; cost: number } | null = null;
  const walk = (i: number, rows: MatrixRow[], cost: number, value: number) => {
    if (cost > budget) return;
    if (i === roles.length) {
      const v = value * 1e6 + cost;
      if (!best || v > best.value) best = { rows: [...rows], value: v, cost };
      return;
    }
    const options = pool.filter((r) => r.item.role === roles[i] && !rows.includes(r));
    if (!options.length) return walk(i + 1, rows, cost, value); // role unmet
    for (const o of options) walk(i + 1, [...rows, o], cost + (o.item.price ?? 0), value + o.score);
  };
  walk(0, [], 0, 0);

  const core = (best as { rows: MatrixRow[]; cost: number } | null)?.rows ?? [];
  const coreCost = (best as { cost: number } | null)?.cost ?? 0;

  // 0/1 knapsack over complementary pieces with the remaining budget (€100 units).
  const extras = pool.filter((r) => !core.includes(r) && !roles.includes(r.item.role));
  const unit = 100;
  const cap = Math.max(0, Math.floor((budget - coreCost) / unit));
  const dp: number[] = new Array(cap + 1).fill(0);
  const take: boolean[][] = extras.map(() => new Array(cap + 1).fill(false));
  extras.forEach((r, k) => {
    const w = Math.ceil((r.item.price ?? 0) / unit);
    const val = Math.round((r.score + 0.1) * 1000) + w; // style first, then spend
    for (let c = cap; c >= w; c--) {
      if (dp[c - w] + val > dp[c]) { dp[c] = dp[c - w] + val; take[k][c] = true; }
    }
  });
  const chosenExtras: MatrixRow[] = [];
  for (let k = extras.length - 1, c = cap; k >= 0; k--) {
    if (take[k][c]) { chosenExtras.push(extras[k]); c -= Math.ceil((extras[k].item.price ?? 0) / unit); }
  }

  const selected = [...core, ...chosenExtras.reverse()].map((r) => ({ ...r, role: r.item.role }));
  const total = selected.reduce((s, r) => s + (r.item.price ?? 0), 0);
  const unmet = roles.filter((role) => !core.some((r) => r.item.role === role));
  return { parsed, budget, matrix, selected, total, utilisation: budget ? total / budget : 0, unmet };
}

/** Places a curation result into an AICuratedSceneSchema with role-based slots. */
export function sceneFromCuration(result: CurationResult, brief: LayoutBrief): AICuratedSceneSchema {
  const { width: W, length: L, height: H } = brief.roomDimensions;
  const slots: Record<Role, Array<[Vec3, Vec3]>> = {
    anchor: [[[0, 0, -L * 0.22], [0, 0, 0]]],
    table: [[[0, 0, 0.15], [0, 0, 0]]],
    seat: [[[-1.7, 0, 0.9], [0, Math.PI * 0.75, 0]], [[1.7, 0, 0.9], [0, -Math.PI * 0.75, 0]]],
    accent: [[[1.55, 0, -L * 0.22], [0, 0, 0]], [[W / 2 - 0.9, 0, L / 2 - 1.1], [0, 0.6, 0]]],
    light: [[[-W / 2 + 0.6, 0, -L / 2 + 0.6], [0, Math.PI / 4, 0]], [[W / 2 - 0.6, 0, -L / 2 + 0.6], [0, -Math.PI / 4, 0]]],
  };
  const used: Record<Role, number> = { anchor: 0, table: 0, seat: 0, accent: 0, light: 0 };
  const curatedAssets: CuratedAsset[] = result.selected.map((r, i) => {
    const list = slots[r.role];
    const [pos, rot] = list[used[r.role]++ % list.length] ?? [[i * 0.8, 0, 2], [0, 0, 0]];
    return toAsset(r.item, pos, rot);
  });
  const allocatedSpend = curatedAssets.reduce((s, a) => s + a.priceAtCuration, 0);
  return {
    roomDimensions: { width: W, length: L, height: H },
    architecturalAnchors: [
      { type: "window", position: [0, 1.5, -L / 2], rotation: [0, 0, 0], scale: [2.4, 1.8, 0.1] },
      { type: "door", position: [W / 2, 1.1, L / 4], rotation: [0, -Math.PI / 2, 0], scale: [1.0, 2.2, 0.1] },
    ],
    curatedAssets,
    financialSummary: { totalBudget: result.budget, allocatedSpend, remainingBuffer: result.budget - allocatedSpend },
  };
}
