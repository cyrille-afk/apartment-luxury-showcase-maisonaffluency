import { useCallback, useEffect, useState } from "react";
import type { TradeProduct } from "@/lib/tradeProducts";

/**
 * Dev-only helper: tracks a localStorage-persisted set of TradeProduct IDs
 * that should be hidden from the Trade grid. Used by the duplicate-products
 * banner so a developer can quickly suppress unwanted near-duplicate cards.
 *
 * Storage key: `dev:hiddenTradeProductIds` (JSON array of strings).
 * In production builds the hook is inert (always returns an empty set and
 * a no-op `hide`).
 */
const STORAGE_KEY = "dev:hiddenTradeProductIds";
const EVENT_NAME = "dev:hiddenTradeProductIds:change";

const normalizeForHideKey = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export function getTradeProductHideKey(
  product: Pick<TradeProduct, "brand_name" | "product_name">
) {
  return `product:${normalizeForHideKey(product.brand_name)}::${normalizeForHideKey(product.product_name)}`;
}

function readIds(): Set<string> {
  if (!import.meta.env.DEV) return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore quota errors */
  }
  // Fan out to all hook instances in the same tab.
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function useHiddenTradeProductIds() {
  const [ids, setIds] = useState<Set<string>>(() => readIds());

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const sync = () => setIds(readIds());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const hide = useCallback((id: string) => {
    if (!import.meta.env.DEV) return;
    const next = new Set(readIds());
    next.add(id);
    writeIds(next);
  }, []);

  const unhide = useCallback((id: string) => {
    if (!import.meta.env.DEV) return;
    const next = new Set(readIds());
    next.delete(id);
    writeIds(next);
  }, []);

  const clear = useCallback(() => {
    if (!import.meta.env.DEV) return;
    writeIds(new Set());
  }, []);

  return { ids, hide, unhide, clear };
}
