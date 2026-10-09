/**
 * Build a canonical spec sheet viewer URL, independent of the preview origin.
 * Only brand + product appear prominently, with optional sheet metadata for multi-PDF resolution.
 */
export function buildSpecSheetUrl(
  _pdfUrl: string,
  brand: string,
  product: string,
  sheetLabel?: string,
  sheetIndex?: number,
): string {
  const params = new URLSearchParams();
  params.set("brand", brand);
  params.set("product", product);
  if (sheetLabel) params.set("sheet", sheetLabel);
  if (typeof sheetIndex === "number" && Number.isFinite(sheetIndex)) {
    params.set("sheetIndex", String(sheetIndex));
  }
  return `${specSheetOrigin()}/trade/spec-sheet?${params.toString()}`;
}

/**
 * Open the viewer on the origin the member is already signed in on (sessions
 * are per-origin), so trade members are never asked to sign in again.
 */
function specSheetOrigin(): string {
  const canonical = "https://maisonaffluency.com";
  if (typeof window === "undefined") return canonical;
  const { hostname, origin } = window.location;
  if (/^(www\.)?maisonaffluency\.com$/.test(hostname) || hostname.endsWith(".lovable.app") || hostname === "localhost") return origin;
  return canonical;
}

export const SPEC_SHEET_NAVIGATE_EVENT = "ma:spec-sheet-navigate";

/** True when the URL is this app's own spec-sheet viewer. */
export function isOwnSpecSheetUrl(href: string): URL | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin && url.pathname === "/trade/spec-sheet" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Open a spec sheet. Our own viewer opens in the same tab: a new tab can start
 * without the member's sign-in (embedded previews keep it in partitioned
 * storage), which showed signed-in members the "Sign in to view" gate.
 */
export function openSpecSheet(href: string) {
  const own = isOwnSpecSheetUrl(href);
  if (own) {
    window.dispatchEvent(new CustomEvent(SPEC_SHEET_NAVIGATE_EVENT, { detail: `${own.pathname}${own.search}` }));
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}
