/**
 * Build a clean in-app spec sheet viewer URL.
 * Only brand + product appear in the address bar.
 */
export function buildSpecSheetUrl(_pdfUrl: string, brand: string, product: string): string {
  const params = new URLSearchParams();
  params.set("brand", brand);
  params.set("product", product);
  return `/trade/spec-sheet?${params.toString()}`;
}
