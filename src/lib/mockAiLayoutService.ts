import { supabase } from "@/integrations/supabase/client";
import type { AICuratedSceneSchema, CuratedAsset, Vec3 } from "@/types/aiCuratedScene";

/**
 * Client-side layout generator. Placement is mocked; prices and availability are
 * live from the trade catalogue (approved-member pricing, never the public view).
 */
export interface LayoutBrief {
  roomType: "living" | "lounge" | "salon";
  totalBudget: number;
  style: "quiet-luxury" | "sculptural" | "warm-minimal";
  roomDimensions: AICuratedSceneSchema["roomDimensions"];
}

export type Role = "anchor" | "seat" | "table" | "accent" | "light";

export interface LiveCatalogueItem {
  componentId: string;
  sku: string;
  name: string;
  role: Role;
  glbUrl: string;
  /** EUR RRP; null = Price upon Request (excluded from budget). */
  price: number | null;
  stockStatus: string | null;
  leadWeeks: [number, number] | null;
  available: boolean;
  /** design_style_tokens ∪ style_tags, used by curationEngine. */
  styleTokens: string[];
  /** Bounding box in metres, when recorded. */
  dimensionsCubic: { w: number; d: number; h: number } | null;
}

/** Layout roles for the pieces the generator knows how to place. */
const ROLES: Record<string, Role> = {
  "ffd33487-bb3d-4d18-80ee-1e35b858738e": "anchor", // Sandy Cove Sofa
  "f198902d-aa9e-41d8-8630-bad4226aaa45": "table", // Praia da Granja Coffee Table
  "cd3c22d9-cd6c-488a-aff0-d6776c8a742f": "seat", // Rua Leblon
  "353547c3-ea0c-4d59-b79a-21b761bfb291": "seat", // Frenchmen Street Armchair
  "2816322a-94f6-49e7-a70f-4a8c15292d5a": "seat", // Frenchmen Street Lounge Chair
  "8a072491-e699-44ee-ac6b-51838d7514ed": "accent", // Madison Avenue Side Table
  "938efe1a-8744-47e9-9d1d-dbd00634ab1a": "accent", // Bond Street Stool
  "163af529-08b9-4391-9a48-03663261c085": "light", // Cinnamon Gardens Floor Lamp
};

const UNAVAILABLE = new Set(["discontinued", "out_of_stock", "unavailable", "sold_out"]);
const cleanName = (n: string) => n.replace(/\s+by Yabu Pushelberg$/i, "").trim();

/** Loads live price + availability for every placeable piece. Requires an approved trade session. */
export async function fetchLiveCatalogue(): Promise<LiveCatalogueItem[]> {
  const ids = Object.keys(ROLES);
  const { data: products, error } = await supabase
    .from("trade_products")
    .select("id, product_name, sku, glb_url, trade_price_cents, currency, source_pick_id, is_active, is_hidden, design_style_tokens, style_tags, dimensions_cubic")
    .in("id", ids);
  if (error) throw error;

  const pickIds = (products ?? []).map((p) => p.source_pick_id).filter(Boolean) as string[];
  const { data: pricing } = pickIds.length
    ? await supabase.from("trade_product_pricing").select("pick_id, trade_price_cents").in("pick_id", pickIds)
    : { data: [] as { pick_id: string; trade_price_cents: number | null }[] };
  const pickPrice = new Map((pricing ?? []).map((r) => [r.pick_id, r.trade_price_cents]));

  return Promise.all(
    (products ?? [])
      .filter((p) => p.glb_url)
      .map(async (p) => {
        let stockStatus: string | null = null;
        let leadWeeks: [number, number] | null = null;
        try {
          const { data } = await (supabase as any).rpc("effective_product_availability", { _product_id: p.id });
          const row = data?.[0];
          if (row) {
            stockStatus = row.stock_status ?? null;
            if (row.lead_weeks_min != null) leadWeeks = [row.lead_weeks_min, row.lead_weeks_max ?? row.lead_weeks_min];
          }
        } catch {
          /* availability unknown — treat as orderable */
        }
        const cents = (p.source_pick_id && pickPrice.get(p.source_pick_id)) || p.trade_price_cents || 0;
        const available = p.is_active !== false && !p.is_hidden && !UNAVAILABLE.has((stockStatus ?? "").toLowerCase());
        return {
          componentId: p.id,
          sku: p.sku || p.id,
          name: cleanName(p.product_name),
          role: ROLES[p.id],
          glbUrl: p.glb_url as string,
          price: cents > 0 && (p.currency ?? "EUR") === "EUR" ? cents / 100 : null,
          stockStatus,
          leadWeeks,
          available,
          styleTokens: Array.from(new Set([...(p.design_style_tokens ?? []), ...(p.style_tags ?? [])])),
          dimensionsCubic: (() => {
            const d = p.dimensions_cubic as { w?: number; d?: number; h?: number } | null;
            return d && [d.w, d.d, d.h].every((n) => typeof n === "number") ? { w: d.w!, d: d.d!, h: d.h! } : null;
          })(),
        } satisfies LiveCatalogueItem;
      }),
  );
}

