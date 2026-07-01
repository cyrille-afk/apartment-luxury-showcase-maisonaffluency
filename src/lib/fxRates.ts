/**
 * Reliable FX rate lookup for quote pricing.
 *
 * Why this exists:
 *   frankfurter.app is intermittently unreachable (CORS/DNS refusals from the
 *   preview + prod origins), and api.exchangerate.host now demands an API key.
 *   Quote pages were silently falling back to "no conversion" — a line stored
 *   in EUR would display verbatim under an SGD quote, and toggling the quote
 *   currency looked like it did nothing.
 *
 * Strategy:
 *   1. Try frankfurter.app (ECB rates, free, no key).
 *   2. On failure, try open.er-api.com (free, CORS-friendly, no key).
 *   3. On failure, use the hardcoded FALLBACK_RATES table below.
 *
 * The helper always resolves — it never throws — so callers can await it and
 * be guaranteed a usable number. Rates are cached in-memory for 10 minutes.
 */

/** Approximate cross rates (last reviewed 2026). Guarantees conversion never
 *  no-ops when the network is down. Kept in sync with the table bundled in
 *  `src/components/trade/CurrencyToggle.tsx`. */
export const FALLBACK_RATES: Record<string, number> = {
  // self
  SGD_SGD: 1, EUR_EUR: 1, USD_USD: 1, GBP_GBP: 1, CHF_CHF: 1,
  AED_AED: 1, HKD_HKD: 1, AUD_AUD: 1, JPY_JPY: 1, CAD_CAD: 1,
  // EUR base
  EUR_SGD: 1.46, EUR_USD: 1.08, EUR_GBP: 0.86, EUR_CHF: 0.97,
  EUR_AED: 3.97, EUR_HKD: 8.45, EUR_AUD: 1.67, EUR_JPY: 168, EUR_CAD: 1.48,
  // USD base
  USD_EUR: 0.93, USD_SGD: 1.34, USD_GBP: 0.79, USD_CHF: 0.90,
  USD_AED: 3.67, USD_HKD: 7.82, USD_AUD: 1.55, USD_JPY: 155, USD_CAD: 1.37,
  // SGD base
  SGD_EUR: 0.68, SGD_USD: 0.75, SGD_GBP: 0.59, SGD_CHF: 0.67,
  SGD_AED: 2.74, SGD_HKD: 5.84, SGD_AUD: 1.16, SGD_JPY: 116, SGD_CAD: 1.02,
  // GBP base
  GBP_EUR: 1.16, GBP_USD: 1.27, GBP_SGD: 1.70, GBP_CHF: 1.13,
  GBP_AED: 4.66, GBP_HKD: 9.91, GBP_AUD: 1.96, GBP_JPY: 197, GBP_CAD: 1.74,
  // CHF base
  CHF_EUR: 1.03, CHF_USD: 1.11, CHF_SGD: 1.49, CHF_GBP: 0.88,
  CHF_AED: 4.08, CHF_HKD: 8.69, CHF_AUD: 1.72, CHF_JPY: 172, CHF_CAD: 1.52,
  // AED base
  AED_EUR: 0.25, AED_USD: 0.27, AED_SGD: 0.36, AED_GBP: 0.21,
  AED_CHF: 0.24, AED_HKD: 2.13, AED_AUD: 0.42, AED_JPY: 42, AED_CAD: 0.37,
  // HKD base
  HKD_EUR: 0.12, HKD_USD: 0.13, HKD_SGD: 0.17, HKD_GBP: 0.10,
  HKD_CHF: 0.12, HKD_AED: 0.47, HKD_AUD: 0.20, HKD_JPY: 20, HKD_CAD: 0.18,
  // AUD base
  AUD_EUR: 0.60, AUD_USD: 0.65, AUD_SGD: 0.86, AUD_GBP: 0.51,
  AUD_CHF: 0.58, AUD_AED: 2.39, AUD_HKD: 5.10, AUD_JPY: 100, AUD_CAD: 0.89,
  // CAD base
  CAD_EUR: 0.68, CAD_USD: 0.73, CAD_SGD: 0.98, CAD_GBP: 0.58,
  CAD_CHF: 0.66, CAD_AED: 2.68, CAD_HKD: 5.71, CAD_AUD: 1.13, CAD_JPY: 113,
};

