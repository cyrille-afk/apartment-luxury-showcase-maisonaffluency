// Known misspellings / normalization map for country names appearing in
// curator pick `origin` strings. Add entries here as we find them in the
// database rather than mutating source data.
const COUNTRY_ALIASES: Record<string, string> = {
  portuga: "Portugal",
  portugual: "Portugal",
  "united states of america": "United States",
  usa: "United States",
  us: "United States",
  uk: "United Kingdom",
};

function normalizeCountry(raw: string): string {
  const trimmed = raw.replace(/[.]+$/, "").trim();
  const key = trimmed.toLowerCase();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  // Title-case fallback so casing stays consistent.
  return trimmed;
}

function stripPrefix(value: string): string {
  return value
    .replace(/^hand\s*crafted\s+in\s+the\s+/i, "")
    .replace(/^handcrafted\s+in\s+the\s+/i, "")
    .replace(/^handcrafted\s+in\s+/i, "")
    .replace(/^hancrafted\s+in\s+/i, "")
    .replace(/^handmade\s+in\s+the\s+/i, "")
    .replace(/^handmade\s+in\s+/i, "")
    .replace(/^made\s+in\s+the\s+/i, "")
    .replace(/^made\s+in\s+/i, "")
    .trim();
}

/**
 * Extract every country referenced by a pick `origin` string. Handles:
 *  - "Handcrafted in Portugal" → ["Portugal"]
 *  - "Handcrafted in France & Portugal" → ["France", "Portugal"]
 *  - "Handcrafted in Portuga" (typo) → ["Portugal"]
 */
export function originToCountries(value?: string | null): string[] {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const stripped = stripPrefix(cleaned);
  if (!stripped) return [];
  return stripped
    .split(/\s*(?:&|,|\band\b|\+|\/)\s*/i)
    .map((s) => normalizeCountry(s))
    .filter(Boolean);
}

/** Back-compat: returns the first country if any. */
export function originToCountry(value?: string | null): string | null {
  const [first] = originToCountries(value);
  return first ?? null;
}
