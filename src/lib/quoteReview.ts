import type { QuotePdfLine } from "@/lib/quotePdf";

/** Keep unpriced lines unknown and use the editor's already-calculated discount. */
export function quoteReviewNetCents(line: Pick<QuotePdfLine, "lineTotalCents">, discountCents: number): number | null {
  return line.lineTotalCents == null ? null : line.lineTotalCents - discountCents;
}