import { useEffect, useState } from "react";
import { getFxRate, getFxSource } from "@/lib/fxRates";

/**
 * USD→SGD exchange rate for Singapore cross-border checkout rules.
 *
 * Reads the rate from the platform rate table (`currency_rates`, synced
 * server-side twice daily) through the shared FX helper. The browser no
 * longer calls open.er-api.com directly. The hook always resolves to a usable
 * rate: on any failure it falls back to BASELINE_USD_TO_SGD (1.35) so
 * checkout is never blocked.
 */

export const BASELINE_USD_TO_SGD = 1.35;

export interface UsdToSgdRateState {
  /** Rate to multiply USD amounts by to get SGD. Never null/0. */
  rate: number;
  loading: boolean;
  /** Error message when the lookup failed (rate is the baseline). */
  error: string | null;
  /** "live" when the rate table answered, "baseline" when using the fallback. */
  source: "live" | "baseline";
}

export function useUsdToSgdRate(): UsdToSgdRateState {
  const [state, setState] = useState<UsdToSgdRateState>(() => ({
    rate: BASELINE_USD_TO_SGD,
    loading: true,
    error: null,
    source: "baseline",
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rate = await getFxRate("USD", "SGD");
        if (cancelled) return;
        const live = getFxSource("USD", "SGD") === "database";
        if (!Number.isFinite(rate) || rate <= 0) throw new Error("No SGD rate available");
        setState({
          rate,
          loading: false,
          error: null,
          source: live ? "live" : "baseline",
        });
      } catch (e) {
        if (!cancelled) {
          setState({
            rate: BASELINE_USD_TO_SGD,
            loading: false,
            error: e instanceof Error ? e.message : "Rate lookup failed",
            source: "baseline",
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}
