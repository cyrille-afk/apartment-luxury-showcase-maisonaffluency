import { useSyncExternalStore } from "react";
import { SHIPPING_COUNTRIES } from "@/lib/shippingDestination";

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

type CartRegionMeta = {
  countryIso: string;
  countryName: string;
  currency: string;
  /** True when the shopper explicitly chose this destination. */
  manual?: boolean;
};

type CartEnvelope = {
  v: 1;
  lines: CartItem[];
  region?: CartRegionMeta;
  savedAt: number;
};

const STORAGE_KEY = "ma_cart_v1";
/** Durable mirror of the last non-empty basket — survives accidental wipes. */
const BACKUP_KEY = "ma_cart_v1_backup";
/** Set once an order is actually placed, so a purchased basket never returns. */
const ORDER_PLACED_KEY = "ma_cart_order_placed";

// Mirrors keys in src/lib/shippingDestination.ts so the basket record carries
// the active destination / settlement currency (e.g. Switzerland → CHF) and can
// re-arm the header flag if it ever drifts.
const REGION_COUNTRY_KEY = "trade.detectedCountry";
const REGION_CURRENCY_KEY = "trade.displayCurrency";
const REGION_MANUAL_KEY = "trade.shippingDestination.manual";
const DEST_EVENT = "trade-shipping-destination-change";
const CURRENCY_EVENT = "trade-display-currency-change";

function countryNameFromIso(iso: string): string {
  return SHIPPING_COUNTRIES.find((c) => c.iso === iso.toUpperCase())?.name || iso.toUpperCase();
}

function captureRegion(): CartRegionMeta | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const iso = window.localStorage.getItem(REGION_COUNTRY_KEY);
    const currency = window.localStorage.getItem(REGION_CURRENCY_KEY);
    if (!iso || !currency) return undefined;
    return {
      countryIso: iso.toUpperCase(),
      countryName: countryNameFromIso(iso),
      currency: currency.toUpperCase(),
      manual: window.localStorage.getItem(REGION_MANUAL_KEY) === "1",
    };
  } catch {
    return undefined;
  }
}

function restoreRegion(region: CartRegionMeta | undefined) {
  if (!region || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REGION_COUNTRY_KEY, region.countryIso);
    window.localStorage.setItem(REGION_CURRENCY_KEY, region.currency);
    if (region.manual) window.localStorage.setItem(REGION_MANUAL_KEY, "1");
    else window.localStorage.removeItem(REGION_MANUAL_KEY);
    window.dispatchEvent(new CustomEvent(DEST_EVENT, { detail: region }));
    window.dispatchEvent(new CustomEvent(CURRENCY_EVENT, { detail: region.currency }));
  } catch {
    /* private mode — region will still ride with the basket envelope */
  }
}

function parseEnvelope(raw: string | null): CartEnvelope | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    // New envelope shape: { v: 1, lines: [...], region?: {...} }
    if (Array.isArray(parsed.lines)) {
      return parsed as CartEnvelope;
    }
    // Legacy flat array persisted before the envelope existed.
    if (Array.isArray(parsed)) {
      return { v: 1, lines: parsed, savedAt: Date.now() };
    }
  } catch {
    /* corrupted — fall through to empty */
  }
  return null;
}

function parseRawLines(raw: string | null): CartItem[] {
  return parseEnvelope(raw)?.lines ?? [];
}

function readRegion(raw: string | null): CartRegionMeta | undefined {
  return parseEnvelope(raw)?.region;
}

function readPrimary(): CartItem[] {
  if (typeof window === "undefined") return [];
  return parseRawLines(window.localStorage.getItem(STORAGE_KEY));
}

function readBackup(): CartItem[] {
  if (typeof window === "undefined") return [];
  return parseRawLines(window.localStorage.getItem(BACKUP_KEY));
}

function readRegionFromStorage(): CartRegionMeta | undefined {
  if (typeof window === "undefined") return undefined;
  return readRegion(window.localStorage.getItem(STORAGE_KEY));
}

