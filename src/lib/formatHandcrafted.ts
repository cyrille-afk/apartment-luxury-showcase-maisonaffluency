/**
 * Shared formatter for the "Handcrafted in {origin} in {lead_time}" spec row
 * shown on both PublicProductPage and TradeProductPage.
 *
 * Normalizes free-text database values so display copy is consistent across
 * all products and locales:
 *   - strips redundant prefixes ("Handmade in", "Handmande in", "Made in", "Ships in")
 *   - corrects common origin typos ("Thailande" → "Thailand")
 *   - collapses inner whitespace ("10 -1 6 weeks" → "10-16 weeks")
 *   - detects "Ready to ship..." style lead times and uses a natural verb
 *     instead of a malformed " in Ready to ship..." suffix
 */

// Match Handmade / Handmande (typo) / Handcrafted / Made — followed by "in"
const ORIGIN_PREFIX_RE = /^\s*(handmande|handmade|handcrafted|made)\s+in\s+/i;
const LEAD_TIME_PREFIX_RE = /^\s*ships?\s+in\s+/i;

const ORIGIN_FIXES: Array<[RegExp, string]> = [
  [/\bThailande\b/gi, "Thailand"],
];

function normalizeWhitespace(s: string): string {
  // collapse "10 -1 6 weeks" / "10 - 16  weeks" → "10-16 weeks" style cleanup:
  // 1) collapse spaces around hyphens between digits
  // 2) collapse multiple spaces
  return s
    .replace(/(\d)\s*-\s*(\d)/g, "$1-$2")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanOrigin(origin: string): string {
  let out = origin.replace(ORIGIN_PREFIX_RE, "");
  for (const [re, rep] of ORIGIN_FIXES) out = out.replace(re, rep);
  return normalizeWhitespace(out);
}

function cleanLeadTime(leadTime: string): string {
  return normalizeWhitespace(leadTime.replace(LEAD_TIME_PREFIX_RE, ""));
}

/**
 * Returns true when a lead-time string is a natural-language phrase rather
 * than a "{n} weeks" duration — e.g. "Ready to ship in Portugal".
 * In that case we render it as a standalone sentence to avoid the awkward
 * "Handcrafted in X in Ready to ship in Y" concatenation.
 */
function isNarrativeLeadTime(cleanedLead: string): boolean {
  return /^ready\s+to\s+ship/i.test(cleanedLead) || !/\d/.test(cleanedLead);
}

export function formatHandcrafted(
  origin: string | null | undefined,
  leadTime: string | null | undefined,
): string | null {
  const o = origin ? cleanOrigin(origin) : "";
  const l = leadTime ? cleanLeadTime(leadTime) : "";

  if (o && l) {
    if (isNarrativeLeadTime(l)) {
      // e.g. "Handcrafted in Italy · Ready to ship in Portugal"
      return `Handcrafted in ${o} · ${l}`;
    }
    return `Handcrafted in ${o} in ${l}`;
  }
  if (o) return `Handcrafted in ${o}`;
  if (l) return l;
  return null;
}
