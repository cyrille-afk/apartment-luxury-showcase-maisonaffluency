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
  imageUrl: string | null;
  leadTime: string | null;
  unitPriceCents: number;
  currency: string;
  quantity: number;
}

const STORAGE_KEY = "ma_cart_v1";

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

function commit(next: CartItem[]) {
  items = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — cart stays in memory */
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      items = read();
      listeners.forEach((l) => l());
    }
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

export function clearCart() {
  commit([]);
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