function readRegionFromBackup(): CartRegionMeta | undefined {
  if (typeof window === "undefined") return undefined;
  return readRegion(window.localStorage.getItem(BACKUP_KEY));
}

function orderPlaced(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ORDER_PLACED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Hydrate from durable storage on module load — never start empty blindly. */
function hydrate(): CartItem[] {
  if (typeof window === "undefined") return [];
  if (orderPlaced()) return [];
  const primary = readPrimary();
  if (primary.length) return primary;
  return readBackup();
}

let items: CartItem[] = hydrate();
const listeners = new Set<() => void>();

function writeEnvelope(next: CartItem[], region?: CartRegionMeta) {
  const envelope: CartEnvelope = { v: 1, lines: next, region, savedAt: Date.now() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    if (next.length) {
      window.localStorage.setItem(BACKUP_KEY, JSON.stringify(envelope));
      window.localStorage.removeItem(ORDER_PLACED_KEY);
    }
  } catch {
    /* quota / private mode — cart stays in memory */
  }
}

function commit(next: CartItem[]) {
  items = next;
  writeEnvelope(next, captureRegion());
  listeners.forEach((l) => l());
}

function commitWithRegion(next: CartItem[], region: CartRegionMeta | undefined) {
  items = next;
  writeEnvelope(next, region ?? captureRegion());
  listeners.forEach((l) => l());
  restoreRegion(region);
}

/**
 * Re-syncs the in-memory basket with persistent storage.
 *
 * If storage was wiped (navigation, overlay teardown, another tab) while the
 * basket is still live, the in-memory copy — or the durable backup — is
 * written back so items are never silently evicted. The destination / currency
 * recorded with the basket is also restored so Switzerland/CHF (or any locked
 * region) survives the full browsing lifecycle.
 *
 * Only an explicit order-completed marker prevents recovery.
 */
export function rehydrateCart() {
  if (typeof window === "undefined") return;

  if (orderPlaced()) {
    if (items.length) {
      items = [];
      listeners.forEach((l) => l());
    }
    return;
  }

  const stored = readPrimary();
  if (stored.length) {
    if (JSON.stringify(stored) !== JSON.stringify(items)) {
      items = stored;
      listeners.forEach((l) => l());
    }
    restoreRegion(readRegionFromStorage());
    return;
  }

  // Primary cache is empty. Prefer the live in-memory basket (it may have
  // arrived from a just-completed add-to-cart before the storage event fired),
  // then fall back to the durable mirror. Either way, write the canonical copy
  // back to primary storage so the next render is never empty.
  const recovery = items.length ? items : readBackup();
  if (recovery.length) {
    items = recovery;
    // Preserve the region recorded with the backup; only fall back to the
    // currently selected region if no basket metadata exists yet.
    const region = readRegionFromBackup() ?? readRegionFromStorage() ?? captureRegion();
    commitWithRegion(recovery, region);
  }
}

if (typeof window !== "undefined") {
  // Cross-tab / bfcache restore: do not blindly adopt an empty primary write
  // from another tab unless the order-completed marker proves finalization.
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      if (orderPlaced()) {
        if (items.length) {
          items = [];
          listeners.forEach((l) => l());
        }
        return;
      }
      const stored = parseRawLines(e.newValue);
      if (stored.length) {
        items = stored;
        listeners.forEach((l) => l());
        restoreRegion(readRegion(e.newValue));
      } else {
        rehydrateCart();
      }
    }
  });

  // Returning from a modal, a back/forward navigation or a restored tab must
  // never surface an empty basket.
  window.addEventListener("pageshow", rehydrateCart);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") rehydrateCart();
  });

  // If the basket was rehydrated from the durable backup on module load,
  // re-arm the global destination / currency selector from the basket metadata.
  if (!readPrimary().length && items.length && !orderPlaced()) {
    restoreRegion(readRegionFromBackup());
  }
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
 * basket as purchased and removes the durable backup; any other clear can still
 * be recovered on rehydrate.
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
