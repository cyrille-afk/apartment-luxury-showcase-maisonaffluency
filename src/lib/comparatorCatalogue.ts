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