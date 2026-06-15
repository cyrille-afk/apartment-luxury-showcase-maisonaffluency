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
  /** Optional fabric meters required for this specific size (overrides product-level com_meters). */
  meters?: number;
}


export interface ParsedSingleAxis {
  size: string;
  material: string;
  variant: SizeVariant;
}

export interface VariantAxes {
  hasVariants: boolean;
  isDualAxis: boolean;
  /** True when variants populate Base/Finish but no Top axis. */
  isBaseOnly: boolean;
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
 * Fallback parser for the free-text `materials` field when no `size_variants`
 * are configured. Splits a concatenated string into multiple finish options.
 *
 * Handles three patterns:
 *  1. Explicit separators: comma, slash, semicolon, " | ", " / ".
 *  2. Repeated base material with finish prefixes, e.g.
 *     "Cast Bronze Green Cast Bronze White Cast Bronze Black Cast Bronze"
 *     → ["Black Cast Bronze", "Cast Bronze", "Green Cast Bronze", "White Cast Bronze"]
 *  3. Single material → returns one option.
 *
 * Output is always:
 *  - non-empty
 *  - case-insensitively deduped (first-seen casing wins)
 *  - alphabetically sorted (locale-aware, case-insensitive) for stable display
 */
const stableDedupeAndSort = (parts: string[]): string[] => {
  const seen = new Map<string, string>();
  for (const p of parts) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
  );
};

export function parseMaterialsFallback(raw: string | null | undefined): string[] {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  if (!text) return [];

  // 1. Explicit separators
  if (/[,;|/]/.test(text)) {
    const parts = text.split(/\s*[,;|/]\s*/);
    return stableDedupeAndSort(parts);
  }

  // 2. Repeated-base detection. Find the longest trailing token sequence that
  //    repeats at the end of the string, then split on each occurrence.
  const tokens = text.split(" ");
  if (tokens.length >= 4) {
    for (let baseLen = Math.min(4, Math.floor(tokens.length / 2)); baseLen >= 1; baseLen--) {
      const base = tokens.slice(-baseLen).join(" ");
      const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "g");
      const matches = text.match(re);
      if (matches && matches.length >= 2) {
        const parts: string[] = [];
        let cursor = 0;
        let m: RegExpExecArray | null;
        re.lastIndex = 0;
        while ((m = re.exec(text)) !== null) {
          const end = m.index + m[0].length;
          const segment = text.slice(cursor, end).trim();
          if (segment) parts.push(segment);
          cursor = end;
        }
        if (parts.length >= 2 && parts.every((p) => p.length > 0 && p.length < 80)) {
          return stableDedupeAndSort(parts);
        }
      }
    }
  }

  // 3. Fallback: single value
  return [text];
}

/**
 * Compute deduped axis options from a `size_variants` array.
 */
