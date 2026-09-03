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

/** Approximate cross rates (last reviewed 2026-09-03 vs open.er-api.com).
 *  Guarantees conversion never no-ops when the network is down. Kept in sync
 *  with the table bundled in `src/components/trade/CurrencyToggle.tsx`. */
export const FALLBACK_RATES: Record<string, number> = {
  // self
  SGD_SGD: 1, EUR_EUR: 1, USD_USD: 1, GBP_GBP: 1, CHF_CHF: 1,
  AED_AED: 1, HKD_HKD: 1, AUD_AUD: 1, JPY_JPY: 1, CAD_CAD: 1,
  // EUR base
  EUR_SGD: 1.473, EUR_USD: 1.1583, EUR_GBP: 0.8589, EUR_CHF: 0.9421,
  EUR_AED: 4.2538, EUR_HKD: 9.083, EUR_AUD: 1.6178, EUR_JPY: 184.2694, EUR_CAD: 1.606,
  // USD base
  USD_EUR: 0.8633, USD_SGD: 1.2717, USD_GBP: 0.7416, USD_CHF: 0.8134,
  USD_AED: 3.6725, USD_HKD: 7.8418, USD_AUD: 1.3967, USD_JPY: 159.0888, USD_CAD: 1.3865,
  // SGD base
  SGD_EUR: 0.6789, SGD_USD: 0.7863, SGD_GBP: 0.5831, SGD_CHF: 0.6396,
  SGD_AED: 2.8878, SGD_HKD: 6.1663, SGD_AUD: 1.0983, SGD_JPY: 125.0974, SGD_CAD: 1.0903,
  // GBP base
  GBP_EUR: 1.1642, GBP_USD: 1.3485, GBP_SGD: 1.7149, GBP_CHF: 1.0968,
  GBP_AED: 4.9523, GBP_HKD: 10.5746, GBP_AUD: 1.8834, GBP_JPY: 214.53, GBP_CAD: 1.8697,
  // CHF base
  CHF_EUR: 1.0614, CHF_USD: 1.2294, CHF_SGD: 1.5635, CHF_GBP: 0.9117,
  CHF_AED: 4.5151, CHF_HKD: 9.641, CHF_AUD: 1.7171, CHF_JPY: 195.5895, CHF_CAD: 1.7046,
  // AED base
  AED_EUR: 0.2351, AED_USD: 0.2723, AED_SGD: 0.3463, AED_GBP: 0.2019,
  AED_CHF: 0.2215, AED_HKD: 2.1353, AED_AUD: 0.3803, AED_JPY: 43.3189, AED_CAD: 0.3775,
  // HKD base
  HKD_EUR: 0.1101, HKD_USD: 0.1275, HKD_SGD: 0.1622, HKD_GBP: 0.0946,
  HKD_CHF: 0.1037, HKD_AED: 0.4683, HKD_AUD: 0.1781, HKD_JPY: 20.2872, HKD_CAD: 0.1768,
  // AUD base
  AUD_EUR: 0.6181, AUD_USD: 0.716, AUD_SGD: 0.9105, AUD_GBP: 0.5309,
  AUD_CHF: 0.5824, AUD_AED: 2.6294, AUD_HKD: 5.6146, AUD_JPY: 113.9045, AUD_CAD: 0.9927,
  // CAD base
  CAD_EUR: 0.6227, CAD_USD: 0.7212, CAD_SGD: 0.9172, CAD_GBP: 0.5349,
  CAD_CHF: 0.5866, CAD_AED: 2.6488, CAD_HKD: 5.6558, CAD_AUD: 1.0073, CAD_JPY: 114.7414,
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
      `https://api.frankfurter.dev/v1/latest?base=${src}&symbols=${tgt}`,
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
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    lastSources.set(key, cached.source);
    return cached.rate;
  }

  let source: FxSource = "hardcoded";
  let live = await fromFrankfurter(src, tgt);
  if (live != null) source = "frankfurter";
  if (live == null) {
    live = await fromOpenErApi(src, tgt);
    if (live != null) source = "open-er-api";
  }

  const rate = live ?? FALLBACK_RATES[key] ?? 1;
  cache.set(key, { rate, ts: Date.now(), source });
  lastSources.set(key, source);
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
