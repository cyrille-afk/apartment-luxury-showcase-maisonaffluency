/**
 * Server-side mirror of `src/config/taxRules.ts`.
 * The charged amount is always computed from these rules so it matches the
 * totals displayed at checkout. Keep both files in sync.
 */
export type BuyerType = "private" | "business";

export const B2B_TAX_LABEL = "Tax (B2B Zero-Rated)";

export interface TaxRule {
  country: string;
  currencies: string[];
  rate: number;
  name: string;
  taxShipping: boolean;
  registrationNumber?: string;
}

export const TAX_RULES: TaxRule[] = [
  { country: "SG", currencies: ["sgd"], rate: 0.09, name: "GST", taxShipping: true, registrationNumber: "UEN 201717288Z" },
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

/** Line printed on receipts, e.g. "GST Reg. No. UEN 201717288Z". */
export const taxRegistrationLine = (rule: TaxRule | null | undefined): string | null =>
  rule?.registrationNumber ? `${rule.name} Reg. No. ${rule.registrationNumber}` : null;

/** Accepts ACRA UEN (9 digits + letter) or other entity UEN (10 chars). */
const SG_UEN_RE = /^(\d{9}[A-Z]|[TSPR]\d{2}[A-Z]{2}\d{4}[A-Z])$/;

export const isSingaporeUenValid = (uen: string | null | undefined): boolean => {
  if (!uen) return false;
  return SG_UEN_RE.test(uen.trim().toUpperCase());
};

export const formatSingaporeUen = (uen: string | null | undefined): string | null => {
  if (!uen) return null;
  const formatted = uen.trim().toUpperCase();
  return isSingaporeUenValid(formatted) ? formatted : null;
};
