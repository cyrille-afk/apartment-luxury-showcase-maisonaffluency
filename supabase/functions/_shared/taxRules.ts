/**
 * Server-side mirror of `src/config/taxRules.ts`.
 * The charged amount is always computed from these rules so it matches the
 * totals displayed at checkout. Keep both files in sync.
 */
export interface TaxRule {
  country: string;
  currencies: string[];
  rate: number;
  name: string;
  taxShipping: boolean;
}

export const TAX_RULES: TaxRule[] = [
  { country: "SG", currencies: ["sgd"], rate: 0.09, name: "GST", taxShipping: true },
];

export const resolveTaxRule = (
  country: string | null | undefined,
  currency: string | null | undefined,
): TaxRule | null => {
  const c = (country || "").trim().toUpperCase();
  const cur = (currency || "").trim().toLowerCase();
  if (!c || !cur) return null;
  return (
    TAX_RULES.find((r) => r.country === c && r.currencies.includes(cur) && r.rate > 0) ?? null
  );
};

export const taxRowLabel = (rule: TaxRule) =>
  `${rule.name} (${Number((rule.rate * 100).toFixed(2))}%)`;

export const computeTaxCents = (
  goodsCents: number,
  shippingCents: number,
  rule: TaxRule | null,
): number => {
  if (!rule || rule.rate <= 0) return 0;
  const base = Math.max(0, goodsCents) + (rule.taxShipping ? Math.max(0, shippingCents) : 0);
  return Math.round(base * rule.rate);
};