export function computeVariantAxes(sv: SizeVariant[] | null | undefined): VariantAxes {
  const variants = sv || [];
  const hasVariants = variants.length > 0;
  // True dual-axis only when BOTH base and top axes are populated somewhere
  // in the variants. Products that fill only `base` (e.g. Atelier Pendhapa
  // "Mangala Coffee Table") are functionally single-axis on Base, and
  // mis-classifying them as dual-axis breaks the variant_image_map resolver
  // (it would refuse single-axis fallbacks once the user picks a finish).
  const hasAnyBase = hasVariants && variants.some((v) => (v.base && v.base.trim()));
  const hasAnyTop = hasVariants && variants.some((v) => (v.top && v.top.trim()));
  const isDualAxis = hasAnyBase && hasAnyTop;
  const isBaseOnly = hasAnyBase && !hasAnyTop;

  // Dedupe materials with normalization: ignore case AND strip leading
  // non-letter garbage (stray digits/punctuation like "5Calacatta…") so a
  // clean duplicate of a polluted value collapses into one option. We keep
  // the cleanest spelling.
  const sortAlpha = (vals: string[]): string[] =>
    [...vals].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
    );

  // Sort options ascending by the minimum priced variant they appear in,
  // so dropdowns read low → high price (e.g. Solid Teak < Burnt Oak <
  // Blackened Ash). Options without any priced variant fall to the end
  // and are alpha-sorted. Falls back to pure alpha when no option has any
  // price information (legacy/un-priced products).
  const sortByMinPrice = (
    vals: string[],
    minPriceFor: (v: string) => number | null,
  ): string[] => {
    const withPrice = vals.map((v) => ({ v, p: minPriceFor(v) }));
    const hasAnyPrice = withPrice.some((x) => x.p != null && x.p > 0);
    if (!hasAnyPrice) return sortAlpha(vals);
    const priced = withPrice.filter((x) => x.p != null && x.p > 0);
    const unpriced = withPrice.filter((x) => !(x.p != null && x.p > 0)).map((x) => x.v);
    priced.sort((a, b) =>
      (a.p! - b.p!) ||
      a.v.localeCompare(b.v, undefined, { sensitivity: "base", numeric: true })
    );
    return [...priced.map((x) => x.v), ...sortAlpha(unpriced)];
  };

  const normKey = (s: string) =>
    (s || "").replace(/^[^\p{L}]+/u, "").trim().toLocaleLowerCase();

  const minPriceForField = (field: "base" | "top" | "label") => (val: string) => {
    const key = normKey(val);
    let min: number | null = null;
    for (const v of variants) {
      const raw = (v[field] as string | undefined) || "";
      if (normKey(raw) !== key) continue;
      const p = typeof v.price_cents === "number" ? v.price_cents : null;
      if (p != null && p > 0 && (min == null || p < min)) min = p;
    }
    return min;
  };

  const dedupeMaterialOptions = (
    vals: string[],
    minPriceFor?: (v: string) => number | null,
  ): string[] => {
    const map = new Map<string, string>();
    for (const raw of vals) {
      const v = raw.trim();
      if (!v) continue;
      const cleaned = v.replace(/^[^\p{L}]+/u, "").trim();
      const key = (cleaned || v).toLocaleLowerCase();
      const existing = map.get(key);
      if (!existing || cleaned.length < existing.length) {
        map.set(key, cleaned || v);
      }
    }
    const out = Array.from(map.values());
    return minPriceFor ? sortByMinPrice(out, minPriceFor) : sortAlpha(out);
  };

  const baseOptions = isDualAxis || isBaseOnly
    ? dedupeMaterialOptions(variants.map((v) => v.base || ""), minPriceForField("base"))
    : [];
  const topOptions = isDualAxis
    ? dedupeMaterialOptions(variants.map((v) => v.top || ""), minPriceForField("top"))
    : [];
  const dualSizeOptions = isDualAxis
    ? sortByMinPrice(
        Array.from(new Set(variants.map((v) => (v.label || "").trim()).filter(Boolean))),
        minPriceForField("label"),
      )
    : [];

  const singleAxisParsed: ParsedSingleAxis[] =
    !isDualAxis && hasVariants
      ? variants.map((v) => ({ ...parseSingleAxisLabel(v.label || ""), variant: v }))
      : [];
  const minPriceForSingle = (field: "size" | "material") => (val: string) => {
    const key = val.toLocaleLowerCase();
    let min: number | null = null;
    for (const p of singleAxisParsed) {
      if ((p[field] || "").toLocaleLowerCase() !== key) continue;
      const price = typeof p.variant.price_cents === "number" ? p.variant.price_cents : null;
      if (price != null && price > 0 && (min == null || price < min)) min = price;
    }
    return min;
  };
  const singleSizeOptions = sortByMinPrice(
    Array.from(new Set(singleAxisParsed.map((p) => p.size).filter(Boolean))),
    minPriceForSingle("size"),
  );
  const singleMaterialOptions = sortByMinPrice(
    Array.from(new Set(singleAxisParsed.map((p) => p.material).filter(Boolean))),
    minPriceForSingle("material"),
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
    isBaseOnly,
    baseOptions,
    topOptions,
    dualSizeOptions,
    singleAxisParsed,
    singleSizeOptions,
    singleMaterialOptions,
    hasSingleAxisSplit,
  };
}
