/**
 * Server-side FX conversion (shared). Rates from `currency_rates`, cached 10
 * minutes, with a hardcoded fallback so pricing is never blocked.
 * Mirrors create-cart-checkout/fxConvert.ts.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const FALLBACK: Record<string, number> = {
  EUR_USD: 1.1583, EUR_SGD: 1.473, EUR_GBP: 0.8589, EUR_CHF: 0.9421,
  EUR_AED: 4.2538, EUR_HKD: 9.02, EUR_AUD: 1.7527,
  USD_EUR: 0.8633, USD_SGD: 1.2717, USD_GBP: 0.7415, USD_CHF: 0.8134,
  USD_AED: 3.6725, USD_HKD: 7.7876, USD_AUD: 1.5131,
  GBP_USD: 1.3487, GBP_EUR: 1.1643, GBP_SGD: 1.7151,
  SGD_USD: 0.7863, SGD_EUR: 0.6788, SGD_GBP: 0.5831,
};

const cache = new Map<string, { rates: Record<string, number>; at: number }>();
const TTL_MS = 10 * 60 * 1000;

async function ratesFor(base: string): Promise<Record<string, number>> {
  const hit = cache.get(base);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rates;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase
      .from("currency_rates")
      .select("target_currency,rate")
      .eq("base_currency", base);
    if (error) throw error;
    const rates: Record<string, number> = {};
    for (const row of data || []) {
      const r = Number(row.rate);
      if (Number.isFinite(r) && r > 0) rates[row.target_currency] = r;
    }
    if (Object.keys(rates).length) cache.set(base, { rates, at: Date.now() });
    return rates;
  } catch (e) {
    console.error("[fxConvert] rate lookup failed", base, String(e));
    return {};
  }
}

export async function convertCents(cents: number, from: string, to: string): Promise<number> {
  const src = (from || "usd").toUpperCase();
  const tgt = (to || "usd").toUpperCase();
  if (src === tgt) return cents;
  const live = Number((await ratesFor(src))[tgt]);
  const rate = Number.isFinite(live) && live > 0 ? live : FALLBACK[`${src}_${tgt}`] ?? 1;
  return Math.round(cents * rate);
}
