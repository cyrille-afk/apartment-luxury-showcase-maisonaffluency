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
  const s = normFinish((size || label || "").trim());
  if (b && t && s) return `${b}|${t}|${s}`;
  if (b && t) return `${b}|${t}`;
  return normFinish(top || base || label || size || "");
}

function resolveVariantRowLabel(
  variants: { label?: string | null; base?: string | null; top?: string | null }[] | null | undefined,
  base?: string | null,
  top?: string | null,
  explicitSize?: string | null
): string | null {
  if (explicitSize && explicitSize.trim()) return explicitSize.trim();
  if (!variants || !variants.length || !base || !top) return null;
  const matches = variants.filter((v) =>
    (v.base || "").trim() === base.trim() &&
    (v.top || "").trim() === top.trim()
  );
  if (matches.length !== 1) return null;
  return (matches[0].label || "").trim() || null;
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
    variants?: { label?: string | null; base?: string | null; top?: string | null }[] | null;
    imageCount: number;
    /** True only for real Base × Top products; false for base-only products with legacy composite aliases. */
    requireCompletePair?: boolean;
  }
): number | undefined {
  if (!finishMap) return undefined;
  const { base, top, label, size, variants, imageCount, requireCompletePair = true } = opts;

  const tryKey = (k: string | undefined): number | undefined => {
    if (!k) return undefined;
    const idx = finishMap[k];
    return typeof idx === "number" && idx >= 0 && idx < imageCount ? idx : undefined;
  };

  // Dual-axis products always have at least one composite "base|top" key in
  // the map. We use that as the signal to refuse single-axis fallbacks when
  // the user has picked only one of the two axes — otherwise clearing one
  // dropdown can land on the wrong finish image (e.g. clearing Top while
  // Base remains used to resolve to whatever the standalone Base key
  // happened to point at).
  const isDualAxisMap = requireCompletePair && Object.keys(finishMap).some((k) => k.includes("|"));

  // 1) Full triple — most specific
  const rowLabel = resolveVariantRowLabel(variants, base, top, size);
  if (base && top && rowLabel) {
    const triple = `${normFinish(base)}|${normFinish(top)}|${normFinish(rowLabel)}`;
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
  // Partial dual-axis selection: refuse single-axis fallbacks so the caller
  // can snap the gallery back to the primary image instead of a stray finish.
  if (isDualAxisMap && (base || top) && !(base && top)) {
    return undefined;
  }
  // 3) Single-axis fallbacks, in priority order
  for (const candidate of [top, base, label, size]) {
    const idx = resolveFinishImageIndex(finishMap, candidate, imageCount);
    if (typeof idx === "number") return idx;
  }
  return undefined;
}

/**
 * Reverse lookup: given a gallery image index, find the variant row in
 * `size_variants` whose composite key (base|top|size, base|top, or single
 * axis) maps to that index.
 *
 * Used to keep the finish/base/top dropdowns in sync when the user navigates
 * the gallery via thumbnails or swipes — the dropdown should follow the
 * picture, not just the other way around.
 *
 * Returns undefined when no variant maps to the given index (e.g. the user
 * is viewing an editorial photo that isn't tied to any finish).
 */
export function findVariantForImageIndex(
  finishMap: Record<string, number> | null,
  variants: { label?: string | null; base?: string | null; top?: string | null }[] | null | undefined,
  imageIndex: number
):
  | { base: string | null; top: string | null; label: string | null }
  | undefined {
  if (!finishMap || !variants || !variants.length) return undefined;
  if (!Number.isFinite(imageIndex) || imageIndex < 0) return undefined;

  // Step 1: resolve every variant to its anchor index in the gallery (the
  // index stored in `variant_image_map`). We try most-specific keys first.
  type Anchor = {
    variant: { base: string | null; top: string | null; label: string | null };
    anchor: number;
  };
  const anchors: Anchor[] = [];
  for (const v of variants) {
    const base = (v.base || "").trim() || null;
    const top = (v.top || "").trim() || null;
    const label = (v.label || "").trim() || null;

    const candidates: string[] = [];
    if (base && top) candidates.push(variantImageKey(base, top, label, label));
    if (base && top) candidates.push(`${normFinish(base)}|${normFinish(top)}`);
    if (top) candidates.push(normFinish(top));
    if (base) candidates.push(normFinish(base));
    if (label) candidates.push(normFinish(label));

    let anchor: number | undefined;
    for (const k of candidates) {
      const idx = finishMap[k];
      if (typeof idx === "number" && idx >= 0) {
        anchor = idx;
        break;
      }
    }
    if (anchor !== undefined) {
      anchors.push({ variant: { base, top, label }, anchor });
    }
  }

  if (!anchors.length) return undefined;

  // Step 2: exact match wins immediately.
  const exact = anchors.find((a) => a.anchor === imageIndex);
  if (exact) return exact.variant;

  // Step 3: range/span match. Each finish "owns" the contiguous run of images
  // starting at its anchor index up to (but not including) the next anchor.
  // This handles products like Mangala where one finish has 3-4 sequential
  // photos in the gallery but only the first index is recorded in the map.
  const sortedAnchorIdx = Array.from(new Set(anchors.map((a) => a.anchor))).sort((a, b) => a - b);

  // Find the greatest anchor <= imageIndex.
  let owner: number | undefined;
  for (const idx of sortedAnchorIdx) {
    if (idx <= imageIndex) owner = idx;
    else break;
  }
  if (owner === undefined) return undefined;

  const match = anchors.find((a) => a.anchor === owner);
  return match?.variant;
}


