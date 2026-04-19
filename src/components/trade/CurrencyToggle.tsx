import { useState, useEffect, useCallback } from "react";

export type DisplayCurrency = "original" | "SGD" | "EUR" | "USD";

const SUPPORTED_CURRENCIES: DisplayCurrency[] = ["SGD", "EUR", "USD"];

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
        const res = await fetch(`https://api.frankfurter.app/latest?from=${src}&to=${targets}`);
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

/** Hardcoded fallback if API is unreachable */
const FALLBACK_RATES: Record<string, number> = {
  SGD_SGD: 1, EUR_EUR: 1, USD_USD: 1,
  EUR_SGD: 1.46, EUR_USD: 1.08,
  USD_SGD: 1.34, USD_EUR: 0.93,
  SGD_EUR: 0.68, SGD_USD: 0.75,
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
  { value: "SGD", label: "SGD" },
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
];

interface CurrencyToggleProps {
  value: DisplayCurrency;
  onChange: (v: DisplayCurrency) => void;
  className?: string;
}

export default function CurrencyToggle({ value, onChange, className = "" }: CurrencyToggleProps) {
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
