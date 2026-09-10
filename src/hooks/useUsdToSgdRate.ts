import { useEffect, useState } from "react";

/**
 * Live USD→SGD exchange rate for Singapore cross-border checkout rules.
 *
 * Fetches the current rate from open.er-api.com (free, CORS-friendly, no key).
 * The hook always resolves to a usable rate: while loading or after any
 * failure it falls back to the hardcoded BASELINE_USD_TO_SGD rate (1.35) so
 * checkout is never blocked. Rates are cached in-memory for 10 minutes.
 */

export const BASELINE_USD_TO_SGD = 1.35;
const ER_API_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_TTL = 10 * 60 * 1000;

type CacheEntry = { rate: number; ts: number };
let cache: CacheEntry | null = null;

export interface UsdToSgdRateState {
  /** Rate to multiply USD amounts by to get SGD. Never null/0. */
  rate: number;
  loading: boolean;
  /** Error message when the live fetch failed (rate is the baseline). */
  error: string | null;
  /** "live" when er-api.com answered, "baseline" when using the fallback. */
  source: "live" | "baseline";
}

export function useUsdToSgdRate(): UsdToSgdRateState {
  const [state, setState] = useState<UsdToSgdRateState>(() => ({
    rate: cache?.rate ?? BASELINE_USD_TO_SGD,
    loading: !cache || Date.now() - cache.ts >= CACHE_TTL,
    error: null,
    source: cache && Date.now() - cache.ts < CACHE_TTL ? "live" : "baseline",
  }));

  useEffect(() => {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      setState({ rate: cache.rate, loading: false, error: null, source: "live" });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    (async () => {
      try {
        const res = await fetch(ER_API_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rate = data?.rates?.SGD;
        if (typeof rate !== "number" || rate <= 0) throw new Error("No SGD rate in response");
        cache = { rate, ts: Date.now() };
        if (!cancelled) setState({ rate, loading: false, error: null, source: "live" });
      } catch (e) {
        if (!cancelled) {
          setState({
            rate: cache?.rate ?? BASELINE_USD_TO_SGD,
            loading: false,
            error: e instanceof Error ? e.message : "Rate fetch failed",
            source: "baseline",
          });
        }
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return state;
}
