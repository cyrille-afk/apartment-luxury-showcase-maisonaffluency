/**
 * Explicit sort options for the Trade Gallery, layered on top of the curated
 * sequence. Accent-insensitive; deterministic tie-breakers.
 */
import type { TradeProduct } from "@/lib/tradeProducts";
import { sortNameKey } from "@/lib/nameFormat";

export type TradeSortMode = "curated" | "designer" | "title" | "recent";

const fold = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function sortTradeProducts<T extends Pick<TradeProduct, "brand_name" | "product_name" | "created_at">>(
  products: T[],
  sortBy: TradeSortMode,
): T[] {
  if (sortBy === "curated") return products;
  const out = products.slice();
  if (sortBy === "designer") {
    out.sort((a, b) =>
      sortNameKey(a.brand_name).localeCompare(sortNameKey(b.brand_name)) ||
      fold(a.product_name).localeCompare(fold(b.product_name)));
  } else if (sortBy === "title") {
    out.sort((a, b) =>
      fold(a.product_name).localeCompare(fold(b.product_name)) ||
      sortNameKey(a.brand_name).localeCompare(sortNameKey(b.brand_name)));
  } else {
    // Most recently added: newest first; picks without a timestamp last.
    out.sort((a, b) => {
      const at = a.created_at || "";
      const bt = b.created_at || "";
      if (!at && !bt) return 0;
      if (!at) return 1;
      if (!bt) return -1;
      return bt < at ? -1 : bt > at ? 1 : 0;
    });
  }
  return out;
}
