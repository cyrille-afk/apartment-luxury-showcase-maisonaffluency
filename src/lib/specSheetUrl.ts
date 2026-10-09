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
  if (/^(www\.)?maisonaffluency\.com$/.test(hostname) || hostname.endsWith(".lovable.app")) return origin;
  return canonical;
}
