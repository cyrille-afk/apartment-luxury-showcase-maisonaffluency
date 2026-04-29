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
 * Build the canonical composite key for a variant row. Supports up to three
 * axes: Base × Top × Size. When fewer axes are present, the key collapses
 * gracefully so single-axis lookups still work.
 */
export function variantImageKey(
  base?: string | null,
  top?: string | null,
  label?: string | null,
  size?: string | null
): string {
  const b = normFinish((base || "").trim());
  const t = normFinish((top || "").trim());
  const s = normFinish((size || "").trim());
  if (b && t && s) return `${b}|${t}|${s}`;
  if (b && t) return `${b}|${t}`;
  return normFinish(top || base || label || size || "");
}

/**
 * Resolve the gallery image index for the *current* variant selection.
 *
 * Tries keys from most-specific to least-specific so a single
 * `variant_image_map` works for products with one, two, or three axes:
 *   1. `base|top|size`  (full triple)
 *   2. `base|top`       (dual-axis composite)
 *   3. `top`, `base`, `label` (single-axis fallbacks)
 *
 * Returns undefined when nothing matches so callers can leave the gallery
 * on its current image instead of jumping to a wrong one.
 */
export function resolveVariantImageIndex(
  finishMap: Record<string, number> | null,
  opts: {
    base?: string | null;
    top?: string | null;
    label?: string | null;
    size?: string | null;
    imageCount: number;
  }
): number | undefined {
  if (!finishMap) return undefined;
  const { base, top, label, size, imageCount } = opts;

  const tryKey = (k: string | undefined): number | undefined => {
    if (!k) return undefined;
    const idx = finishMap[k];
    return typeof idx === "number" && idx >= 0 && idx < imageCount ? idx : undefined;
  };

  // 1) Full triple — most specific
  if (base && top && size) {
    const triple = `${normFinish(base)}|${normFinish(top)}|${normFinish(size)}`;
    const hit = tryKey(triple);
    if (hit !== undefined) return hit;
  }
  // 2) Dual-axis composite (Base × Top)
  if (base && top) {
    const composite = `${normFinish(base)}|${normFinish(top)}`;
    const hit = tryKey(composite);
    if (hit !== undefined) return hit;
    // For dual-axis products, do NOT silently fall back to a single-axis
    // image (e.g. picking "Aged Brass | Slip-Cast Porcelain" must not
    // resolve to whatever image "Slip-Cast Porcelain" alone maps to,
    // because the same Top is shared by every Base).
    return undefined;
  }
  // 3) Single-axis fallbacks, in priority order
  for (const candidate of [top, base, label, size]) {
    const idx = resolveFinishImageIndex(finishMap, candidate, imageCount);
    if (typeof idx === "number") return idx;
  }
  return undefined;
}
  // 2) Single-axis fallbacks, in priority order
  for (const candidate of [top, base, label]) {
    const idx = resolveFinishImageIndex(finishMap, candidate, imageCount);
    if (typeof idx === "number") return idx;
  }
  return undefined;
}
