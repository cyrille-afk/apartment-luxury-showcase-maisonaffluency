/**
 * Decides whether a dual-axis product (Base × Top) should auto-default its
 * pickers on initial load, and to which pair.
 *
 * Rule: only auto-default when there is genuinely ONE pairing to show
 * (exactly one Base AND its single compatible Top). Multi-base products
 * (e.g. Pierre Bonnefille's "Stone D Coffee Table" with three colorways)
 * must wait for an explicit user pick — otherwise the gallery silently
 * jumps to a mapped finish image and skips the editorial photos shown
 * before it.
 *
 * Pure function, no React, no DOM — easy to unit test.
 */

export interface SizeVariantRow {
  base?: string | null;
  top?: string | null;
  label?: string | null;
  price_cents?: number;
}

export interface AutoDefaultPair {
  base: string;
  top: string;
}

/**
 * Returns the {base, top} pair to auto-select on load, or null when the
 * user must pick manually.
 */
export function resolveAutoDefaultPair(
  sizeVariants: SizeVariantRow[] | null | undefined
): AutoDefaultPair | null {
  if (!sizeVariants || !sizeVariants.length) return null;

  const baseOpts = Array.from(
    new Set(sizeVariants.map((v) => (v.base || "").trim()).filter(Boolean))
  );
  const topOpts = Array.from(
    new Set(sizeVariants.map((v) => (v.top || "").trim()).filter(Boolean))
  );

  if (!baseOpts.length || !topOpts.length) return null;

  // Multiple bases → user must choose. Never auto-jump the gallery.
  if (baseOpts.length > 1) return null;

  const firstBase = baseOpts[0];
  const compatTops = topOpts.filter((t) =>
    sizeVariants.some(
      (v) => (v.base || "").trim() === firstBase && (v.top || "").trim() === t
    )
  );

  if (compatTops.length !== 1) return null;
  return { base: firstBase, top: compatTops[0] };
}
