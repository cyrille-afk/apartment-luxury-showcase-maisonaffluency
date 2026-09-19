/**
 * Configurable consumption-tax (GST / VAT) rules for checkout.
 *
 * A rule only applies when BOTH the destination country and the order
 * currency match — exports and foreign-currency orders stay zero-rated.
 * Keep this file in sync with `supabase/functions/_shared/taxRules.ts`,
 * which the payment function uses to compute the amount actually charged.
 *
 * Treatments
 * ----------
 *  standard            tax is charged at checkout at the rule rate
 *  b2b_zero_rated      SG GST-registered buyer supplied a valid UEN
 *  reverse_charge      GB (and future EU) B2B buyer supplied a valid VAT no.
 *                      — no VAT charged; the buyer accounts for it
 *  export_zero_rated   consignment above the destination's low-value
 *                      threshold — import VAT and duty are assessed at the
 *                      border and settled by the importer of record
 *  none                no rule matches the destination / currency pair
 */
export type BuyerType = "private" | "business";

export const B2B_TAX_LABEL = "Tax (B2B Zero-Rated)";

export type TaxTreatment =
  | "standard"
  | "b2b_zero_rated"
  | "reverse_charge"
  | "export_zero_rated"
  | "none";

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
  /** Merchant tax-registration number printed on receipts/confirmations. */
  registrationNumber?: string;
  /** Field label for the buyer's own registration, e.g. "UK VAT Number". */
  buyerIdLabel?: string;
  /** Accepted format for the buyer's registration number. */
  buyerIdPattern?: RegExp;
  /** Helper text shown under the buyer registration field. */
  buyerIdHint?: string;
  /** Registered business + valid id ⇒ reverse charge (buyer accounts for tax). */
  reverseCharge?: boolean;
  /** Registered business + valid id ⇒ zero-rated on our invoice (SG B2B). */
  b2bZeroRated?: boolean;
  /**
   * Consignment goods value (minor units, rule currency) above which the
   * supply is an export: no tax at checkout, import tax at the border.
   */
  lowValueThresholdCents?: number;
  /** Border wording used when the consignment exceeds the threshold. */
  borderNote?: string;
}

