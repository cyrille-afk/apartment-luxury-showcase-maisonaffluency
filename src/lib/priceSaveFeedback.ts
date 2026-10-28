export type PriceSaveState = { revision: number; status: "unsaved" | "saving" | "saved" | "failed"; confirmedAt?: string };
export function completePriceSave(current: PriceSaveState, revision: number, confirmed: boolean, timestamp: string): PriceSaveState {
  if (current.revision !== revision) return current;
  return { revision, status: confirmed ? "saved" : "failed", ...(confirmed ? { confirmedAt: timestamp } : {}) };
}
export const PRICE_EDITOR_FIELDS = new Set(["trade_price_cents", "price_per_sqm_cents", "size_variants", "currency", "price_prefix"]);