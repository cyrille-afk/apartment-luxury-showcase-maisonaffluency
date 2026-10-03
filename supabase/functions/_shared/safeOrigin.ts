// Only this site's own origins may be used to build return / payment URLs.
// Anything else (a forged Origin header) falls back to the production site.
const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?maisonaffluency\.com$/,
  /^https:\/\/apartment-luxury-showcase-maisonaffluency\.lovable\.app$/,
  /^https:\/\/id-preview--02208d51-b513-401f-a97f-9e38a2a4260f\.lovable\.app$/,
  /^https:\/\/02208d51-b513-401f-a97f-9e38a2a4260f\.lovableproject\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
];

export const SITE_ORIGIN = "https://www.maisonaffluency.com";

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  return !!origin && ALLOWED_ORIGINS.some((re) => re.test(origin));
}

export function safeOrigin(req: Request, fallback = SITE_ORIGIN): string {
  const raw = req.headers.get("origin") || "";
  return isAllowedOrigin(raw) ? raw : fallback;
}
