/**
 * Helpers for per-square-metre rug pricing.
 *
 * - Rugs can carry a `price_per_sqm_cents` on the curator pick / trade product.
 * - When set, a variant's price is calculated from W × L parsed out of its
 *   `base` label (e.g. "300 × 400 cm"), and clients can also enter a custom
 *   size on the product page / quote line.
 *
 * Dimension parsing is intentionally forgiving: it accepts ×, x, *, by; cm/m;
 * and either decimal commas or periods. Returns null when it can't be sure.
 */

export interface ParsedRugDims {
  widthCm: number;
  lengthCm: number;
}

const NUM = "(\\d+(?:[.,]\\d+)?)";
const SEP = "\\s*[x×*]\\s*"; // ASCII x, unicode ×, or *
const DIM_REGEX = new RegExp(`${NUM}${SEP}${NUM}\\s*(cm|m)?`, "i");

function toNumber(raw: string): number {
  return parseFloat(raw.replace(",", "."));
}

/** Parse a "300 × 400 cm" / "3 x 4 m" style label into cm dimensions. Returns null when unsure. */
export function parseRugDims(label: string | null | undefined): ParsedRugDims | null {
  if (!label) return null;
  const match = label.match(DIM_REGEX);
  if (!match) return null;
  const a = toNumber(match[1]);
  const b = toNumber(match[2]);
  const unit = (match[3] || "cm").toLowerCase();
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  const factor = unit === "m" ? 100 : 1;
  return { widthCm: Math.round(a * factor), lengthCm: Math.round(b * factor) };
}

/** Square metres for a W × L in cm. */
export function dimsToSqm(widthCm: number, lengthCm: number): number {
  return (widthCm * lengthCm) / 10_000;
}

/** Compute price in minor units for the given square metres + per-sqm rate. */
export function computeRugPriceCents(sqm: number, ratePerSqmCents: number | null | undefined): number | null {
  if (!ratePerSqmCents || ratePerSqmCents <= 0 || !Number.isFinite(sqm) || sqm <= 0) return null;
  return Math.round(sqm * ratePerSqmCents);
}

/** Convenience: parse a label and price it in one call. */
export function priceRugVariantFromLabel(
  label: string | null | undefined,
  ratePerSqmCents: number | null | undefined,
): number | null {
  const dims = parseRugDims(label);
  if (!dims) return null;
  return computeRugPriceCents(dimsToSqm(dims.widthCm, dims.lengthCm), ratePerSqmCents);
}

/** True when the product is a rug (case-insensitive category check). */
export function isRugCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return /\brug/i.test(category);
}

/**
 * Heuristic: does this text look like an actual dimension/size value?
 * Used as a safety net to avoid rendering material/finish copy under the dimension
 * icon when the underlying `dimensions` field (or single size-variant label)
 * was filled with the wrong content.
 *
 * Accepts: cm/mm/m/in/inches/" units, ×/x separators, Ø/⌀ diameters, or a
 * clear H/W/L/D dimension prefix followed by a number.
 */
export function looksLikeDimension(text: string | null | undefined): boolean {
  if (!text) return false;
  // Check each line independently — if any line looks dimensional, keep it.
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .some((line) => {
      if (/\d\s*(?:cm|mm|in|inches?|")\b/i.test(line)) return true;
      if (/(?<![A-Za-z\/])\d+(?:[.,]\d+)?\s*m(?![A-Za-z\/])/i.test(line)) return true;
      if (/\d\s*[×x*]\s*\d/i.test(line)) return true;
      if (/[Ø⌀]\s*\d/.test(line)) return true;
      if (/\b[HWLDhwld]\s*\d/.test(line)) return true;
      return false;
    });
}
