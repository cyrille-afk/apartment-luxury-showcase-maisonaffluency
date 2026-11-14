import { supabase } from "@/integrations/supabase/client";
import type { PlaceableProduct } from "./placedObjectFactory";
import { getFxRate } from "./fxRates";

/** The budget ledger is EUR-based; supplier RRPs must be converted, not discarded. */
export async function moodRetailEur(cents: number | null | undefined, currency: string | null | undefined): Promise<number | null> {
  if (cents == null || cents <= 0) return null;
  return Math.round(cents * await getFxRate((currency || "EUR").toUpperCase(), "EUR"));
}

export function moodCataloguePrice(base: number | null | undefined, variants: unknown): { cents: number | null; from: boolean } {
  if (base != null && base > 0) return { cents: base, from: false };
  const prices = Array.isArray(variants) ? variants.flatMap(v => v && typeof v.price_cents === "number" && Number.isFinite(v.price_cents) && v.price_cents > 0 ? [v.price_cents] : []) : [];
  return { cents: prices.length ? Math.min(...prices) : null, from: prices.length > 0 };
}

export type MoodBoardDetail = PlaceableProduct & { retailCents: number | null; priceFrom: boolean; category: string; subcategory: string; width_mm?: number | null; depth_mm?: number | null; height_mm?: number | null };
/** Authenticated catalogue reads only; legacy trade_price_cents is the base RRP. */
export async function fetchMoodBoardDetails(ids: string[]): Promise<Map<string, MoodBoardDetail>> {
  const result = new Map<string, MoodBoardDetail>();
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    const [trade, picks, pricing] = await Promise.all([
      supabase.from("trade_products").select("id, source_pick_id, product_name, brand_name, image_url, dimensions, glb_url, category, subcategory, trade_price_cents, rrp_price_cents, size_variants, currency, width_mm, depth_mm, height_mm")
        .eq("is_active", true).eq("is_hidden", false).or(`id.in.(${batch.join(",")}),source_pick_id.in.(${batch.join(",")})`),
      supabase.from("designer_curator_picks").select("id, title, image_url, dimensions, category, subcategory, size_variants, currency, width_mm, depth_mm, height_mm").in("id", batch).eq("is_hidden", false),
      supabase.from("trade_product_pricing").select("pick_id, trade_price_cents").in("pick_id", batch),
    ]);
    if (trade.error || picks.error || pricing.error) throw trade.error ?? picks.error ?? pricing.error;
    const missingPricing = [...new Set((trade.data ?? []).flatMap(p => p.source_pick_id && !batch.includes(p.source_pick_id) ? [p.source_pick_id] : []))];
    const linked = missingPricing.length ? await supabase.from("trade_product_pricing").select("pick_id, trade_price_cents").in("pick_id", missingPricing) : { data: [], error: null };
    if (linked.error) throw linked.error;
    const cents = new Map([...(pricing.data ?? []), ...(linked.data ?? [])].map(p => [p.pick_id, p.trade_price_cents]));
    for (const p of picks.data ?? []) {
      const { size_variants, ...product } = p;
      const price = moodCataloguePrice(cents.get(p.id), size_variants);
      result.set(p.id, { ...product, category: p.category ?? "", subcategory: p.subcategory ?? "", glb_url: null, product_name: p.title, brand_name: "", retailCents: await moodRetailEur(price.cents, p.currency), priceFrom: price.from });
    }
    for (const p of trade.data ?? []) {
      const base = (p.source_pick_id ? cents.get(p.source_pick_id) : null) || p.trade_price_cents || p.rrp_price_cents;
      const { size_variants, ...product } = p;
      const price = moodCataloguePrice(base, size_variants);
      const detail = { ...product, subcategory: p.subcategory ?? "", retailCents: await moodRetailEur(price.cents, p.currency), priceFrom: price.from };
      result.set(p.id, detail);
      if (p.source_pick_id) result.set(p.source_pick_id, { ...detail, id: p.source_pick_id });
    }
  }
  return result;
}