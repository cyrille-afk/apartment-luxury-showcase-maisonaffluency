/**
 * Shared finish → gallery image index mapping.
 *
 * Used by both PublicProductPage and TradeProductPage so the two surfaces
 * never drift in how they resolve `designer_curator_picks.variant_image_map`
 * lookups when the user picks a finish/material from a dropdown.
 */

/** Normalize a finish/material label so spelling variants collapse to one key. */
export const normFinish = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Build a normalized lookup table from a product's raw `variant_image_map`
 * JSONB column. Returns null when the map is empty or unusable so callers
 * can short-circuit cleanly.
 */
export function buildProductFinishMap(
  raw: unknown
): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Number(v);
    if (Number.isFinite(idx)) out[normFinish(k)] = idx;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Resolve the gallery image index for a selected finish label, bounded to
 * the available image count. Returns undefined when no mapping applies.
 */
export function resolveFinishImageIndex(
  finishMap: Record<string, number> | null,
  label: string | null | undefined,
  imageCount: number
): number | undefined {
  if (!finishMap || !label) return undefined;
  const idx = finishMap[normFinish(label)];
  if (typeof idx === "number" && idx >= 0 && idx < imageCount) return idx;
  return undefined;
}
