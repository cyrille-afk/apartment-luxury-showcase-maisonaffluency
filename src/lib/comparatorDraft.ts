import type { TradeProduct } from "./tradeProducts";

export interface ComparatorDraft {
  compareList: TradeProduct[];
  search: string;
  letter: string;
  source: "catalogue" | "favorites";
  openDesigners: string[];
  shortlistName: string;
}

export function emptyComparatorDraft(): ComparatorDraft {
  return { compareList: [], search: "", letter: "", source: "catalogue", openDesigners: [], shortlistName: "" };
}

// Explicitly exclude prices and account data, including from restored snapshots.
export function sanitizeComparatorDraft(value: unknown): ComparatorDraft {
  const draft = emptyComparatorDraft();
  if (!value || typeof value !== "object") return draft;
  const row = value as Record<string, unknown>;
  for (const key of ["search", "letter", "shortlistName"] as const) {
    if (typeof row[key] === "string") draft[key] = row[key];
  }
  if (row.source === "favorites") draft.source = "favorites";
  if (Array.isArray(row.openDesigners)) draft.openDesigners = row.openDesigners.filter((item): item is string => typeof item === "string");
  if (Array.isArray(row.compareList)) {
    const seen = new Set<string>();
    for (const item of row.compareList) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || typeof item.product_name !== "string" || seen.has(item.id)) continue;
      seen.add(item.id);
      const product: TradeProduct = { id: item.id, product_name: item.product_name, brand_name: typeof item.brand_name === "string" ? item.brand_name : "", category: typeof item.category === "string" ? item.category : "", tags: [], image_url: typeof item.image_url === "string" ? item.image_url : null };
      for (const key of ["trade_product_id", "subtitle", "dimensions", "materials", "lead_time"] as const) {
        if (typeof item[key] === "string") product[key] = item[key];
      }
      draft.compareList.push(product);
      if (draft.compareList.length === 4) break;
    }
  }
  return draft;
}

export function comparatorDraftKey(userId: string, shortlistId: string | null): string {
  return `ma-comparator-draft-v1:${userId}:${shortlistId || "working"}`;
}