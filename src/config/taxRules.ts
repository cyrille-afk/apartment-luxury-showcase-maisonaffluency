/**
 * Configurable consumption-tax (GST / VAT) rules for checkout.
 *
 * A rule only applies when BOTH the destination country and the order
 * currency match — exports and foreign-currency orders stay zero-rated.
 * Keep this file in sync with `supabase/functions/_shared/taxRules.ts`,
 * which the payment function uses to compute the amount actually charged.
 */
export interface TaxRule {
  /** ISO 3166-1 alpha-2 destination country the rule applies to. */
  country: string;
  /** Lowercase ISO 4217 currencies the rule applies to. */
  currencies: string[];
  /** Tax rate as a fraction (0.09 = 9%). */
  rate: number;
  /** Row label prefix shown in the order summary, e.g. "GST". */
  name: string;
  /** Whether freight is taxable alongside the goods. */
  taxShipping: boolean;
}

export const TAX_RULES: TaxRule[] = [
  {
    country: "SG",
    currencies: ["sgd"],
    rate: 0.09,
    name: "GST",
    taxShipping: true,
  },
];

/** Returns the rule for a destination/currency pair, or null when zero-rated. */
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

/** Order-summary row label, e.g. "GST (9%)". */
export const taxRowLabel = (rule: TaxRule) =>
  `${rule.name} (${Number((rule.rate * 100).toFixed(2))}%)`;

/** Tax due on a taxable base, in cents. */
export const computeTaxCents = (
  goodsCents: number,
  shippingCents: number,
  rule: TaxRule | null,
): number => {
  if (!rule || rule.rate <= 0) return 0;
  const base = Math.max(0, goodsCents) + (rule.taxShipping ? Math.max(0, shippingCents) : 0);
  return Math.round(base * rule.rate);
};
