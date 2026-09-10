import { SHIPPING_COUNTRIES } from "@/lib/shippingDestination";

/** Generic line type consumed by the checkout flow (cart lines or single direct-buy lines). */
export type SecureBasketLine = Record<string, unknown> & { __brand?: never };

type SecureBasketRegion = {
  countryIso: string;
  countryName: string;
  currency: string;
  manual?: boolean;
};

type SecureBasketEnvelope = {
  v: 1;
  lines: unknown[];
  region?: SecureBasketRegion;
  savedAt: number;
};

/** Session-scoped cache used during a single funnel session. */
const SESSION_KEY = "ma_checkout_line";
/** Durable cache that survives tab close / browser restart until an order is placed. */
const DURABLE_KEY = "ma_secure_basket";
/** Set to 1 once an order is finalized, preventing stale baskets from returning. */
const ORDER_PLACED_KEY = "ma_secure_basket_order_placed";

// Mirrors keys in src/lib/shippingDestination.ts so the secure checkout basket
// carries the locked destination / settlement currency and can re-arm the
// header selector when the funnel is reopened.
const REGION_COUNTRY_KEY = "trade.detectedCountry";
const REGION_CURRENCY_KEY = "trade.displayCurrency";
const REGION_MANUAL_KEY = "trade.shippingDestination.manual";
const DEST_EVENT = "trade-shipping-destination-change";
const CURRENCY_EVENT = "trade-display-currency-change";

function countryNameFromIso(iso: string): string {
  return SHIPPING_COUNTRIES.find((c) => c.iso === iso.toUpperCase())?.name || iso.toUpperCase();
}

function captureRegion(): SecureBasketRegion | undefined {
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

function restoreRegion(region: SecureBasketRegion | undefined) {
  if (!region || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REGION_COUNTRY_KEY, region.countryIso);
    window.localStorage.setItem(REGION_CURRENCY_KEY, region.currency);
    if (region.manual) window.localStorage.setItem(REGION_MANUAL_KEY, "1");
    else window.localStorage.removeItem(REGION_MANUAL_KEY);
    window.dispatchEvent(new CustomEvent(DEST_EVENT, { detail: region }));
    window.dispatchEvent(new CustomEvent(CURRENCY_EVENT, { detail: region.currency }));
  } catch {
    /* ignore */
  }
}

function parse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    // New envelope shape.
    if (Array.isArray(parsed.lines)) {
      return parsed.lines;
    }
    // Legacy shape: a single line object written by product pages via sessionStorage.
    if (!Array.isArray(parsed)) {
      return [parsed];
    }
    // Legacy shape: a flat array of lines.
    return parsed;
  } catch {
    return null;
  }
}

function parseEnvelopeRegion(raw: string | null): SecureBasketRegion | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.lines)) {
      return parsed.region;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function orderPlaced(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ORDER_PLACED_KEY) === "1";
  } catch {
    return false;
  }
}

function markOrderPlaced() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORDER_PLACED_KEY, "1");
    window.localStorage.removeItem(DURABLE_KEY);
  } catch {
    /* ignore */
  }
}

function readSessionLines(): unknown[] {
  if (typeof window === "undefined") return [];
  const parsed = parse(window.sessionStorage.getItem(SESSION_KEY));
  return Array.isArray(parsed) ? parsed : [];
}

function readDurableLines(): unknown[] {
  if (typeof window === "undefined") return [];
  const parsed = parse(window.localStorage.getItem(DURABLE_KEY));
  return Array.isArray(parsed) ? parsed : [];
}

function readDurableRegion(): SecureBasketRegion | undefined {
  if (typeof window === "undefined") return undefined;
  return parseEnvelopeRegion(window.localStorage.getItem(DURABLE_KEY));
}

function writeSession(lines: unknown[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(wrap(lines)));
  } catch {
    /* ignore */
  }
}

function writeDurable(lines: unknown[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DURABLE_KEY, JSON.stringify(wrap(lines)));
  } catch {
    /* ignore */
  }
}

function wrap(lines: unknown[]): SecureBasketEnvelope {
  return { v: 1, lines, region: captureRegion(), savedAt: Date.now() };
}

/**
 * Lazily hydrate the secure checkout basket. Session cache wins; otherwise fall
 * back to the durable localStorage mirror. Returns filtered, valid lines and
 * re-arms the active destination / currency from the recorded basket metadata.
 */
export function readSecureBasket<T>(isValid: (l: unknown) => l is T): T[] {
  if (typeof window === "undefined") return [];
  if (orderPlaced()) return [];

  const session = readSessionLines();
  if (session.length) {
    const filtered = session.filter(isValid);
    restoreRegion(parseEnvelopeRegion(window.sessionStorage.getItem(SESSION_KEY)));
    return filtered;
  }

  const durable = readDurableLines();
  if (durable.length) {
    const filtered = durable.filter(isValid);
    restoreRegion(readDurableRegion());
    return filtered;
  }

  return [];
}

/**
 * Persist genuine checkout lines to both session and durable caches.
 * Empty payloads are ignored so an un-hydrated render can never overwrite a
 * populated basket with an empty array.
 */
export function writeSecureBasket<T>(lines: T[]) {
  if (typeof window === "undefined" || !lines.length) return;
  const payload = lines as unknown[];
  writeSession(payload);
  writeDurable(payload);
}

/**
 * Authoritative write used after a deliberate basket mutation (line removal,
 * quantity change). Unlike `writeSecureBasket` this accepts an empty array and
 * genuinely clears both caches, so a removed line can never be revived from a
 * stale mirror when the checkout page re-hydrates.
 */
export function overwriteSecureBasket<T>(lines: T[]) {
  if (typeof window === "undefined") return;
  const payload = lines as unknown[];
  if (!payload.length) {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(DURABLE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  writeSession(payload);
  writeDurable(payload);
}

/**
 * Cross-tab / cross-modal re-sync hook (Safari in particular restores tabs
 * without firing focus). Calls back whenever another context mutates the
 * durable basket or marks an order as placed.
 */
export function subscribeSecureBasketStorage(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key === DURABLE_KEY || e.key === ORDER_PLACED_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/**
 * Empties the secure checkout basket. Only an actual order (`reason: "order"`)
 * marks the basket as purchased and wipes the durable mirror.
 */
export function clearSecureBasket(reason: "order" | "manual" = "order") {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
    if (reason === "order") markOrderPlaced();
  } catch {
    /* ignore */
  }
}
