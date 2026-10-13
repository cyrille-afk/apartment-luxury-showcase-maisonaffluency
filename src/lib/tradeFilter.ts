/**
 * Combined Trade Gallery filter.
 *
 * All active filters narrow together (AND): designer/brand, category,
 * subcategory, collection/edition, and the free-text search. A piece must
 * satisfy every active filter to stay in the grid. "all" / empty values
 * deactivate a filter.
 */
import type { TradeProduct } from "@/lib/tradeProducts";
import { searchMatches } from "@/lib/tradeSearch";

export interface TradeFilterCriteria {
  /** Free-text search (designer, title, collection, materials…). */
  search?: string;
  /** Brand/designer name, or "all". A piece also matches via reedition_by. */
  brand?: string | null;
  category?: string;
  subcategory?: string;
  /** Collection or edition label, or "all". */
  edition?: string;
}

export function filterTradeProducts(
  products: TradeProduct[],
  criteria: TradeFilterCriteria,
): TradeProduct[] {
  const { search = "", brand, category = "all", subcategory = "all", edition = "all" } = criteria;
  const activeBrand = brand && brand !== "all" ? brand : null;
  return products.filter((p) => {
    if (!searchMatches(p, search)) return false;
    if (activeBrand && p.brand_name !== activeBrand && p.reedition_by !== activeBrand) return false;
    if (category !== "all" && p.category !== category) return false;
    if (subcategory !== "all" && p.subcategory !== subcategory) return false;
    if (edition !== "all" && (p.edition || "").trim() !== edition) return false;
    return true;
  });
}

export interface TradeCollectionCounts {
  /** Pieces matching every active filter except the collection itself. */
  total: number;
  /** Pieces per collection label, keyed by the lower-cased label. */
  byCollection: Map<string, number>;
}

/**
 * How many pieces each collection holds alongside the other active filters.
 *
 * The collection filter itself is ignored, so the number beside a collection is
 * exactly what picking it would show — including when another filter (designer,
 * category, search) narrows the grid.
 */
export function countTradeCollectionPieces(
  products: TradeProduct[],
  criteria: TradeFilterCriteria,
): TradeCollectionCounts {
  const matching = filterTradeProducts(products, { ...criteria, edition: "all" });
  const byCollection = new Map<string, number>();
  for (const p of matching) {
    const ed = (p.edition || "").trim();
    if (!ed) continue;
    const key = ed.toLowerCase();
    byCollection.set(key, (byCollection.get(key) ?? 0) + 1);
  }
  return { total: matching.length, byCollection };
}
