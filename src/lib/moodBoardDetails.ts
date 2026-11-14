import { supabase } from "@/integrations/supabase/client";
import type { PlaceableProduct } from "./placedObjectFactory";

export type MoodBoardDetail = PlaceableProduct & { retailCents: number | null; category: string; subcategory: string; width_mm?: number | null; depth_mm?: number | null; height_mm?: number | null };
/** Authenticated catalogue reads only; legacy trade_price_cents is the base RRP. */
export async function fetchMoodBoardDetails(ids: string[]): Promise<Map<string, MoodBoardDetail>> {
  const result = new Map<string, MoodBoardDetail>();
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    const [trade, picks, pricing] = await Promise.all([
      supabase.from("trade_products").select("id, source_pick_id, product_name, brand_name, image_url, dimensions, glb_url, category, subcategory, trade_price_cents, rrp_price_cents, currency, width_mm, depth_mm, height_mm")
        .eq("is_active", true).eq("is_hidden", false).or(`id.in.(${batch.join(",")}),source_pick_id.in.(${batch.join(",")})`),
      supabase.from("designer_curator_picks").select("id, title, image_url, dimensions, category, subcategory, width_mm, depth_mm, height_mm").in("id", batch).eq("is_hidden", false),
      supabase.from("trade_product_pricing").select("pick_id, trade_price_cents").in("pick_id", batch),
    ]);
    if (trade.error || picks.error || pricing.error) throw trade.error ?? picks.error ?? pricing.error;
    const missingPricing = [...new Set((trade.data ?? []).flatMap(p => p.source_pick_id && !batch.includes(p.source_pick_id) ? [p.source_pick_id] : []))];
    const linked = missingPricing.length ? await supabase.from("trade_product_pricing").select("pick_id, trade_price_cents").in("pick_id", missingPricing) : { data: [], error: null };
    if (linked.error) throw linked.error;
    const cents = new Map([...(pricing.data ?? []), ...(linked.data ?? [])].map(p => [p.pick_id, p.trade_price_cents]));
    for (const p of picks.data ?? []) result.set(p.id, { ...p, category: p.category ?? "", subcategory: p.subcategory ?? "", glb_url: null, product_name: p.title, brand_name: "", retailCents: cents.get(p.id) ?? null });
    for (const p of trade.data ?? []) {
      const base = (p.source_pick_id ? cents.get(p.source_pick_id) : null) || p.trade_price_cents || p.rrp_price_cents;
      const detail = { ...p, subcategory: p.subcategory ?? "", retailCents: (p.currency ?? "EUR") === "EUR" && base && base > 0 ? base : null };
      result.set(p.id, detail);
      if (p.source_pick_id) result.set(p.source_pick_id, { ...detail, id: p.source_pick_id });
    }
  }
  return result;
}