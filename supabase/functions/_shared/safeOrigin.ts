// Allowlist for redirect/return URLs built from the request Origin.
// Anything not on the list falls back to the canonical production site,
// so callers can never steer payers or invitees to a foreign domain.
export const DEFAULT_ORIGIN = "https://www.maisonaffluency.com";

const EXACT = new Set([
  "https://www.maisonaffluency.com",
  "https://maisonaffluency.com",
  "https://apartment-luxury-showcase-maisonaffluency.lovable.app",
  "http://localhost:8080",
]);

const PATTERNS = [
  /^https:\/\/[a-z0-9-]+--02208d51-b513-401f-a97f-9e38a2a4260f\.lovable\.app$/i,
  /^https:\/\/02208d51-b513-401f-a97f-9e38a2a4260f\.lovableproject\.com$/i,
];

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return EXACT.has(origin) || PATTERNS.some((re) => re.test(origin));
}

export function safeOrigin(candidate: string | null | undefined): string {
  if (!candidate) return DEFAULT_ORIGIN;
  let o = candidate;
  try {
    o = new URL(candidate).origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
  return isAllowedOrigin(o) ? o : DEFAULT_ORIGIN;
}

export function safeRequestOrigin(req: Request): string {
  return safeOrigin(req.headers.get("origin"));
}
