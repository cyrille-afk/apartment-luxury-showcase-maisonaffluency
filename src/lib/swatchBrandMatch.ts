// Token-based brand matcher for syncing material_swatches into curator picks.
// Designer/brand names are noisy ("Garnier & Linker - Guillaume Garnier & Florent Linker"),
// so we match by token overlap rather than exact string equality.

const STOPWORDS = new Set([
  "and", "the", "of", "for", "with", "studio", "atelier", "paris", "london",
  "new", "york", "milano", "milan", "co", "company", "ltd", "inc", "llc",
  "design", "designs", "designer", "designers", "edition", "editions",
  "maison", "house", "by", "from",
]);

export function normalizeStr(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function brandTokens(name: string | null | undefined): Set<string> {
  const norm = normalizeStr(name);
  if (!norm) return new Set();
  const parts = norm.split(/[^a-z0-9]+/).filter(Boolean);
  return new Set(
    parts.filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
  );
}

// Designers whose materials live under a publisher/editor brand in the
// fabrics/finishes library. Add lowercase designer-name → publisher brand.
const DESIGNER_TO_PUBLISHER: Record<string, string[]> = {
  "jean-michel frank": ["Ecart Paris"],
  "eileen gray": ["Ecart Paris"],
  "pierre chareau": ["Ecart Paris"],
  "mariano fortuny": ["Ecart Paris"],
  "paul laszlo": ["Ecart Paris"],
  "andre sornay": ["Ecart Paris"],
  "andré sornay": ["Ecart Paris"],
  "felix aublet": ["Ecart Paris"],
  "félix aublet": ["Ecart Paris"],
};

export function brandMatches(
  designerName: string | null | undefined,
  swatchBrandName: string | null | undefined,
): boolean {
  const a = brandTokens(designerName);
  const b = brandTokens(swatchBrandName);
  if (a.size && b.size) {
    for (const t of a) if (b.has(t)) return true;
  }
  // Publisher fallback: designers re-edited by a single brand (e.g. Ecart).
  const aliases = DESIGNER_TO_PUBLISHER[normalizeStr(designerName)] || [];
  for (const alias of aliases) {
    const ab = brandTokens(alias);
    for (const t of ab) if (b.has(t)) return true;
  }
  return false;
}

export function variantKey(
  base: string | null | undefined,
  top: string | null | undefined,
  label: string | null | undefined,
): string {
  return `${normalizeStr(base).replace(/\s+/g, " ")}|${normalizeStr(top).replace(/\s+/g, " ")}|${normalizeStr(label).replace(/\s+/g, " ")}`;
}