export const DEFAULT_BRIEF: LayoutBrief = {
  roomType: "living",
  totalBudget: 60000,
  style: "quiet-luxury",
  roomDimensions: { width: 7.2, length: 6.0, height: 3.2 },
};

const UNIT: Vec3 = [1, 1, 1];
const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export const toAsset = (item: LiveCatalogueItem, position: Vec3, rotation: Vec3, scale: Vec3 = UNIT): CuratedAsset => ({
  sku: item.sku,
  componentId: item.componentId,
  glbUrl: item.glbUrl,
  priceAtCuration: item.price ?? 0,
  position,
  rotation,
  scale,
});

/** Places a conversation group, using only available, priced pieces that fit the budget. */
export async function generateRoomLayout(
  brief: LayoutBrief,
  catalogue: LiveCatalogueItem[],
  seed = Date.now(),
): Promise<{ scene: AICuratedSceneSchema; skipped: string[] }> {
  const rnd = rand(Math.max(1, Math.floor(seed) % 2147483646));
  const { width: W, length: L, height: H } = brief.roomDimensions;
  const jitter = () => (rnd() - 0.5) * 0.3;
  const usable = catalogue.filter((c) => c.available && c.price != null);
  const pick = (role: Role, prefer?: (c: LiveCatalogueItem) => boolean) => {
    const pool = usable.filter((c) => c.role === role);
    return pool.find((c) => prefer?.(c)) ?? pool[0];
  };

  const seat = pick("seat", (c) => (brief.style === "sculptural" ? /leblon/i.test(c.name) : /armchair/i.test(c.name)));
  const plan: Array<{ item?: LiveCatalogueItem; role: Role; position: Vec3; rotation: Vec3 }> = [
    { role: "anchor", item: pick("anchor"), position: [jitter(), 0, -L * 0.22], rotation: [0, 0, 0] },
    { role: "table", item: pick("table"), position: [jitter(), 0, 0.15], rotation: [0, 0, 0] },
    { role: "seat", item: seat, position: [-1.7, 0, 0.9 + jitter()], rotation: [0, Math.PI * 0.75, 0] },
    { role: "seat", item: seat, position: [1.7, 0, 0.9 + jitter()], rotation: [0, -Math.PI * 0.75, 0] },
    { role: "accent", item: pick("accent", (c) => /side table/i.test(c.name)), position: [1.55, 0, -L * 0.22], rotation: [0, 0, 0] },
    { role: "light", item: pick("light"), position: [-W / 2 + 0.6, 0, -L / 2 + 0.6], rotation: [0, Math.PI / 4, 0] },
    { role: "accent", item: pick("accent", (c) => /stool/i.test(c.name)), position: [W / 2 - 0.9, 0, L / 2 - 1.1], rotation: [0, rnd() * Math.PI, 0] },
  ];

  let spend = 0;
  const skipped: string[] = [];
  const curatedAssets: CuratedAsset[] = [];
  for (const p of plan) {
    if (!p.item) { skipped.push(`No available ${p.role}`); continue; }
    if (spend + (p.item.price ?? 0) > brief.totalBudget) { skipped.push(`${p.item.name} (over budget)`); continue; }
    spend += p.item.price ?? 0;
    curatedAssets.push(toAsset(p.item, p.position, p.rotation));
  }

  const scene: AICuratedSceneSchema = {
    roomDimensions: { width: W, length: L, height: H },
    architecturalAnchors: [
      { type: "window", position: [0, 1.5, -L / 2], rotation: [0, 0, 0], scale: [2.4, 1.8, 0.1] },
      { type: "door", position: [W / 2, 1.1, L / 4], rotation: [0, -Math.PI / 2, 0], scale: [1.0, 2.2, 0.1] },
      { type: "wall_opening", position: [-W / 2, 1.3, L / 5], rotation: [0, Math.PI / 2, 0], scale: [1.6, 2.6, 0.1] },
    ],
    curatedAssets,
    financialSummary: { totalBudget: brief.totalBudget, allocatedSpend: spend, remainingBuffer: brief.totalBudget - spend },
  };
  return { scene, skipped };
}

/** Re-prices every asset from the live catalogue, then recomputes the ledger. */
export const repriceScene = (scene: AICuratedSceneSchema, catalogue: LiveCatalogueItem[]): AICuratedSceneSchema => {
  const byId = new Map(catalogue.map((c) => [c.componentId, c]));
  const curatedAssets = scene.curatedAssets.map((a) => ({ ...a, priceAtCuration: byId.get(a.componentId)?.price ?? 0 }));
  const next = { ...scene, curatedAssets };
  return { ...next, financialSummary: summarise(next) };
};

/** Recomputes the ledger after edits so it never drifts from curatedAssets. */
export const summarise = (scene: AICuratedSceneSchema): AICuratedSceneSchema["financialSummary"] => {
  const allocatedSpend = scene.curatedAssets.reduce((s, a) => s + a.priceAtCuration, 0);
  return { totalBudget: scene.financialSummary.totalBudget, allocatedSpend, remainingBuffer: scene.financialSummary.totalBudget - allocatedSpend };
};
