import { currencySymbol } from "./pdfFormatting";

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

/**
 * Standalone budget field ("20,000", "€2k", "5,000 SGD") → cents + ISO currency.
 * Currency null means "use the gallery's display currency".
 */
export function parseBudgetAmount(raw: string): { cents: number | null; currency: string | null } {
  const text = raw.trim();
  if (!text) return { cents: null, currency: null };
  const m = text.match(new RegExp(`${CUR}?\\s*${AMOUNT}\\s*${CUR}?`, "i"));
  const n = m ? toNumber(m[2], m[3]) : null;
  if (!n || n <= 0) return { cents: null, currency: null };
  const cur = ((m?.[1] || "") + (m?.[4] || "")).toLowerCase();
  return { cents: Math.round(n * 100), currency: cur ? CURRENCY_WORDS[cur] ?? null : null };
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

export interface PricedVariant { label?: string | null; base?: string | null; top?: string | null; price_cents?: number | null }

/**
 * Price to test against a budget: the cheapest variant whose size matches the
 * searched dimensions (finish unspecified), else the base price when the
 * product's own dimensions match. null = size not offered / no price.
 */
export function priceForSize(
  baseCents: number | null,
  dimensions: string | undefined | null,
  variants: PricedVariant[] | undefined,
  sizeMm: number | null,
  mode: GallerySearchIntent["sizeMode"],
): number | null {
  if (!sizeMm) return baseCents;
  const sized = (variants || []).filter((v) =>
    Number(v.price_cents) > 0 && [v.label, v.base, v.top].some((t) => matchesSize(t, sizeMm, mode)));
  if (sized.length) return Math.min(...sized.map((v) => Number(v.price_cents)));
  // Variants list sizes but none match → this size isn't offered.
  if ((variants || []).some((v) => [v.label, v.base, v.top].some((t) => planLengthsMm(t).length))) return null;
  return matchesSize(dimensions, sizeMm, mode) ? baseCents : null;
}

/** One-click budget band. null bound = open-ended, in the gallery's display currency. */
export interface BudgetPreset {
  id: string;
  minCents: number | null;
  maxCents: number | null;
}

/**
 * Bands follow the live catalogue spread (277 pieces under €5k, 291 €5k–€20k,
 * 88 €20k–€50k, 9 €50k–€100k, 7 over €100k) so every preset returns results.
 */
export const BUDGET_PRESETS: BudgetPreset[] = [
  { id: "under-5k", minCents: null, maxCents: 500_000 },
  { id: "5k-20k", minCents: 500_000, maxCents: 2_000_000 },
  { id: "20k-50k", minCents: 2_000_000, maxCents: 5_000_000 },
  { id: "50k-100k", minCents: 5_000_000, maxCents: 10_000_000 },
  { id: "100k-plus", minCents: 10_000_000, maxCents: null },
];

/** Amounts to write into the Min/Max fields — no currency symbol, so the
 *  preset keeps following the gallery's display currency if it changes. */
export function budgetPresetFields(preset: BudgetPreset): { min: string; max: string } {
  const amount = (cents: number | null) => (cents === null ? "" : (cents / 100).toLocaleString("en-US"));
  return { min: amount(preset.minCents), max: amount(preset.maxCents) };
}

/** "€5k – €20k" / "Under €5k" / "€100k +" in the given currency. */
export function budgetPresetLabel(preset: BudgetPreset, currency: string): string {
  const sym = currencySymbol(currency);
  const short = (cents: number) => {
    const units = cents / 100;
    return units >= 1000 ? `${units / 1000}k` : String(units);
  };
  if (preset.minCents === null) return `Under ${sym}${short(preset.maxCents!)}`;
  if (preset.maxCents === null) return `${sym}${short(preset.minCents)} +`;
  return `${sym}${short(preset.minCents)} – ${sym}${short(preset.maxCents)}`;
}

/** The preset whose bounds the current Min/Max cents match exactly, else null. */
export function activeBudgetPresetId(
  minCents: number | null,
  maxCents: number | null,
  presets: BudgetPreset[] = BUDGET_PRESETS,
): string | null {
  return presets.find((p) => p.minCents === minCents && p.maxCents === maxCents)?.id ?? null;
}
