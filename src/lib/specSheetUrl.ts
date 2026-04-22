/**
 * Build a clean in-app spec sheet viewer URL.
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
  return `/trade/spec-sheet?${params.toString()}`;
}
