/**
 * Quote FX lock.
 *
 * A quote is priced once and must never re-price itself. When a quote is
 * created — or its currency is changed before it is sent — we read the rate
 * from the platform rate table (`currency_rates`, synced server-side twice
 * daily) and stamp it onto the quote row. Every later view, PDF and email
 * reads the stamped rate, so the number the client sees cannot drift.
 *
 * The catalogue base is EUR, so the stored rate is EUR → quote currency.
 */

import { supabase } from "@/integrations/supabase/client";
import { getFxRate } from "@/lib/fxRates";

export const QUOTE_FX_BASE_CURRENCY = "EUR";

export interface QuoteFxLock {
  rate: number;
  baseCurrency: string;
  lockedAt: string;
}

/** Stamp the current rate onto the quote. Never throws. */
export async function lockQuoteExchangeRate(
  quoteId: string,
  quoteCurrency: string,
  base: string = QUOTE_FX_BASE_CURRENCY,
): Promise<QuoteFxLock | null> {
  try {
    const target = (quoteCurrency || base).toUpperCase();
    const rate = await getFxRate(base, target);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    const lockedAt = new Date().toISOString();
    const { error } = await supabase
      .from("trade_quotes")
      .update({
        exchange_rate_at_creation: rate,
        exchange_rate_base_currency: base,
        exchange_rate_locked_at: lockedAt,
      } as never)
      .eq("id", quoteId);
    if (error) {
      console.error("[quoteFxLock] could not stamp rate", error);
      return null;
    }
    return { rate, baseCurrency: base, lockedAt };
  } catch (e) {
    console.error("[quoteFxLock] unexpected", e);
    return null;
  }
}

/** Read a quote's locked rate, if one has been stamped. */
export async function readQuoteExchangeRate(quoteId: string): Promise<QuoteFxLock | null> {
  const { data } = await supabase
    .from("trade_quotes")
    .select("exchange_rate_at_creation, exchange_rate_base_currency, exchange_rate_locked_at")
    .eq("id", quoteId)
    .maybeSingle();
  const rate = Number((data as { exchange_rate_at_creation?: number } | null)?.exchange_rate_at_creation);
  if (!data || !Number.isFinite(rate) || rate <= 0) return null;
  const row = data as {
    exchange_rate_base_currency?: string | null;
    exchange_rate_locked_at?: string | null;
  };
  return {
    rate,
    baseCurrency: (row.exchange_rate_base_currency || QUOTE_FX_BASE_CURRENCY).toUpperCase(),
    lockedAt: row.exchange_rate_locked_at || "",
  };
}
