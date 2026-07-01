import { supabase } from "@/integrations/supabase/client";

/**
 * Fallback resolver for quote line prices.
 *
 * `trade_products` is a mirror of `designer_curator_picks` maintained by a
 * database trigger. When that mirror is missing a row, has a NULL
 * `trade_price_cents`, or has drifted stale from the source pick, quotes end
 * up displaying "Price on Request" or a wrong number even though the pick
 * itself has a valid price.
 *
 * This helper takes any collection of quote items that carry a
 * `source_pick_id` on the joined product, batch-fetches the corresponding
 * curator picks, and rewrites the product's `trade_price_cents` / `currency`
 * to the pick's values whenever the pick has a price. The pick is treated as
 * the source of truth — if it has a price, we prefer it over whatever the
 * mirror row says.
 *
 * The `unit_price_cents` override on `trade_quote_items` (manual per-line
 * price) is untouched and continues to win downstream.
 */

type ProductLike = {
  source_pick_id?: string | null;
  trade_price_cents?: number | null;
  rrp_price_cents?: number | null;
  currency?: string | null;
} | null | undefined;

type ItemLike<K extends string> = { [key in K]?: ProductLike };

export async function hydrateQuotePricesFromPicks<K extends string, T extends ItemLike<K>>(
  items: T[],
  productKey: K,
): Promise<T[]> {
  if (!items || items.length === 0) return items;

  const pickIds = Array.from(
    new Set(
      items
        .map((it) => it[productKey]?.source_pick_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );
  if (pickIds.length === 0) return items;

  const { data: picks, error } = await supabase
    .from("designer_curator_picks")
    .select("id, trade_price_cents, currency")
    .in("id", pickIds);
  if (error || !picks) return items;

  const priceByPick = new Map<string, { cents: number | null; currency: string | null }>();
  for (const p of picks as Array<{ id: string; trade_price_cents: number | null; currency: string | null }>) {
    priceByPick.set(p.id, { cents: p.trade_price_cents, currency: p.currency });
  }

  return items.map((it) => {
    const prod = it[productKey];
    if (!prod) return it;
    const src = prod.source_pick_id ? priceByPick.get(prod.source_pick_id) : undefined;
    if (!src || src.cents == null) return it;
    // Pick has a real price → treat as source of truth.
    return {
      ...it,
      [productKey]: {
        ...prod,
        trade_price_cents: src.cents,
        currency: src.currency ?? prod.currency ?? "EUR",
      },
    } as T;
  });
}