export const TAX_RULES: TaxRule[] = [
  {
    country: "SG",
    currencies: ["sgd"],
    rate: 0.09,
    name: "GST",
    // GST applies to the full CIF value — goods AND delivery/freight are
    // inside the 9% tax loop.
    taxShipping: true,
    registrationNumber: "UEN 201717288Z",
    buyerIdLabel: "Singapore GST / UEN Number",
    buyerIdPattern: /^(\d{9}[A-Z]|[TSPR]\d{2}[A-Z]{2}\d{4}[A-Z])$/,
    buyerIdHint: "Enter a valid Singapore UEN (e.g., 201717288Z).",
    b2bZeroRated: true,
  },
  {
    country: "GB",
    currencies: ["gbp"],
    rate: 0.2,
    name: "VAT",
    // UK VAT on an imported consignment is charged on goods and delivery.
    taxShipping: true,
    buyerIdLabel: "UK VAT Number",
    // GB + 9 digits, or 12 digits for branch traders; prefix optional.
    buyerIdPattern: /^(GB)?(\d{9}|\d{12})$/,
    buyerIdHint: "Enter a valid UK VAT number (9 digits, optionally prefixed GB).",
    reverseCharge: true,
    // HMRC low-value consignment rule: at or below £135 UK VAT is charged at
    // the point of sale; above it, VAT and duty are assessed at import.
    lowValueThresholdCents: 13_500,
    borderNote:
      "Zero-rated export. UK import VAT (20%) and any duty are assessed on the consignment at the border by HMRC and settled by the importer of record.",
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

/** Line printed on receipts, e.g. "GST Reg. No. UEN 201717288Z". */
export const taxRegistrationLine = (rule: TaxRule | null | undefined): string | null =>
  rule?.registrationNumber ? `${rule.name} Reg. No. ${rule.registrationNumber}` : null;

/** Normalised (upper-case, unspaced) buyer registration number. */
export const normaliseBuyerTaxId = (value: string | null | undefined): string =>
  (value || "").replace(/[\s-]/g, "").trim().toUpperCase();

/** Whether the buyer's registration number matches the destination format. */
export const isBuyerTaxIdValid = (
  rule: TaxRule | null | undefined,
  value: string | null | undefined,
): boolean => {
  const id = normaliseBuyerTaxId(value);
  if (!rule?.buyerIdPattern || !id) return false;
  return rule.buyerIdPattern.test(id);
};

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

export interface TaxTreatmentInput {
  country: string | null | undefined;
  currency: string | null | undefined;
  buyerType: BuyerType | string | null | undefined;
  buyerTaxId: string | null | undefined;
  /** Goods value after discount, minor units. */
  goodsCents: number;
  /** Delivery included in the taxable base, minor units. */
  shippingCents: number;
}

export interface TaxTreatmentResult {
  rule: TaxRule | null;
  treatment: TaxTreatment;
  /** Effective rate charged at checkout (0 when not charged). */
  rate: number;
  taxCents: number;
  taxableBaseCents: number;
  /** Summary row label. */
  label: string;
  /** Whether a tax row amount should be shown rather than "—". */
  charged: boolean;
  /** Plain-language explanation shown at checkout. */
  note: string;
  /** Invoice-grade statement printed on documents and emails. */
  statement: string;
  /** Normalised buyer registration number, when valid. */
  buyerTaxId: string | null;
  /** Merchant registration line, when we charge under our own registration. */
  registrationLine: string | null;
  countryIso: string | null;
}

/**
 * Single authority for what tax is charged, why, and what the invoice must
 * say. The checkout summary, the PaymentIntent, the order record, the emails
 * and the PDFs all read from this one result.
 */
export const resolveTaxTreatment = (input: TaxTreatmentInput): TaxTreatmentResult => {
  const countryIso = (input.country || "").trim().toUpperCase() || null;
  const currency = (input.currency || "").trim().toUpperCase();
  const rule = resolveTaxRule(countryIso, currency);
  const goodsCents = Math.max(0, Math.round(input.goodsCents || 0));
  const shippingCents = Math.max(0, Math.round(input.shippingCents || 0));
  const isBusiness = String(input.buyerType || "").toLowerCase() === "business";
  const idValid = isBuyerTaxIdValid(rule, input.buyerTaxId);
  const buyerTaxId = idValid ? normaliseBuyerTaxId(input.buyerTaxId) : null;

  const base = (r: TaxRule) => goodsCents + (r.taxShipping ? shippingCents : 0);

  if (!rule) {
    return {
      rule: null,
      treatment: "none",
      rate: 0,
      taxCents: 0,
      taxableBaseCents: 0,
      label: "Tax (zero-rated)",
      charged: false,
      note: countryIso
        ? `Zero-rated — no ${currency || "order"} tax rule applies to shipments to ${countryIso}.`
        : "Select a destination country to see whether tax applies.",
      statement: countryIso
        ? "Zero-rated supply. Any import tax or duty assessed in the destination country is payable by the importer of record."
        : "Tax is determined once the delivery destination is confirmed.",
      buyerTaxId: isBusiness ? normaliseBuyerTaxId(input.buyerTaxId) || null : null,
      registrationLine: null,
      countryIso,
    };
  }

  // Above the destination's low-value consignment threshold the supply is an
  // export: nothing is charged here and the border assesses import tax.
  if (rule.lowValueThresholdCents && goodsCents > rule.lowValueThresholdCents) {
    return {
      rule,
      treatment: "export_zero_rated",
      rate: 0,
      taxCents: 0,
      taxableBaseCents: 0,
      label: `${rule.name} (Assessed at Import)`,
      charged: false,
      note: rule.borderNote ?? `${rule.name} is assessed at the border on import.`,
      statement: rule.borderNote ?? `${rule.name} is assessed at the border on import.`,
      buyerTaxId: buyerTaxId ?? (isBusiness ? normaliseBuyerTaxId(input.buyerTaxId) || null : null),
      registrationLine: null,
      countryIso,
    };
  }

  if (isBusiness && idValid && rule.reverseCharge) {
    return {
      rule,
      treatment: "reverse_charge",
      rate: 0,
      taxCents: 0,
      taxableBaseCents: base(rule),
      label: `${rule.name} (Reverse Charge)`,
      charged: false,
      note: `${rule.name} reverse charge — you account for ${rule.name} on your own return. Buyer ${rule.name} No. ${buyerTaxId}.`,
      statement: `${rule.name} reverse charge: the customer is liable to account for ${rule.name} to the destination tax authority. Buyer ${rule.name} No. ${buyerTaxId}.`,
      buyerTaxId,
      registrationLine: null,
      countryIso,
    };
  }

  if (isBusiness && idValid && rule.b2bZeroRated) {
    return {
      rule,
      treatment: "b2b_zero_rated",
      rate: 0,
      taxCents: 0,
      taxableBaseCents: base(rule),
      label: B2B_TAX_LABEL,
      charged: true,
      note: `B2B zero-rated for ${rule.name}-registered businesses. You may claim the input tax on your ${rule.name} return.`,
      statement: `B2B zero-rated supply. Buyer ${rule.name} No. ${buyerTaxId}.`,
      buyerTaxId,
      registrationLine: taxRegistrationLine(rule),
      countryIso,
    };
  }

  const taxCents = computeTaxCents(goodsCents, shippingCents, rule);
  return {
    rule,
    treatment: "standard",
    rate: rule.rate,
    taxCents,
    taxableBaseCents: base(rule),
    label: taxRowLabel(rule),
    charged: true,
    note: `${rule.name} charged on ${rule.taxShipping ? "goods and delivery" : "goods"} for ${countryIso} orders billed in ${currency}.`,
    statement: `${taxRowLabel(rule)} charged on ${rule.taxShipping ? "goods and delivery" : "goods"} at the point of sale.`,
    buyerTaxId: isBusiness ? normaliseBuyerTaxId(input.buyerTaxId) || null : null,
    registrationLine: taxRegistrationLine(rule),
    countryIso,
  };
};

/** Buyer-type toggle label for a destination, e.g. "VAT-Registered Business". */
export const businessToggleLabel = (rule: TaxRule | null | undefined): string =>
  rule?.buyerIdLabel ? `${rule.name}-Registered Business` : "Registered Business";
