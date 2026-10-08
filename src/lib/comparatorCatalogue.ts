import { supabase } from "@/integrations/supabase/client";
import { applyTradeDiscount } from "@/lib/productPricing";
import type { TradeProduct } from "@/lib/tradeProducts";

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function comparatorDesignerGroups(products: TradeProduct[], search: string, letter: string, favoriteIds?: ReadonlySet<string>) {
  const groups = new Map<string, TradeProduct[]>();
  for (const product of products) {
    if (favoriteIds && !favoriteIds.has(product.id) && !favoriteIds.has(product.trade_product_id ?? "")) continue;
    if (letter && !fold(product.brand_name).startsWith(letter.toLowerCase())) continue;
    if (search && !fold([product.product_name, product.brand_name, product.subtitle].join(" ")).includes(fold(search.trim()))) continue;
    const items = groups.get(product.brand_name) ?? [];
    items.push(product);
    groups.set(product.brand_name, items);
  }
  return Array.from(groups, ([designer, pieces]) => ({ designer, pieces: pieces.sort((a, b) => a.product_name.localeCompare(b.product_name, "en")) }))
    .sort((a, b) => fold(a.designer).localeCompare(fold(b.designer), "en"));
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