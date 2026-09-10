import { useSyncExternalStore } from "react";

export interface CartItem {
  /** Stable line key — pick id + finish label. */
  key: string;
  pickId: string;
  productSlug: string;
  designerSlug: string;
  title: string;
  designerName: string;
  finishLabel: string | null;
  /** Structured variant axes (base × top × size) used to re-price server-side. */
  variant?: { base: string | null; top: string | null; size: string | null } | null;
  imageUrl: string | null;
  leadTime: string | null;
  unitPriceCents: number;
  currency: string;
  quantity: number;
  /** Original catalogue currency when the line was converted for display. */
  sourceCurrency?: string | null;
  /** Unit price in the original catalogue currency (pre-conversion). */
  sourceUnitPriceCents?: number | null;
  /** FX rate applied: 1 sourceCurrency = fxRate currency. */
  fxRate?: number | null;
  /** Freight class hints — drive the shipping estimate multiplier. */
  category?: string | null;
  shippingModifier?: number | null;
  /** Product provenance / pickup location — used for regional logistics copy. */
  origin?: string | null;
  pickupCountry?: string | null;
}

const STORAGE_KEY = "ma_cart_v1";
/** Durable mirror of the last non-empty basket — survives accidental wipes. */
const BACKUP_KEY = "ma_cart_v1_backup";
/** Set once an order is actually placed, so a purchased basket never returns. */
const ORDER_PLACED_KEY = "ma_cart_order_placed";

let items: CartItem[] = read();
const listeners = new Set<() => void>();

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readBackup(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function commit(next: CartItem[]) {
  items = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (next.length) {
      window.localStorage.setItem(BACKUP_KEY, JSON.stringify(next));
      window.localStorage.removeItem(ORDER_PLACED_KEY);
    }
  } catch {
    /* quota / private mode — cart stays in memory */
  }
  listeners.forEach((l) => l());
}

/**
 * Re-syncs the in-memory basket with persistent storage.
 * If storage was wiped (navigation, overlay teardown, another tab) while the
 * basket is still live, the in-memory copy — or the durable backup — is
 * written back so items are never silently evicted.
 */
export function rehydrateCart() {
  if (typeof window === "undefined") return;
  const stored = read();
  if (stored.length) {
    if (JSON.stringify(stored) !== JSON.stringify(items)) {
      items = stored;
      listeners.forEach((l) => l());
    }
    return;
  }
  let orderPlaced = false;
  try {
    orderPlaced = window.localStorage.getItem(ORDER_PLACED_KEY) === "1";
  } catch {
    /* ignore */
  }
  if (orderPlaced) return;
  const recovery = items.length ? items : readBackup();
  if (recovery.length) commit(recovery);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      items = read();
      listeners.forEach((l) => l());
    }
  });
  // Returning from a modal, a back/forward navigation or a restored tab must
  // never surface an empty basket.
  window.addEventListener("pageshow", rehydrateCart);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") rehydrateCart();
  });
}

export function lineKey(pickId: string, finishLabel: string | null) {
  return `${pickId}::${(finishLabel || "").trim().toLowerCase()}`;
}

export function getCart() {
  return items;
}

export function addToCart(item: Omit<CartItem, "key" | "quantity"> & { quantity?: number }) {
  const key = lineKey(item.pickId, item.finishLabel ?? null);
  const qty = Math.max(1, item.quantity ?? 1);
  const existing = items.find((i) => i.key === key);
  if (existing) {
    commit(items.map((i) => (i.key === key ? { ...i, quantity: i.quantity + qty } : i)));
  } else {
    commit([...items, { ...item, finishLabel: item.finishLabel ?? null, key, quantity: qty }]);
  }
  return key;
}

export function setQuantity(key: string, quantity: number) {
  if (quantity <= 0) return removeFromCart(key);
  commit(items.map((i) => (i.key === key ? { ...i, quantity } : i)));
}

export function removeFromCart(key: string) {
  commit(items.filter((i) => i.key !== key));
}

/**
 * Empties the basket. Only an actual order (`reason: "order"`) marks the
 * basket as purchased; any other clear can still be recovered on rehydrate.
 */
export function clearCart(reason: "order" | "manual" = "order") {
  try {
    if (reason === "order") {
      window.localStorage.setItem(ORDER_PLACED_KEY, "1");
      window.localStorage.removeItem(BACKUP_KEY);
    }
  } catch {
    /* ignore */
  }
  commit([]);
}


/**
 * Re-price converted lines against fresh FX rates. Lines store the rate
 * captured at add-to-cart time, which can be the offline fallback — this
 * re-derives unitPriceCents/fxRate from the source price so the cart and
 * checkout always reflect the current live rate. No-op for unconverted lines.
 */
export async function refreshCartFx() {
  const stale = items.filter(
    (i) => i.sourceCurrency && i.sourceUnitPriceCents && i.sourceCurrency !== i.currency,
  );
  if (stale.length === 0) return;
  const { getFxRate } = await import("@/lib/fxRates");
  let changed = false;
  const next = await Promise.all(
    items.map(async (i) => {
      if (!i.sourceCurrency || !i.sourceUnitPriceCents || i.sourceCurrency === i.currency) return i;
      const rate = await getFxRate(i.sourceCurrency, i.currency);
      const unitPriceCents = Math.round(i.sourceUnitPriceCents * rate);
      if (unitPriceCents === i.unitPriceCents && i.fxRate === rate) return i;
      changed = true;
      return { ...i, unitPriceCents, fxRate: rate };
    }),
  );
  if (changed) commit(next);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCart() {
  return useSyncExternalStore(subscribe, getCart, () => [] as CartItem[]);
}

export function cartSubtotalCents(list: CartItem[]) {
  return list.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
}

/** Front-door delivery estimate — 15% of goods value, confirmed by the concierge. */
export const SHIPPING_RATE = 0.15;

export function cartShippingCents(subtotal: number) {
  return subtotal > 0 ? Math.round(subtotal * SHIPPING_RATE) : 0;
}

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", SGD: "S$", HKD: "HK$" };

export function formatMoney(cents: number, currency = "USD") {
  const code = (currency || "USD").toUpperCase();
  const symbol = SYMBOLS[code] || "";
  const amount = Math.round(cents / 100).toLocaleString("en-US");
  return symbol ? `${symbol}${amount}` : `${amount} ${code}`;
}

/**
 * Display-routing rule (price-agnostic): a cart holding a single unique line
 * stays in the sliding drawer; once a 2nd unique line is added, it routes to
 * the dedicated full-page cart (/cart). Quantity on one line never routes.
 */
export const FULL_PAGE_CART_MIN_ITEMS = 2;

export function cartItemCount(list: CartItem[] = getCart()) {
  return list.reduce((sum, i) => sum + (i.quantity || 1), 0);
}

export function shouldUseFullPageCart(list: CartItem[] = getCart()) {
  return list.length >= FULL_PAGE_CART_MIN_ITEMS;
}
