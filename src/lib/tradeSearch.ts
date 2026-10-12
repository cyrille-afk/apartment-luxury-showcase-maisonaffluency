/**
 * Trade Gallery search matcher.
 *
 * Matches pieces by designer (brand), title, and collection (edition), plus
 * subtitle and materials. Every whitespace-separated token must match at
 * least one field, so "fuga scene" or "emma mushroom" narrow correctly while
 * token order doesn't matter.
 */
import type { TradeProduct } from "@/lib/tradeProducts";

export function searchMatches(product: TradeProduct, rawQuery: string): boolean {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;

  const haystacks = [
    product.product_name,
    product.brand_name,
    product.subtitle,
    product.edition,
    product.materials,
    product.materials_description,
    product.description,
    product.reedition_by,
    ...(product.tags || []),
  ]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map((v) => v.toLowerCase());

  return tokens.every((token) => haystacks.some((h) => h.includes(token)));
}
