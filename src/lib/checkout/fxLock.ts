/**
 * Checkout exchange-rate lock.
 *
 * Catalogue prices are stored in their native currency (EUR, USD…) and shown
 * to the shopper in the settlement currency picked in the header modal. Before
 * this lock, every render re-converted at whatever rate the cache happened to
 * hold, so the same basket could show two different pound totals an hour
 * apart, and the figure the buyer agreed to was never the figure they paid.
 *
 * The rule now: the first time a basket is priced in a given settlement
 * currency, the rates used are written to sessionStorage and reused for the
 * whole checkout session (30 minutes). The quote path already locks FX this
 * way (`exchange_rate_at_creation`); the direct cart path now matches it.
 */

export const CART_FX_LOCK_TTL_MS = 30 * 60 * 1000;

const STORAGE_KEY = "ma_checkout_fx_lock_v1";

export interface CartFxLock {
  /** Settlement currency every line was converted into. */
  base: string;
  /** Sorted, comma-joined source currencies the lock covers. */
  pairs: string;
  /** `SRC` → units of `base` per 1 unit of `SRC`. */
  rates: Record<string, number>;
  /** ISO timestamp the rates were locked at. */
  lockedAt: string;
  /** Epoch ms after which the lock must be refreshed. */
  expiresAt: number;
}

const store = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

const valid = (lock: CartFxLock | null, base: string, pairs: string, now: number) =>
  Boolean(
    lock &&
      lock.base === base &&
      lock.pairs === pairs &&
      lock.expiresAt > now &&
      lock.rates &&
      Object.values(lock.rates).every((r) => Number.isFinite(r) && r > 0),
  );

/** Returns the live lock for this base/pair set, or null when none applies. */
export function readFxLock(
  base: string,
  pairs: string,
  now: number = Date.now(),
): CartFxLock | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    const lock = JSON.parse(raw) as CartFxLock;
    return valid(lock, base, pairs, now) ? lock : null;
  } catch {
    return null;
  }
}

/** Locks the supplied rates for the session and returns the stored record. */
export function writeFxLock(
  base: string,
  pairs: string,
  rates: Record<string, number>,
  now: number = Date.now(),
): CartFxLock {
  const lock: CartFxLock = {
    base,
    pairs,
    rates: { ...rates },
    lockedAt: new Date(now).toISOString(),
    expiresAt: now + CART_FX_LOCK_TTL_MS,
  };
  const s = store();
  try {
    s?.setItem(STORAGE_KEY, JSON.stringify(lock));
  } catch {
    /* private browsing — the lock simply lives for this render session */
  }
  return lock;
}

/** Drops the lock so the next pricing pass fetches fresh rates. */
export function clearFxLock(): void {
  try {
    store()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Whole minutes left on a lock, floored at 0. */
export function fxLockMinutesLeft(
  lock: Pick<CartFxLock, "expiresAt"> | null,
  now: number = Date.now(),
): number {
  if (!lock) return 0;
  return Math.max(0, Math.ceil((lock.expiresAt - now) / 60_000));
}
