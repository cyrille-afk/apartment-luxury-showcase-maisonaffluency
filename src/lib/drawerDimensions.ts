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

/** Finish text for display: variant label minus size segments and repeats (size shows on its own line). */
export function finishFromVariantLabel(variantLabel?: string | null): string | null {
  const seen = new Set<string>();
  const parts = (variantLabel || "").split(" · ").map((s) => s.trim()).filter((s) => {
    if (!s || formatDrawerDimensions(s)) return false;
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return parts.length ? parts.join(" · ") : null;
}

/** Joins label segments once each (case/space-insensitive) so saved labels never repeat a size. */
export function joinUniqueLabelSegments(...labels: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of labels) for (const s of (l || "").split(" · ")) {
    const t = s.trim(); const k = t.toLowerCase().replace(/\s+/g, "");
    if (t && !seen.has(k)) { seen.add(k); out.push(t); }
  }
  return out.join(" · ");
}
