export const COMPARATOR_CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type ComparatorCurrency = typeof COMPARATOR_CURRENCIES[number];

export function comparatorCurrency(value: unknown): ComparatorCurrency {
  return (COMPARATOR_CURRENCIES as readonly unknown[]).includes(value) ? value as ComparatorCurrency : "EUR";
}

export type ComparatorRates = Record<string, number>;

export function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

/** Converts with server-synced rates only; a missing pair returns null (never a bundled guess). */
export function convertComparatorCents(cents: number, from: string, to: ComparatorCurrency, rates: ComparatorRates): number | null {
  if (from === to) return cents;
  const direct = rates[`${from}_${to}`];
  if (direct > 0) return Math.round(cents * direct);
  const inverse = rates[`${to}_${from}`];
  if (inverse > 0) return Math.round(cents / inverse);
  return null;
}
