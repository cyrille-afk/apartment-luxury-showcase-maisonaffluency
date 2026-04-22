/**
 * Build a clean in-app spec sheet viewer URL.
 * Only brand + product (and optional sheet label) appear in the address bar.
 */
export function buildSpecSheetUrl(
  _pdfUrl: string,
  brand: string,
  product: string,
  sheetLabel?: string,
): string {
  const params = new URLSearchParams();
  params.set("brand", brand);
  params.set("product", product);
  if (sheetLabel) params.set("sheet", sheetLabel);
  return `/trade/spec-sheet?${params.toString()}`;
}
