/**
 * prefillLineShipping
 * -------------------
 * After a trade_quote_items row is inserted, copy the catalogue's packing
 * defaults (CBM, weight, default ship mode, pickup country) into the line's
 * ship_* columns when those columns are still NULL. The per-line shipping
 * estimator (`usePerLineShipping`) then has accurate inputs from day one
 * instead of waiting for the studio to type CBM/weight per line.
 *
 * Always non-destructive: existing line overrides are preserved.
 */
import { supabase } from "@/integrations/supabase/client";

export async function prefillLineShippingFromCatalog(itemIds: string[]): Promise<void> {
  if (!itemIds.length) return;

  const { data: items } = await supabase
    .from("trade_quote_items")
    .select("id, product_id, ship_cbm, ship_weight_kg, ship_mode, ship_origin_country")
    .in("id", itemIds);
  if (!items?.length) return;

  const productIds = Array.from(
    new Set(items.map((i: any) => i.product_id).filter(Boolean) as string[]),
  );
  if (!productIds.length) return;

  const { data: products } = await supabase
    .from("trade_products")
    .select("id, pack_cbm, pack_weight_kg, default_ship_mode, pickup_country")
    .in("id", productIds);
  const productMap = new Map<string, any>();
  (products || []).forEach((p: any) => productMap.set(p.id, p));

  await Promise.all(
    items.map(async (item: any) => {
      const prod = productMap.get(item.product_id);
      if (!prod) return;
      const patch: Record<string, any> = {};
      if (item.ship_cbm == null && prod.pack_cbm != null) patch.ship_cbm = prod.pack_cbm;
      if (item.ship_weight_kg == null && prod.pack_weight_kg != null) patch.ship_weight_kg = prod.pack_weight_kg;
      if (!item.ship_mode && prod.default_ship_mode) patch.ship_mode = prod.default_ship_mode;
      if (!item.ship_origin_country && prod.pickup_country) patch.ship_origin_country = prod.pickup_country;
      if (Object.keys(patch).length === 0) return;
      await supabase.from("trade_quote_items").update(patch as any).eq("id", item.id);
    }),
  );
}