export type FxSource = "identity" | "frankfurter" | "open-er-api" | "hardcoded" | "unknown";

type CacheEntry = { rate: number; ts: number; source: FxSource };
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, CacheEntry>();
const lastSources = new Map<string, FxSource>();

export function getFxSource(src: string, tgt: string): FxSource {
  if (src === tgt) return "identity";
  return lastSources.get(`${src}_${tgt}`) ?? "unknown";
}

/** Reduce many pair sources to the lowest-fidelity one, so the UI can
 *  transparently show "we had to fall back for at least one line". */
export function summarizeFxSources(sources: FxSource[]): FxSource {
  const rank: Record<FxSource, number> = {
    "identity": 0,
    "frankfurter": 1,
    "open-er-api": 2,
    "hardcoded": 3,
    "unknown": 4,
  };
  let worst: FxSource = "identity";
  for (const s of sources) if (rank[s] > rank[worst]) worst = s;
  return worst;
}

export function describeFxSource(s: FxSource): { label: string; tone: "live" | "fallback" | "hardcoded" | "none"; detail: string } {
  switch (s) {
    case "identity":     return { label: "No conversion",     tone: "none",      detail: "Source and target currencies match — no FX applied." };
    case "frankfurter":  return { label: "Live ECB rates",    tone: "live",      detail: "Rates fetched live from frankfurter.app (European Central Bank)." };
    case "open-er-api":  return { label: "Live fallback",     tone: "fallback",  detail: "Primary provider unreachable — using open.er-api.com." };
    case "hardcoded":    return { label: "Offline rates",     tone: "hardcoded", detail: "Both live providers unreachable — using the bundled reference table (approximate)." };
    default:             return { label: "Rates pending",     tone: "none",      detail: "FX rates not resolved yet." };
  }
}

const fetchWithTimeout = async (url: string, ms = 4000): Promise<Response> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
};

const fromFrankfurter = async (src: string, tgt: string): Promise<number | null> => {
  try {
    const res = await fetchWithTimeout(
      `https://api.frankfurter.app/latest?from=${src}&to=${tgt}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.rates?.[tgt];
    return typeof r === "number" && r > 0 ? r : null;
  } catch {
    return null;
  }
};

const fromOpenErApi = async (src: string, tgt: string): Promise<number | null> => {
  try {
    const res = await fetchWithTimeout(`https://open.er-api.com/v6/latest/${src}`);
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.rates?.[tgt];
    return typeof r === "number" && r > 0 ? r : null;
  } catch {
    return null;
  }
};

/**
 * Resolve the FX rate to multiply `src` amounts by to get `tgt` amounts.
 * Always resolves. Uses cache → frankfurter → open.er-api → hardcoded fallback.
 */
export async function getFxRate(src: string, tgt: string): Promise<number> {
  if (src === tgt) return 1;
  const key = `${src}_${tgt}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.rate;

  const live =
    (await fromFrankfurter(src, tgt)) ??
    (await fromOpenErApi(src, tgt));

  const rate = live ?? FALLBACK_RATES[key] ?? 1;
  cache.set(key, { rate, ts: Date.now() });
  return rate;
}

/** Batch: resolve rates for many `src → tgt` pairs at once. */
export async function getFxRates(
  pairs: Array<{ src: string; tgt: string }>,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    pairs.map(async ({ src, tgt }) => {
      out[`${src}_${tgt}`] = await getFxRate(src, tgt);
    }),
  );
  return out;
}

/** Synchronous conversion using an already-fetched rates map, with hardcoded
 *  fallback so a missing entry never returns the raw source amount. */
export function convertCentsWithFallback(
  cents: number,
  src: string,
  tgt: string,
  rates: Record<string, number>,
): number {
  if (!cents || src === tgt) return cents;
  const rate = rates[`${src}_${tgt}`] ?? FALLBACK_RATES[`${src}_${tgt}`];
  if (!rate) return cents;
  return Math.round(cents * rate);
}
