import type { TradeProduct } from "./tradeProducts";

export const COMPARISON_COVER_FIELDS = ["projectName", "comparisonName", "clientName", "location", "style", "layout", "designerNotes", "originalPrices"] as const;
export type ComparisonCoverEdits = Partial<Record<typeof COMPARISON_COVER_FIELDS[number], string>>;

export interface ComparatorDraft {
  compareList: TradeProduct[];
  search: string;
  letter: string;
  source: "catalogue" | "favorites";
  openDesigners: string[];
  shortlistName: string;
  coverEdits: Record<string, ComparisonCoverEdits>;
  /** Designer notes per compared piece, keyed by product id. */
  pieceNotes: Record<string, string>;
}

export function emptyComparatorDraft(): ComparatorDraft {
  return { compareList: [], search: "", letter: "", source: "catalogue", openDesigners: [], shortlistName: "", coverEdits: {}, pieceNotes: {} };
}

// Explicitly exclude prices and account data, including from restored snapshots.
export function sanitizeComparatorDraft(value: unknown): ComparatorDraft {
  const draft = emptyComparatorDraft();
  if (!value || typeof value !== "object") return draft;
  const row = value as Record<string, unknown>;
  if (row.coverEdits && typeof row.coverEdits === "object") {
    for (const [scope, value] of Object.entries(row.coverEdits)) {
      if (scope !== "unassigned" && !/^[a-f0-9-]{36}$/i.test(scope)) continue;
      if (!value || typeof value !== "object") continue;
      const fields = value as Record<string, unknown>;
      const edits: ComparisonCoverEdits = {};
      for (const key of COMPARISON_COVER_FIELDS) {
        if (typeof fields[key] === "string") edits[key] = fields[key].slice(0, key === "designerNotes" ? 2000 : 500);
      }
      draft.coverEdits[scope] = edits;
    }
  }
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
      if (typeof item.designer_notes === "string" && item.designer_notes.trim()) draft.pieceNotes[item.id] = item.designer_notes.slice(0, 1000);
      if (draft.compareList.length === 4) break;
    }
  }
  if (row.pieceNotes && typeof row.pieceNotes === "object") {
    for (const [id, note] of Object.entries(row.pieceNotes)) {
      if (typeof note === "string" && note.trim() && draft.compareList.some(p => p.id === id)) draft.pieceNotes[id] = note.slice(0, 1000);
    }
  }
  return draft;
}

export function comparatorDraftKey(userId: string, shortlistId: string | null): string {
  return `ma-comparator-draft-v1:${userId}:${shortlistId || "working"}`;
}

export function restoreSavedComparison(items: unknown, name: string, available: TradeProduct[]): ComparatorDraft {
  const snapshot = sanitizeComparatorDraft({ compareList: items, shortlistName: name });
  return { ...snapshot, compareList: snapshot.compareList.map(saved => available.find(product => product.id === saved.id || product.trade_product_id === saved.id) ?? saved) };
}