export interface QuoteFinishSwatch {
  fabric_id?: string | null;
  id?: string | null;
  name: string;
  image_url?: string | null;
  category?: string | null;
  supplier?: string | null;
  sort_order?: number | null;
}

export interface QuoteFinishVariant {
  label?: string | null;
  base?: string | null;
  top?: string | null;
  size?: string | null;
  rawLabel?: string | null;
  price_cents?: number | null;
}

const normalizeFinishKey = (value: string | null | undefined): string =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const splitQuoteFinishLabel = (label: string | null | undefined): string[] =>
  (label || "")
    .split(/\s*(?:·|\/|,|;)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

const bySortOrder = (a: QuoteFinishSwatch, b: QuoteFinishSwatch) =>
  (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name);

const STOP_TOKENS = new Set([
  "fabric", "cat", "cata", "cate", "categorie", "category",
  "com", "col", "colour", "color", "leather", "velvet", "boucle", "linen",
  "wool", "cotton", "silk", "ral", "code", "ref",
]);

const significantTokens = (value: string): string[] =>
  normalizeFinishKey(value)
    .split(" ")
    .filter((tok) => tok.length >= 3 && !STOP_TOKENS.has(tok) && !/^\d+$/.test(tok));

const variantCandidates = (variant: string | QuoteFinishVariant | null | undefined): string[] => {
  if (!variant) return [];
  if (typeof variant === "string") return splitQuoteFinishLabel(variant);
  const parts = [variant.base, variant.top, variant.rawLabel, variant.label].filter(Boolean) as string[];
  return parts.flatMap((part) => splitQuoteFinishLabel(part));
};

const MATERIAL_CATEGORY_HINTS: Record<string, string[]> = {
  Stone: ["stone", "marble", "travertine", "onyx", "limestone", "granite", "quartzite", "alabaster"],
  Wood: ["wood", "oak", "walnut", "ash", "teak", "cedar", "mahogany", "ebony", "maple"],
  Metal: ["metal", "brass", "bronze", "steel", "iron", "nickel", "chrome", "aluminum", "aluminium"],
  Glass: ["glass", "crystal"],
  Ceramic: ["ceramic", "raku", "porcelain", "terracotta"],
  "Fabric & Leather": ["fabric", "leather", "velvet", "linen", "boucle", "wool", "cotton", "silk", "suede"],
};

const matchingMaterialCategories = (value: string): Set<string> => {
  const tokens = new Set(normalizeFinishKey(value).split(" ").filter(Boolean));
  const categories = new Set<string>();
  for (const [category, hints] of Object.entries(MATERIAL_CATEGORY_HINTS)) {
    if (hints.some((hint) => tokens.has(hint))) categories.add(category);
  }
  return categories;
};

export const findQuoteFinishSwatch = (
  candidates: Array<string | null | undefined>,
  swatches: QuoteFinishSwatch[],
): QuoteFinishSwatch | null => {
  const ordered = [...swatches]
    .filter((swatch) => swatch?.name && swatch.image_url)
    .sort(bySortOrder);

  for (const candidate of candidates) {
    const keys = new Set([
      normalizeFinishKey(candidate),
      ...splitQuoteFinishLabel(candidate).map(normalizeFinishKey),
    ].filter(Boolean));
    if (keys.size === 0) continue;

    const exact = ordered.find((swatch) => keys.has(normalizeFinishKey(swatch.name)));
    if (exact) return exact;
  }

  for (const candidate of candidates) {
    const candidateKeys = [
      normalizeFinishKey(candidate),
      ...splitQuoteFinishLabel(candidate).map(normalizeFinishKey),
    ].filter((key) => key.length >= 4);
    if (candidateKeys.length === 0) continue;

    const fuzzy = ordered.find((swatch) => {
      const swatchKey = normalizeFinishKey(swatch.name);
      if (swatchKey.length < 4) return false;
      return candidateKeys.some((key) => key.includes(swatchKey) || swatchKey.includes(key));
    });
    if (fuzzy) return fuzzy;
  }

  // Token-overlap fallback: strip noise words ("Fabric Cat.", numeric codes)
  // and match on significant tokens. Handles labels like "Fabric Cat. Perfect
  // Match" ↔ swatch "Perfect Match 10944795".
  for (const candidate of candidates) {
    const candTokens = significantTokens(candidate || "");
    if (candTokens.length === 0) continue;
    const candSet = new Set(candTokens);

    let best: { swatch: QuoteFinishSwatch; score: number } | null = null;
    for (const swatch of ordered) {
      const swTokens = significantTokens(swatch.name);
      if (swTokens.length === 0) continue;
      const overlap = swTokens.filter((t) => candSet.has(t)).length;
      if (overlap === 0) continue;
      const strong = overlap === swTokens.length || overlap >= 2;
      if (!strong) continue;
      if (!best || overlap > best.score) best = { swatch, score: overlap };
    }
    if (best) return best.swatch;
  }

  return null;
};

export const findQuoteFinishSwatches = (
  variant: string | QuoteFinishVariant | null | undefined,
  swatches: QuoteFinishSwatch[],
): QuoteFinishSwatch[] => {
  const seen = new Set<string>();
  const matches: QuoteFinishSwatch[] = [];
  const pushMatch = (match: QuoteFinishSwatch | null | undefined) => {
    if (!match) return;
    const key = match.fabric_id || match.id || match.image_url || match.name;
    if (!key || seen.has(key)) return;
    seen.add(key);
    matches.push(match);
  };

  const ordered = [...swatches]
    .filter((s) => s?.name && s.image_url)
    .sort(bySortOrder);

  for (const part of variantCandidates(variant)) {
    // Try single best-match first (exact / fuzzy / token-overlap).
    pushMatch(findQuoteFinishSwatch([part], swatches));

    // Additionally surface every swatch that shares the part's significant
    // tokens — e.g. "Fabric Cat. Perfect Match" reveals all colourways in
    // the Perfect Match category, mirroring the curator lightbox behaviour.
    const partTokens = significantTokens(part);
    if (partTokens.length === 0) continue;
    const partSet = new Set(partTokens);
    for (const swatch of ordered) {
      const swTokens = significantTokens(swatch.name);
      if (swTokens.length === 0) continue;
      const allCovered = swTokens.every((t) => partSet.has(t));
      if (allCovered) pushMatch(swatch);
    }

    // Product pages show material swatches grouped by category. Variant labels
    // often say "Marble 1/2" or "Oak" while the actual library contains named
    // finishes such as "Marble Laguetta". When exact names are absent, fall
    // back to the same material category rather than showing a false empty state.
    const partCategories = matchingMaterialCategories(part);
    if (partCategories.size > 0) {
      for (const swatch of ordered) {
        const swatchCategory = swatch.category?.trim();
        if (swatchCategory && partCategories.has(swatchCategory)) pushMatch(swatch);
      }
    }
  }
  return matches;
};