/** Unknown/request-only prices stay last in either direction. */
export function compareCataloguePrices(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: "price-asc" | "price-desc",
): number {
  const aKnown = typeof a === "number" && Number.isFinite(a) && a > 0;
  const bKnown = typeof b === "number" && Number.isFinite(b) && b > 0;
  if (!aKnown && !bKnown) return 0;
  if (!aKnown) return 1;
  if (!bKnown) return -1;
  return direction === "price-asc" ? a - b : b - a;
}