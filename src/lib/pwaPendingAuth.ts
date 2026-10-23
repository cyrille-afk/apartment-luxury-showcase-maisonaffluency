/**
 * Cross-context handoff for the desktop → mobile QR sign-in.
 *
 * The QR code carries a one-time, 2-minute token to /auth/sync on the phone.
 * The mobile browser must NOT redeem it there: it stores the raw token under
 * PENDING_AUTH_STORAGE_KEY and shows the static "Add to Home Screen" bridge.
 * When the installed PWA launches (standalone display mode), it reads the
 * pending token, redeems it exactly once, and signs in — so the session the
 * desktop user had follows them into the app container.
 *
 * Note: Android Chrome shares storage between the browser and the installed
 * PWA, so the token carries over. iOS keeps Safari and Home Screen storage
 * separate; there the bridge page simply never consumes the token, leaving
 * "Continue in browser" as the working path.
 */

export const PENDING_AUTH_STORAGE_KEY = "ma_pwa_pending_auth_token";

export interface PendingAuthToken {
  token: string;
  /** Epoch milliseconds after which the token is useless (matches server TTL). */
  expiresAt: number;
}

export function serializePendingAuth(entry: PendingAuthToken): string {
  return JSON.stringify(entry);
}

/** Parses a stored payload; returns null for anything malformed. */
export function parsePendingAuth(raw: string | null, now = Date.now()): PendingAuthToken | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingAuthToken>;
    if (typeof parsed.token !== "string" || parsed.token.length < 20) return null;
    if (typeof parsed.expiresAt !== "number" || !Number.isFinite(parsed.expiresAt)) return null;
    if (parsed.expiresAt <= now) return null;
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export function storePendingAuthToken(token: string, ttlSeconds: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PENDING_AUTH_STORAGE_KEY,
      serializePendingAuth({ token, expiresAt: Date.now() + ttlSeconds * 1000 }),
    );
  } catch {
    /* storage unavailable — the in-browser fallback still works */
  }
}

/** Returns the pending token if present and unexpired; clears stale entries. */
export function readPendingAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const entry = parsePendingAuth(window.localStorage.getItem(PENDING_AUTH_STORAGE_KEY));
    if (!entry) {
      window.localStorage.removeItem(PENDING_AUTH_STORAGE_KEY);
      return null;
    }
    return entry.token;
  } catch {
    return null;
  }
}

export function clearPendingAuthToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_AUTH_STORAGE_KEY);
  } catch {
    /* noop */
  }
}
