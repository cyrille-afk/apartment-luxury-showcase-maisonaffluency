export interface QuoteFinishSwatch {
  fabric_id?: string | null;
  id?: string | null;
  name: string;
  image_url?: string | null;
  sort_order?: number | null;
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
  variantLabel: string | null | undefined,
  swatches: QuoteFinishSwatch[],
): QuoteFinishSwatch[] => {
  const seen = new Set<string>();
  const matches: QuoteFinishSwatch[] = [];
  for (const part of splitQuoteFinishLabel(variantLabel)) {
    const match = findQuoteFinishSwatch([part], swatches);
    const key = match?.fabric_id || match?.id || match?.image_url || match?.name;
    if (match && key && !seen.has(key)) {
      seen.add(key);
      matches.push(match);
    }
  }
  return matches;
};