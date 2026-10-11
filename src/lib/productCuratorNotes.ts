export interface CuratorNotesSource {
  title: string;
  brandName: string;
  description?: string | null;
  dimensions?: string | null;
  category?: string | null;
  subcategory?: string | null;
}

export interface ProductCuratorNotes {
  significance: string;
  spatial: string;
  /** Null when the description carries no real provenance signal — renderers must hide the section. */
  provenance: string | null;
}

/** Words that indicate genuine historical/provenance content rather than generic craft copy. */
const PROVENANCE_SIGNAL =
  /\b((?:18|19|20)\d{2}|edition|re[- ]?edition|originally|first (?:produced|designed|introduced|shown)|archive[sd]?|vintage|heritage|revival|reissue[sd]?|restored|prototype|exhibited|retrospective)\b/i;

/**
 * Split prose into sentences without breaking on abbreviations such as
 * "c. 1929", "ca. 1930", "No. 4", "Mr." or on decimal points.
 */
function splitSentences(text: string): string[] {
  if (!text) return [];
  const ABBREV = /\b(?:c|ca|circa|cf|no|nos|vol|fig|st|mt|mr|mrs|ms|dr|jr|sr|etc|e\.g|i\.e)$/i;
  const out: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    current += char;
    if (char !== "." && char !== "!" && char !== "?") continue;
    const next = text[i + 1];
    // Only break when followed by whitespace (or end of string).
    if (next && !/\s/.test(next)) continue;
    const after = text.slice(i + 1).trimStart();
    const head = current.slice(0, -1);
    if (char === "." && ABBREV.test(head.trimEnd())) continue;
    // "c. 1929" — a period followed by a number continues the sentence.
    if (char === "." && /^[\d(]/.test(after)) continue;
    // Lowercase continuation means it was not a real sentence break.
    if (char === "." && /^[a-z]/.test(after)) continue;
    out.push(current.trim());
    current = "";
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}

export function buildProductCuratorNotes(source: CuratorNotesSource): ProductCuratorNotes {
  const year = source.title.match(/\b(18|19|20)\d{2}\b/)?.[0] || null;
  const plainDescription = (source.description || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = splitSentences(plainDescription);
  const category = (source.subcategory || source.category || "piece").toLowerCase();
  const dimensions = (source.dimensions || "").split("\n")[0]?.trim();

  // Provenance: only surface a sentence that carries a genuine historical
  // signal (a year, an edition, an archive origin...). Never recycle the
  // sentences already used for significance/spatial, and never invent copy.
  const provenanceSentence = sentences.find(
    (s, i) => i >= 2 && PROVENANCE_SIGNAL.test(s),
  ) ?? (year ? sentences.find((s, i) => i >= 2 && s.includes(year)) : undefined);

  return {
    significance:
      sentences[0] ||
      (year
        ? `A definitive ${year} ${category} in understated elegance, capturing the transition from historic craft to refined modern minimalism.`
        : `A definitive ${category} in understated elegance, capturing the transition from historic craft to refined modern minimalism.`),
    spatial:
      sentences[1] ||
      (dimensions
        ? `Proportioned at ${dimensions}, with precise geometric balance to serve as a quiet, functional focal point for considered interiors.`
        : "A stripped-back silhouette with precise geometric proportions, calculated to serve as a quiet, functional focal point for considered interiors."),
    provenance: provenanceSentence ?? null,
  };
}