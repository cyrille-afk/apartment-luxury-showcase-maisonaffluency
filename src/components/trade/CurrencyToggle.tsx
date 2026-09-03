import { useState, useEffect, useCallback } from "react";

export type DisplayCurrency = "original" | "SGD" | "EUR" | "USD" | "GBP" | "CHF" | "AED" | "HKD" | "AUD";

const SUPPORTED_CURRENCIES: DisplayCurrency[] = ["SGD", "EUR", "USD", "GBP", "CHF", "AED", "HKD", "AUD"];

/** Cache live rates so multiple components don't re-fetch */
let _rateCache: { rates: Record<string, number>; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function fetchLiveRates(): Promise<Record<string, number>> {
  if (_rateCache && Date.now() - _rateCache.ts < CACHE_TTL) return _rateCache.rates;

  const rates: Record<string, number> = {};
  // Fetch rates from each currency to all others
  await Promise.all(
    SUPPORTED_CURRENCIES.map(async (src) => {
      const targets = SUPPORTED_CURRENCIES.filter((c) => c !== src).join(",");
      try {
        const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${src}&symbols=${targets}`);
        const data = await res.json();
        if (data.rates) {
          for (const [tgt, rate] of Object.entries(data.rates)) {
            rates[`${src}_${tgt}`] = rate as number;
          }
        }
      } catch {
        // silently fail — fallback rates used
      }
    })
  );

  // Self-rates
  for (const c of SUPPORTED_CURRENCIES) rates[`${c}_${c}`] = 1;

  if (Object.keys(rates).length > SUPPORTED_CURRENCIES.length) {
    _rateCache = { rates, ts: Date.now() };
  }
  return rates;
}

/** Hardcoded fallback if API is unreachable (approximate, last reviewed 2026-09-03) */
const FALLBACK_RATES: Record<string, number> = {
  // self
  SGD_SGD: 1, EUR_EUR: 1, USD_USD: 1, GBP_GBP: 1, CHF_CHF: 1, AED_AED: 1, HKD_HKD: 1, AUD_AUD: 1,
  // EUR base
  EUR_SGD: 1.473, EUR_USD: 1.1583, EUR_GBP: 0.8589, EUR_CHF: 0.9421, EUR_AED: 4.2538, EUR_HKD: 9.083, EUR_AUD: 1.6178,
  // USD base
  USD_EUR: 0.8633, USD_SGD: 1.2717, USD_GBP: 0.7416, USD_CHF: 0.8134, USD_AED: 3.6725, USD_HKD: 7.8418, USD_AUD: 1.3967,
  // SGD base
  SGD_EUR: 0.6789, SGD_USD: 0.7863, SGD_GBP: 0.5831, SGD_CHF: 0.6396, SGD_AED: 2.8878, SGD_HKD: 6.1663, SGD_AUD: 1.0983,
  // GBP base
  GBP_EUR: 1.1642, GBP_USD: 1.3485, GBP_SGD: 1.7149, GBP_CHF: 1.0968, GBP_AED: 4.9523, GBP_HKD: 10.5746, GBP_AUD: 1.8834,
  // CHF base
  CHF_EUR: 1.0614, CHF_USD: 1.2294, CHF_SGD: 1.5635, CHF_GBP: 0.9117, CHF_AED: 4.5151, CHF_HKD: 9.641, CHF_AUD: 1.7171,
  // AED base
  AED_EUR: 0.2351, AED_USD: 0.2723, AED_SGD: 0.3463, AED_GBP: 0.2019, AED_CHF: 0.2215, AED_HKD: 2.1353, AED_AUD: 0.3803,
  // HKD base
  HKD_EUR: 0.1101, HKD_USD: 0.1275, HKD_SGD: 0.1622, HKD_GBP: 0.0946, HKD_CHF: 0.1037, HKD_AED: 0.4683, HKD_AUD: 0.1781,
  // AUD base
  AUD_EUR: 0.6181, AUD_USD: 0.716, AUD_SGD: 0.9105, AUD_GBP: 0.5309, AUD_CHF: 0.5824, AUD_AED: 2.6294, AUD_HKD: 5.6146,
};

/** Hook to access live FX rates */
export function useFxRates() {
  const [rates, setRates] = useState<Record<string, number>>(
    _rateCache?.rates ?? FALLBACK_RATES
  );

  useEffect(() => {
    fetchLiveRates().then((r) => {
      // Merge live rates over fallbacks so a partial/failed API response
      // never wipes out the cross-currency conversion table.
      setRates((prev) => ({ ...FALLBACK_RATES, ...prev, ...r }));
    });
  }, []);

  return rates;
}

/** Get the timestamp (ms since epoch) of the last successful FX rate fetch, or null */
export function getFxRatesFetchedAt(): number | null {
  return _rateCache?.ts ?? null;
}

/** Convert cents using a rates map */
export function convertCents(
  cents: number,
  fromCurrency: string,
  toCurrency: DisplayCurrency,
  rates: Record<string, number>,
): number {
  if (toCurrency === "original" || toCurrency === fromCurrency) return cents;
  const key = `${fromCurrency}_${toCurrency}`;
  const rate = rates[key];
  if (!rate) return cents; // unconverted fallback
  return Math.round(cents * rate);
}

/** Price unit suffixes for display */
const PRICE_UNIT_SUFFIX: Record<string, string> = {
  per_piece: "",
  per_sqm: "/m²",
  per_lm: "/lm",
};

/** Format cents as a price string, converting via live rates */
export function formatPriceConverted(
  cents: number,
  originalCurrency: string,
  displayCurrency: DisplayCurrency,
  rates: Record<string, number>,
  priceUnit?: string,
): string {
  const targetCurrency = displayCurrency === "original" ? originalCurrency : displayCurrency;
  const targetCents = convertCents(cents, originalCurrency, displayCurrency, rates);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: targetCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(targetCents / 100);
  const suffix = priceUnit ? (PRICE_UNIT_SUFFIX[priceUnit] ?? "") : "";
  return formatted + suffix;
}

const OPTIONS: { value: DisplayCurrency; label: string }[] = [
  { value: "original", label: "Original" },
  ...SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c })),
];

/** Currencies kept inline on compact toggles (in addition to "Original"
 *  and the user's current selection). All others move into the dropdown. */
const COMPACT_INLINE: DisplayCurrency[] = ["original", "EUR", "USD"];

interface CurrencyToggleProps {
  value: DisplayCurrency;
  onChange: (v: DisplayCurrency) => void;
  className?: string;
  /**
   * When true, only Original / EUR / USD (plus the active selection if it's
   * something else) render as inline pills; remaining currencies are tucked
   * behind a "More ▾" dropdown. Used on dense surfaces like product pages.
   */
  compact?: boolean;
}

export default function CurrencyToggle({ value, onChange, className = "", compact = false }: CurrencyToggleProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!compact || !menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest("[data-currency-menu]")) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [compact, menuOpen]);

  if (!compact) {
    return (
      <div className={`flex items-center gap-1 border border-border rounded-md p-0.5 ${className}`}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2 py-1 text-xs font-body rounded transition-colors ${
              value === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  // Compact mode: inline = COMPACT_INLINE ∪ {active}; rest → dropdown.
  const inlineSet = new Set<DisplayCurrency>([...COMPACT_INLINE, value]);
  const inlineOpts = OPTIONS.filter((o) => inlineSet.has(o.value));
  const overflowOpts = OPTIONS.filter((o) => !inlineSet.has(o.value));
  const activeInOverflow = overflowOpts.some((o) => o.value === value);

  return (
    <div
      data-currency-menu
      className={`relative flex items-center gap-1 border border-border rounded-md p-0.5 ${className}`}
    >
      {inlineOpts.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 text-xs font-body rounded transition-colors ${
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
      {overflowOpts.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`px-2 py-1 text-xs font-body rounded transition-colors inline-flex items-center gap-0.5 ${
              activeInOverflow
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            More
            <span aria-hidden="true" className="text-[9px] leading-none">▾</span>
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 z-50 min-w-[6rem] rounded-md border border-border bg-background shadow-lg p-1"
            >
              {overflowOpts.map((opt) => (
                <button
                  key={opt.value}
                  role="menuitem"
                  onClick={() => {
                    onChange(opt.value);
                    setMenuOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1 text-xs font-body rounded transition-colors ${
                    value === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
