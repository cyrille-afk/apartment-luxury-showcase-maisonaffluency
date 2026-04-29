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

const normMapKey = (key: string): string => {
  if (!key.includes("|")) return normFinish(key);
  const parts = key.split("|").map((p) => normFinish(p || ""));
  // Drop empty trailing segments so "base|top|" still matches "base|top"
  while (parts.length && !parts[parts.length - 1]) parts.pop();
  if (parts.length === 0) return normFinish(key);
  if (parts.length === 1) return parts[0];
  return parts.join("|");
};

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
    if (Number.isFinite(idx)) out[normMapKey(k)] = idx;
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

/**
 * Build the canonical composite key for a dual-axis variant row. When both
 * axes are filled, this guarantees each row gets its own image slot — even
 * when several rows share the same Top (or Base) value, like Apparatus
 * Lantern Table Lamp where every row is "Slip-cast Porcelain" but the
 * Structure differs.
 */
export function variantImageKey(
  base?: string | null,
  top?: string | null,
  label?: string | null
): string {
  const b = (base || "").trim();
  const t = (top || "").trim();
  if (b && t) return `${normFinish(b)}|${normFinish(t)}`;
  return normFinish(t || b || label || "");
}

/**
 * Try a list of candidate labels (already in priority order) plus an
 * optional composite `base|top` key. Returns the first valid mapping.
 */
export function resolveVariantImageIndex(
  finishMap: Record<string, number> | null,
  opts: {
    base?: string | null;
    top?: string | null;
    label?: string | null;
    imageCount: number;
  }
): number | undefined {
  if (!finishMap) return undefined;
  const { base, top, label, imageCount } = opts;
  // 1) Composite key (most specific) when both axes are present
  if (base && top) {
    const composite = `${normFinish(base)}|${normFinish(top)}`;
    const idx = finishMap[composite];
    if (typeof idx === "number" && idx >= 0 && idx < imageCount) return idx;
    return undefined;
  }
  // 2) Single-axis fallbacks, in priority order
  for (const candidate of [top, base, label]) {
    const idx = resolveFinishImageIndex(finishMap, candidate, imageCount);
    if (typeof idx === "number") return idx;
  }
  return undefined;
}
