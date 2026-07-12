/**
 * Shared detector — is a presentation slide "quote-bearing" and therefore
 * required to display the liability anchor footer?
 *
 * Kept intentionally broad so any *new* slide type that carries quote /
 * product / pricing / spec / schedule / invoice / ffe / tearsheet / line-item
 * data automatically qualifies without needing changes here.
 *
 * Used by both the exported PDF deck (PresentationPDF.tsx) and the in-app
 * viewer (TradePresentationViewer) so behavior stays in lockstep.
 */

export const LIABILITY_ANCHOR =
  "Quotes are valid for 30 days based on live manufacturer data. Final verification required before purchase.";

const QUOTE_BEARING_TYPE_RE =
  /(quote|product|pricing|price|spec|schedule|invoice|ffe|tearsheet|line[_-]?item|order)/i;

interface SlideLike {
  slide_type?: string | null;
  linked_quote_id?: string | null;
  linked_product_ids?: unknown;
  [key: string]: unknown;
}

const parseLinkedProducts = (linked: unknown): unknown[] => {
  if (!linked) return [];
  if (Array.isArray(linked)) return linked;
  if (typeof linked === "string") {
    try {
      const parsed = JSON.parse(linked);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const slideIsQuoteBearing = (slide: SlideLike | null | undefined): boolean => {
  if (!slide) return false;
  if (slide.linked_quote_id) return true;
  if (parseLinkedProducts(slide.linked_product_ids).length > 0) return true;
  if (slide.slide_type && QUOTE_BEARING_TYPE_RE.test(slide.slide_type)) return true;
  if (slide.quote_id || slide.quote_ref || slide.total_cents || slide.line_items) return true;
  return false;
};
