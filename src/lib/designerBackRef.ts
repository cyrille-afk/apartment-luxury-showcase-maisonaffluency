/**
 * Tracks "back to product" navigation context for designer profiles
 * without polluting the URL with a `from_product` query string.
 *
 * Usage:
 *  - On a product page link to a designer profile, call
 *    `rememberProductBackRef(currentPathWithSearch)` in the click handler
 *    (or pass it as <Link state>).
 *  - On the designer profile, read with `consumeProductBackRef(slug)`.
 *
 * Falls back gracefully when sessionStorage is unavailable.
 */

const KEY = "designer_back_ref_v1";

interface BackRef {
  /** Designer slug the user is navigating to */
  slug: string;
  /** Path + search string to navigate back to */
  path: string;
  /** ms epoch — entries older than 30min are ignored */
  ts: number;
}

const TTL_MS = 30 * 60 * 1000;

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function rememberProductBackRef(slug: string, path: string) {
  const s = safeStorage();
  if (!s) return;
  try {
    const ref: BackRef = { slug, path, ts: Date.now() };
    s.setItem(KEY, JSON.stringify(ref));
  } catch {
    /* ignore */
  }
}

/**
 * Read (and clear) the saved back-ref if it matches the given designer slug
 * and is still fresh. Returns null otherwise.
 */
export function consumeProductBackRef(slug: string | undefined): string | null {
  if (!slug) return null;
  const s = safeStorage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const ref = JSON.parse(raw) as BackRef;
    if (!ref || ref.slug !== slug) return null;
    if (Date.now() - ref.ts > TTL_MS) {
      s.removeItem(KEY);
      return null;
    }
    return ref.path;
  } catch {
    return null;
  }
}

export function clearProductBackRef() {
  const s = safeStorage();
  if (!s) return;
  try {
    s.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
