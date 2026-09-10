/**
 * Server-side FX conversion for settlement currencies.
 *
 * The shopper locks a destination + currency in the header modal (Singapore →
 * SGD). Catalogue prices are stored in their native currency (EUR, USD…), so
 * the order must be converted before it is recorded and invoiced. Rates are
 * fetched from open.er-api.com (free, no key) and cached in memory for 10
 * minutes; a hardcoded table guarantees checkout is never blocked.
 */

export const SETTLEMENT_CURRENCIES = [
  "usd", "eur", "gbp", "sgd", "chf", "aed", "hkd", "aud",
] as const;

/** Approximate cross rates — mirrors src/lib/fxRates.ts FALLBACK_RATES. */
const FALLBACK: Record<string, number> = {
  EUR_USD: 1.1583, EUR_SGD: 1.473, EUR_GBP: 0.8589, EUR_CHF: 0.9421,
  EUR_AED: 4.2538, EUR_HKD: 9.02, EUR_AUD: 1.7527,
  USD_EUR: 0.8633, USD_SGD: 1.2717, USD_GBP: 0.7415, USD_CHF: 0.8134,
  USD_AED: 3.6725, USD_HKD: 7.7876, USD_AUD: 1.5131,
  GBP_USD: 1.3487, GBP_EUR: 1.1643, GBP_SGD: 1.7151,
  SGD_USD: 0.7863, SGD_EUR: 0.6788, SGD_GBP: 0.5831,
};

type Cached = { rates: Record<string, number>; at: number };
const cache = new Map<string, Cached>();
const TTL_MS = 10 * 60 * 1000;

async function ratesFor(base: string): Promise<Record<string, number>> {
  const key = base.toUpperCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rates;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${key}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (data?.result === "success" && data?.rates) {
      cache.set(key, { rates: data.rates, at: Date.now() });
      return data.rates;
    }
  } catch (e) {
    console.error("[fxConvert] rate fetch failed", key, String(e));
  }
  return {};
}

/** 1 unit of `from` expressed in `to`. Always resolves to a usable number. */
export async function getRate(from: string, to: string): Promise<number> {
  const src = (from || "usd").toUpperCase();
  const tgt = (to || "usd").toUpperCase();
  if (src === tgt) return 1;
  const live = await ratesFor(src);
  const rate = Number(live[tgt]);
  if (Number.isFinite(rate) && rate > 0) return rate;
  return FALLBACK[`${src}_${tgt}`] ?? 1;
}

/** Convert a cent amount between currencies. */
export async function convertCents(
  cents: number,
  from: string,
  to: string,
): Promise<number> {
  const rate = await getRate(from, to);
  return Math.round(cents * rate);
}
