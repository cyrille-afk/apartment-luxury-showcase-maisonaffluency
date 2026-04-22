/**
 * Shared parsing/deduping for `designer_curator_picks.size_variants`.
 *
 * Used by both TradeProductPage (with pricing) and PublicProductPage (display only)
 * so size + material dropdowns behave identically across surfaces.
 *
 * Two shapes are supported:
 *  - dual-axis: variants carry `base` and/or `top` (e.g. base material × top material)
 *  - single-axis: variants carry only `label` — sometimes a clean dimension,
 *    sometimes a combined "Prefix: <dimensions> <material>" string that we
 *    split into separate size/material axes.
 */

export interface SizeVariant {
  label?: string;
  base?: string;
  top?: string;
  price_cents?: number;
}

export interface ParsedSingleAxis {
  size: string;
  material: string;
  variant: SizeVariant;
}

export interface VariantAxes {
  hasVariants: boolean;
  isDualAxis: boolean;
  /** Dual-axis: deduped base material options */
  baseOptions: string[];
  /** Dual-axis: deduped top material options */
  topOptions: string[];
  /** Dual-axis: deduped size labels */
  dualSizeOptions: string[];
  /** Single-axis split: parsed (size, material) pairs */
  singleAxisParsed: ParsedSingleAxis[];
  singleSizeOptions: string[];
  singleMaterialOptions: string[];
  /** True when the single-axis labels actually encode (size × material) */
  hasSingleAxisSplit: boolean;
}

/**
 * Split a combined "Prefix: <dimensions> <material>" label into
 * { size, material }. Falls back gracefully so the dropdown always
 * has a meaningful option, even when the source label is unusual.
 */
export function parseSingleAxisLabel(raw: string): { size: string; material: string } {
  const original = (raw || "").trim();
  if (!original) return { size: "", material: "" };

  let label = original;
  let prefix = "";
  const colonIdx = label.indexOf(":");
  if (colonIdx > -1 && colonIdx < 60) {
    prefix = label.slice(0, colonIdx).trim();
    label = label.slice(colonIdx + 1).trim();
  }

  // Try to isolate a leading dimension chunk: explicit unit, or a numeric/symbolic
  // cluster (Ø, ×, x, digits, decimals) followed by a non-numeric word (= material).
  const unitMatch =
    label.match(/^(.*?\b(?:cm|mm|in|inches?|")\b)/i) ||
    label.match(/^(.*?(?<![A-Za-z/])[mM](?![A-Za-z/]))/);

  let size = "";
  let material = "";
  if (unitMatch) {
    size = unitMatch[1].trim();
    material = label.slice(unitMatch[1].length).trim();
  } else {
    const symbolicMatch = label.match(/^([\d×xØ⌀\.\s\/H WLDhwld]+?)\s+([A-Za-zÀ-ÿ].*)$/);
    if (symbolicMatch) {
      size = symbolicMatch[1].trim();
      material = symbolicMatch[2].trim();
    } else {
      // Could not split cleanly. Keep the whole label as the "size" so the
      // dropdown still shows a meaningful option.
      size = label || prefix || original;
      material = "";
    }
  }

  size = size.replace(/[,\-–—]\s*$/, "").trim();
  material = material.replace(/^[,\-–—]\s*/, "").trim();

  return { size, material };
}

/**
 * Compute deduped axis options from a `size_variants` array.
 */
export function computeVariantAxes(sv: SizeVariant[] | null | undefined): VariantAxes {
  const variants = sv || [];
  const hasVariants = variants.length > 0;
  const isDualAxis =
    hasVariants && variants.some((v) => (v.base && v.base.trim()) || (v.top && v.top.trim()));

  const baseOptions = isDualAxis
    ? Array.from(new Set(variants.map((v) => (v.base || "").trim()).filter(Boolean)))
    : [];
  const topOptions = isDualAxis
    ? Array.from(new Set(variants.map((v) => (v.top || "").trim()).filter(Boolean)))
    : [];
  const dualSizeOptions = isDualAxis
    ? Array.from(new Set(variants.map((v) => (v.label || "").trim()).filter(Boolean)))
    : [];

  const singleAxisParsed: ParsedSingleAxis[] =
    !isDualAxis && hasVariants
      ? variants.map((v) => ({ ...parseSingleAxisLabel(v.label || ""), variant: v }))
      : [];
  const singleSizeOptions = Array.from(
    new Set(singleAxisParsed.map((p) => p.size).filter(Boolean))
  );
  const singleMaterialOptions = Array.from(
    new Set(singleAxisParsed.map((p) => p.material).filter(Boolean))
  );
  const hasSingleAxisSplit =
    !isDualAxis &&
    hasVariants &&
    singleSizeOptions.length > 0 &&
    singleMaterialOptions.length > 0 &&
    singleAxisParsed.length > singleSizeOptions.length;

  return {
    hasVariants,
    isDualAxis,
    baseOptions,
    topOptions,
    dualSizeOptions,
    singleAxisParsed,
    singleSizeOptions,
    singleMaterialOptions,
    hasSingleAxisSplit,
  };
}
