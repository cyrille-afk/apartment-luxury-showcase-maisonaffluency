/**
 * Build an in-app spec sheet viewer URL so the browser address bar
 * shows our domain instead of a storage provider URL.
 */
export function buildSpecSheetUrl(pdfUrl: string, brand: string, product: string): string {
  const params = new URLSearchParams();
  params.set("url", pdfUrl);
  params.set("brand", brand);
  params.set("product", product);
  return `/trade/spec-sheet?${params.toString()}`;
}
