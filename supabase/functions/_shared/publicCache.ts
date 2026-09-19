// Shared CDN cache policy for public (anonymous) catalogue endpoints.
//
// Anonymous responses are identical for every caller, so they are cached at the
// edge for 1 hour and may be served stale for up to 24 hours while the CDN
// revalidates in the background.
//
// Authenticated callers (a signed-in trade designer seeing Studio pricing) must
// NEVER hit or populate a shared cache entry — their responses are `no-store,
// private` and `Vary: Authorization` prevents a CDN from serving them anything
// that was cached for anonymous visitors.

export const PUBLIC_CATALOG_CACHE_CONTROL =
  "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

export const PRIVATE_CACHE_CONTROL = "no-store, private";

export const CACHE_VARY = "Accept-Encoding, Authorization";

/** Extract the bearer token from an Authorization header value. */
export function bearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1].trim() : null;
}

/** Decode a JWT payload without verifying it — we only read the `role` claim. */
export function decodeJwtRole(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const payload = JSON.parse(json) as { role?: string };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * True when the caller presented a real user session (role `authenticated`),
 * as opposed to no token at all or the public anon key.
 */
export function isAuthenticatedRequest(req: Request): boolean {
  const role = decodeJwtRole(bearerToken(req.headers.get("Authorization")));
  return role === "authenticated";
}

/** Cache headers for a public catalogue response, chosen from the caller's auth. */
export function publicCacheHeaders(req: Request): Record<string, string> {
  return {
    "Cache-Control": isAuthenticatedRequest(req)
      ? PRIVATE_CACHE_CONTROL
      : PUBLIC_CATALOG_CACHE_CONTROL,
    Vary: CACHE_VARY,
  };
}
