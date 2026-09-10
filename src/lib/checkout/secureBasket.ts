/**
 * Durable persistence for the checkout basket ("secure basket").
 *
 * The checkout page used to keep its lines only in sessionStorage + local
 * component state, so closing the funnel, restoring a tab or an overlay
 * teardown could evict the basket. Every write now mirrors into localStorage
 * under `ma_secure_basket`, and reads fall back to that mirror. The basket is
 * only destroyed on a finalised transaction (`clearSecureBasket("order")`).
 */

const SESSION_KEY = "ma_checkout_line";
const DURABLE_KEY = "ma_secure_basket";
const ORDER_PLACED_KEY = "ma_secure_basket_order_placed";

function parse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as T[];
    return parsed ? [parsed as T] : [];
  } catch {
    return [];
  }
}

/** Read the persisted basket: session first, durable localStorage mirror second. */
export function readSecureBasket<T>(isValid: (l: unknown) => l is T): T[] {
  if (typeof window === "undefined") return [];
  let out: T[] = [];
  try {
    out = parse<unknown>(window.sessionStorage.getItem(SESSION_KEY)).filter(isValid);
  } catch {
    /* private mode */
  }
  if (out.length) return out;
  try {
    if (window.localStorage.getItem(ORDER_PLACED_KEY) === "1") return [];
    out = parse<unknown>(window.localStorage.getItem(DURABLE_KEY)).filter(isValid);
  } catch {
    /* private mode */
  }
  return out;
}

/** Write the basket to both session and durable storage. */
export function writeSecureBasket<T>(lines: T[]) {
  if (typeof window === "undefined" || !lines.length) return;
  const payload = JSON.stringify(lines);
  try {
    window.sessionStorage.setItem(SESSION_KEY, payload);
  } catch {
    /* private mode */
  }
  try {
    window.localStorage.setItem(DURABLE_KEY, payload);
    window.localStorage.removeItem(ORDER_PLACED_KEY);
  } catch {
    /* quota / private mode */
  }
}

/**
 * Empties the persisted checkout basket. Only `reason: "order"` — a finalised
 * transaction — removes the durable mirror; anything else stays recoverable.
 */
export function clearSecureBasket(reason: "order" | "manual" = "order") {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode */
  }
  if (reason !== "order") return;
  try {
    window.localStorage.removeItem(DURABLE_KEY);
    window.localStorage.setItem(ORDER_PLACED_KEY, "1");
  } catch {
    /* private mode */
  }
}
