import { looksLikeDimension } from "@/lib/rugPricing";

/**
 * Drawer dimensions line — mirrors the product page's model-dimension display
 * for the Quote & Order Workspace drawers.
 *
 * Variant labels carry one of these shapes:
 *  - dual-axis model label:  "Saint Honoré 280 | W 280 x D 160 x H 75 cm"
 *    → rendered as "Saint Honoré 280: W 280 x D 160 x H 75 cm"
 *  - pure dimension label:   "Ø 90 cm" / "W 40 x H 20 cm"
 *  - non-dimensional label:  "Solid Oak" → fall back to the product dimensions
 */
export function formatDrawerDimensions(
  sizeLabel?: string | null,
  fallback?: string | null,
): string | null {
  const raw = (sizeLabel || "").trim();
  if (raw) {
    if (raw.includes(" | ")) {
      const [name, dims] = raw.split(" | ");
      if (looksLikeDimension(dims)) return `${name.trim()}: ${dims.trim()}`;
    }
    if (looksLikeDimension(raw)) return raw;
  }
  const fb = (fallback || "").trim();
  if (fb) {
    const formattedFallback = formatDrawerDimensions(fb, null);
    if (formattedFallback) return formattedFallback;
  }
  return null;
}

/**
 * The dimensions body of a formatted line (portion after "Name: ") — used to
 * avoid repeating a size the configuration line already shows.
 */
export function drawerDimensionsBody(formatted: string | null | undefined): string | null {
  if (!formatted) return null;
  const idx = formatted.indexOf(": ");
  return idx > -1 ? formatted.slice(idx + 2) : formatted;
}

/**
 * Pull the dimensions line from a stored quote/cart variant label whose
 * segments are joined with " · " (e.g. "Solid Oak · Teddy Mohair ·
 * Saint Honoré 280 | W 280 x D 160 x H 75 cm"). Falls back to the product
 * dimensions when no segment carries a size.
 */
export function dimensionsFromVariantLabel(
  variantLabel?: string | null,
  fallback?: string | null,
): string | null {
  const raw = (variantLabel || "").trim();
  if (raw) {
    for (const segment of raw.split(" · ")) {
      const formatted = formatDrawerDimensions(segment);
      if (formatted) return formatted;
    }
  }
  return formatDrawerDimensions(null, fallback);
}
