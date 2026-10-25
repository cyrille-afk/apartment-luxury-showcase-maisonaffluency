import { supabase } from "@/integrations/supabase/client";
import { applyTradeDiscount } from "@/lib/productPricing";
import type { TradeProduct } from "@/lib/tradeProducts";
import { withImperialPerLine } from "./formatDimensions";
import { formatEditionLabel } from "./editionLabel";

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export type ComparatorProduct = TradeProduct & { maker_name?: string | null };

export function comparatorDesignerGroups(products: ComparatorProduct[], search: string, letter: string, favoriteIds?: ReadonlySet<string>) {
  const groups = new Map<string, TradeProduct[]>();
  for (const product of products) {
    if (favoriteIds && !favoriteIds.has(product.id) && !favoriteIds.has(product.trade_product_id ?? "")) continue;
    if (search && !fold([product.product_name, product.brand_name, product.maker_name, product.subtitle].join(" ")).includes(fold(search.trim()))) continue;
    for (const name of new Set([product.brand_name, product.maker_name].filter((n): n is string => !!n))) {
      if (letter && !fold(name).startsWith(letter.toLowerCase())) continue;
      const items = groups.get(name) ?? [];
      items.push(product);
      groups.set(name, items);
    }
  }
  return Array.from(groups, ([designer, pieces]) => ({ designer, pieces: pieces.sort((a, b) => a.product_name.localeCompare(b.product_name, "en")) }))
    .sort((a, b) => fold(a.designer).localeCompare(fold(b.designer), "en"));
}

type DetailSource = { dimensions?: string | null; materials?: string | null; width_mm?: number | null; depth_mm?: number | null; height_mm?: number | null; size_variants?: unknown };
export function comparatorDetails(source: DetailSource) {
  const variants = Array.isArray(source.size_variants) ? source.size_variants.flatMap(v => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return [];
    return [{ label: typeof v.label === "string" ? v.label : null, base: typeof v.base === "string" ? v.base : null, top: typeof v.top === "string" ? v.top : null }];
  }) : [];
  const labels = variants.map(v => v.label?.trim()).filter((v): v is string => !!v && /\d/.test(v));
  const explicit = source.width_mm && source.depth_mm && source.height_mm ? `W ${source.width_mm / 10} × D ${source.depth_mm / 10} × H ${source.height_mm / 10} cm` : "";
  const dimensions = [...new Set([source.dimensions?.trim() || explicit, ...labels].filter(Boolean))].join("\n");
  const materials = [...new Set([source.materials?.trim(), ...variants.flatMap(v => [v.base?.trim(), v.top?.trim()])].filter((v): v is string => !!v))].join("\n");
  return { dimensions: withImperialPerLine(dimensions), materials };
}

export async function fetchComparatorDetails() {
  const { data, error } = await supabase.from("designer_curator_picks").select("id, dimensions, materials, width_mm, depth_mm, height_mm, size_variants, edition, edition_number, edition_signing, tags, designers(founder)").eq("is_hidden", false).eq("hidden_in_studio", false);
  if (error) throw error;
  return new Map((data ?? []).map(row => [row.id, { ...comparatorDetails(row as DetailSource), maker_name: row.designers?.founder, reedition_by: row.designers?.founder ?? undefined, edition: formatEditionLabel(row) ?? undefined, tags: row.tags ?? [] }]));
}

export function comparatorPrices(row: { trade_price_cents: number | null; rrp_price_cents: number | null }, discountPct: number) {
  // The catalogue's legacy trade_price_cents field is the base RRP, not net wholesale.
  const retail = row.trade_price_cents && row.trade_price_cents > 0 ? row.trade_price_cents : row.rrp_price_cents;
  if (!retail || retail <= 0) return { retail: null, trade: null };
  return { retail, trade: applyTradeDiscount(retail, discountPct) };
}

/**
 * Resolves public product routes (/designers/<designer>/<piece>) for curator-pick ids.
 * Used to snapshot client-safe links into saved shortlists.
 */
export async function resolvePublicUrlsByPickIds(pickIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(pickIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const { data: picks, error } = await supabase
    .from("designer_curator_picks_public")
    .select("id, slug, designer_id")
    .in("id", ids);
  if (error || !picks) return new Map();
  const designerIds = [...new Set(picks.map((p) => p.designer_id).filter((id): id is string => Boolean(id)))];
  const { data: designers } = designerIds.length
    ? await supabase.from("designers").select("id, slug").in("id", designerIds)
    : { data: [] as { id: string; slug: string }[] };
  const designerSlugs = new Map((designers ?? []).map((d) => [d.id, d.slug]));
  const urls = new Map<string, string>();
  for (const p of picks) {
    const designerSlug = p.designer_id ? designerSlugs.get(p.designer_id) : null;
    if (designerSlug && p.slug) {
      urls.set(p.id, `/designers/${encodeURIComponent(designerSlug)}/${encodeURIComponent(p.slug)}`);
    }
  }
  return urls;
}