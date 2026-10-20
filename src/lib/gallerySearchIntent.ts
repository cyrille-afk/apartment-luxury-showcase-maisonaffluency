/**
 * Budget and size phrases inside the Trade Gallery search box.
 *
 * "260 cm table under €20,000" → text "table", size 2600 mm (±100 mm),
 * budget max 2,000,000 cents EUR. Remaining words still run the normal
 * free-text search.
 */
export interface GallerySearchIntent {
  text: string;
  /** Target length in mm, matched against the longest plan dimension. */
  sizeMm: number | null;
  sizeMode: "about" | "min" | "max";
  budgetCents: number | null;
  /** ISO currency, or null to use the gallery's display currency. */
  budgetCurrency: string | null;
}

export const SIZE_TOLERANCE_MM = 100;

const CURRENCY_WORDS: Record<string, string> = {
  "€": "EUR", eur: "EUR", euro: "EUR", euros: "EUR",
  "$": "USD", usd: "USD", "£": "GBP", gbp: "GBP",
  sgd: "SGD", "s$": "SGD", chf: "CHF", aud: "AUD", hkd: "HKD", aed: "AED",
};
const CUR = "(€|\\$|£|s\\$|eur(?:os?)?|usd|gbp|sgd|chf|aud|hkd|aed)";
const AMOUNT = "(\\d[\\d,.\\s]*\\d|\\d)\\s*(k|m)?";

function toNumber(raw: string, suffix?: string) {
  let n = Number(raw.replace(/[\s,]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (suffix?.toLowerCase() === "k") n *= 1_000;
  if (suffix?.toLowerCase() === "m") n *= 1_000_000;
  return n;
}

export function parseGallerySearch(raw: string): GallerySearchIntent {
  let text = ` ${raw} `;
  let budgetCents: number | null = null;
  let budgetCurrency: string | null = null;

  const budgetRe = new RegExp(
    `\\b(?:under|below|less than|max(?:imum)?|up to|within|budget(?: of)?|<)\\s*${CUR}?\\s*${AMOUNT}\\s*${CUR}?`,
    "i",
  );
  const b = text.match(budgetRe);
  if (b) {
    const n = toNumber(b[2], b[3]);
    if (n) {
      budgetCents = Math.round(n * 100);
      const cur = (b[1] || b[4] || "").toLowerCase();
      budgetCurrency = cur ? CURRENCY_WORDS[cur] ?? null : null;
      text = text.replace(b[0], " ");
    }
  }

  let sizeMm: number | null = null;
  let sizeMode: GallerySearchIntent["sizeMode"] = "about";
  const sizeRe = /\b(?:(at least|min(?:imum)?|over|longer than|at most|shorter than|max(?:imum)?)\s*)?(\d+(?:[.,]\d+)?)\s*(cm|mm|m)\b(?:\s*(long|wide|length|width))?/i;
  const s = text.match(sizeRe);
  if (s) {
    const n = Number(s[2].replace(",", "."));
    const factor = s[3].toLowerCase() === "mm" ? 1 : s[3].toLowerCase() === "m" ? 1000 : 10;
    sizeMm = Math.round(n * factor);
    const q = (s[1] || "").toLowerCase();
    if (/least|min|over|longer/.test(q)) sizeMode = "min";
    else if (/most|max|shorter/.test(q)) sizeMode = "max";
    text = text.replace(s[0], " ");
  }

  text = text.replace(/\b(for|a|an|of)\b/gi, " ").replace(/\s+/g, " ").trim();
  return { text, sizeMm, sizeMode, budgetCents, budgetCurrency };
}

/** Every plan length (W/L/D/Ø, incl. "W 200 / 240") in a dimension string, in mm. */
export function planLengthsMm(dimensions?: string | null): number[] {
  if (!dimensions) return [];
  const factor = /\bmm\b/i.test(dimensions) ? 1 : 10;
  const out: number[] = [];
  const re = /(?:\b(?:W|L|D|Width|Length|Depth)|[ØøΦ])\s*:?\s*(\d+(?:[.,]\d+)?(?:\s*(?:\/|-|–|to)\s*\d+(?:[.,]\d+)?)*)/gi;
  for (const m of dimensions.matchAll(re)) {
    for (const v of m[1].split(/\/|-|–|to/)) {
      const n = Number(v.trim().replace(",", "."));
      if (n > 0) out.push(Math.round(n * factor));
    }
  }
  return out;
}

export function matchesSize(dimensions: string | undefined | null, sizeMm: number, mode: GallerySearchIntent["sizeMode"]) {
  const lengths = planLengthsMm(dimensions);
  if (!lengths.length) return false;
  if (mode === "min") return lengths.some((l) => l >= sizeMm);
  if (mode === "max") return lengths.some((l) => l <= sizeMm);
  return lengths.some((l) => Math.abs(l - sizeMm) <= SIZE_TOLERANCE_MM);
}
