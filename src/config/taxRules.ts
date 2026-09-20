/**
 * Consumption-tax (GST / VAT) engine for checkout, billing and invoicing.
 *
 * Maison Affluency is established in Singapore (UEN 201717288Z) and holds no
 * UK VAT, EU OSS or IOSS registration. Cross-border UK/EU sales are therefore
 * handled under an absolute **Import DDP** model: the destination VAT rate is
 * charged to the buyer at checkout, a budgeted carrier clearance fee is added,
 * and the consignment is flagged for the carrier to clear customs on our
 * behalf under their own import facilities.
 *
 * Design rules
 * ------------
 *  - Rules match on the DESTINATION COUNTRY only. Currency never changes the
 *    tax outcome (a GB buyer paying EUR is still a UK supply).
 *  - Ship-from country is evaluated: intra-EU movements follow OSS logic,
 *    third-country movements follow import logic.
 *  - Reverse charge / B2B zero-rating requires a registration number VERIFIED
 *    by the validation API (`buyerTaxIdVerified`). A regex match alone never
 *    removes tax.
 *
 * Keep this file byte-compatible with `supabase/functions/_shared/taxRules.ts`
 * (mirror below the header) — it must stay dependency-free.
 *
 * Treatments
 * ----------
 *  standard            domestic supply taxed at the rule rate (Singapore)
 *  oss_intra_eu        goods move inside the EU — destination rate under OSS
 *  ioss                EU consignment ≤ €150 under the IOSS framework
 *  ddp_import          import DDP — destination VAT prepaid + clearance fee
 *  reverse_charge      verified B2B registration; buyer accounts for the tax
 *  b2b_zero_rated      SG GST-registered buyer supplied a verified UEN
 *  export_zero_rated   nothing charged here; tax assessed at the border
 *  none                no rule matches the destination
 */
export type BuyerType = "private" | "business";

export const B2B_TAX_LABEL = "Tax (B2B Zero-Rated)";

export type TaxTreatment =
  | "standard"
  | "oss_intra_eu"
  | "ioss"
  | "ddp_import"
  | "b2b_zero_rated"
  | "reverse_charge"
  | "export_zero_rated"
  | "none";

/** Merchant registrations we actually hold. `null` = not registered. */
export const MERCHANT_TAX_IDENTIFIERS = {
  /** Singapore UEN — our only active registration. */
  sgUen: "UEN 201717288Z" as string | null,
  /** UK VAT registration — not held; UK sales run as carrier-cleared DDP. */
  ukVat: null as string | null,
  /** EU Import One-Stop Shop — not held; EU sales run as carrier-cleared DDP. */
  ioss: null as string | null,
  /** EU One-Stop Shop (intra-EU distance selling) — not held. */
  euOss: null as string | null,
};

/**
 * How an EU consignment reaches the buyer.
 *  CARRIER_DDP    the forwarder imports on our behalf; destination VAT is
 *                 prepaid at checkout and a flat clearance fee is charged.
 *  MERCHANT_IOSS  we account for the VAT ourselves under our own IOSS
 *                 registration; no carrier clearance fee, and the IOSS number
 *                 travels on the electronic customs manifest.
 */
export type CustomsRoute = "CARRIER_DDP" | "MERCHANT_IOSS";

/**
 * Interim routing switch. Today every EU consignment — below and above €150 —
 * leaves Singapore under the carrier-backed DDP channel, because we hold no
 * IOSS registration. The moment one is obtained, flip
 * `processIossViaMerchant` on and supply the number; the engine then splits
 * low-value B2C consignments onto the IOSS route by itself.
 *
 * Runtime configured rather than read from the environment here, so this file
 * stays dependency-free and identical on the server and in the browser.
 */
export interface IossRoutingConfig {
  processIossViaMerchant: boolean;
  euIossNumber: string | null;
}

const iossRouting: IossRoutingConfig = {
  processIossViaMerchant: false,
  euIossNumber: null,
};

export const configureIossRouting = (patch: Partial<IossRoutingConfig>): void => {
  if (typeof patch.processIossViaMerchant === "boolean") {
    iossRouting.processIossViaMerchant = patch.processIossViaMerchant;
  }
  if (patch.euIossNumber !== undefined) {
    const n = (patch.euIossNumber || "").trim().toUpperCase();
    iossRouting.euIossNumber = n || null;
  }
};

export const getIossRouting = (): IossRoutingConfig => ({ ...iossRouting });

/**
 * The IOSS identifier to charge under, or `null` when the merchant route is
 * off or unconfigured. Both conditions must hold — a number without the switch
 * (or a switch without a number) keeps every consignment on carrier DDP.
 */
export const merchantIossNumber = (): string | null =>
  iossRouting.processIossViaMerchant && iossRouting.euIossNumber
    ? iossRouting.euIossNumber
    : null;

/** IOSS applies to consignments with an intrinsic value at or below €150. */
export const IOSS_THRESHOLD_EUR_CENTS = 150_00;
/** HMRC low-value consignment threshold: £135. */
export const UK_LOW_VALUE_THRESHOLD_GBP_CENTS = 135_00;

/** EU-27 standard VAT rates (destination B2C), as fractions. */
export const EU_VAT_RATES: Record<string, number> = {
  AT: 0.2, BE: 0.21, BG: 0.2, CY: 0.19, CZ: 0.21, DE: 0.19, DK: 0.25,
  EE: 0.22, ES: 0.21, FI: 0.255, FR: 0.2, GR: 0.24, HR: 0.25, HU: 0.27,
  IE: 0.23, IT: 0.22, LT: 0.21, LU: 0.17, LV: 0.21, MT: 0.18, NL: 0.21,
  PL: 0.23, PT: 0.23, RO: 0.21, SE: 0.25, SI: 0.22, SK: 0.23,
};

export const EU_COUNTRIES = Object.keys(EU_VAT_RATES);

export const isEuCountry = (iso: string | null | undefined): boolean =>
  !!iso && Object.prototype.hasOwnProperty.call(EU_VAT_RATES, iso.trim().toUpperCase());

/**
 * Budgeted carrier customs-clearance fee charged on DDP consignments, in the
 * minor units of the destination's own currency band. Flat by design: the
 * forwarder invoices a fixed brokerage per consignment.
 */
export const DDP_CLEARANCE_FEE_CENTS = {
  EU: 45_00,
  GB: 40_00,
};

/** EU VAT number formats, keyed by country prefix. */
const EU_VAT_PATTERNS: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/, BE: /^BE0?\d{9,10}$/, BG: /^BG\d{9,10}$/, CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/, DE: /^DE\d{9}$/, DK: /^DK\d{8}$/, EE: /^EE\d{9}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, FI: /^FI\d{8}$/, FR: /^FR[A-Z0-9]{2}\d{9}$/,
  GR: /^(EL|GR)\d{9}$/, HR: /^HR\d{11}$/, HU: /^HU\d{8}$/, IE: /^IE(\d{7}[A-W][A-I]?|\d[A-Z+*]\d{5}[A-W])$/,
  IT: /^IT\d{11}$/, LT: /^LT(\d{9}|\d{12})$/, LU: /^LU\d{8}$/, LV: /^LV\d{11}$/,
  MT: /^MT\d{8}$/, NL: /^NL\d{9}B\d{2}$/, PL: /^PL\d{10}$/, PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/, SE: /^SE\d{12}$/, SI: /^SI\d{8}$/, SK: /^SK\d{10}$/,
};

export interface TaxRule {
  /** ISO 3166-1 alpha-2 destination country the rule applies to. */
  country: string;
  /** Regulatory family the destination belongs to. */
  region: "SG" | "GB" | "EU";
  /** Tax rate as a fraction (0.09 = 9%). */
  rate: number;
  /** Row label prefix shown in the order summary, e.g. "GST". */
  name: string;
  /** Whether freight is taxable alongside the goods. */
  taxShipping: boolean;
  /** Merchant tax-registration number printed on receipts, when we hold one. */
  registrationNumber?: string | null;
  /** Field label for the buyer's own registration, e.g. "UK VAT Number". */
  buyerIdLabel?: string;
  /** Accepted format for the buyer's registration number (pre-check only). */
  buyerIdPattern?: RegExp;
  /** Helper text shown under the buyer registration field. */
  buyerIdHint?: string;
  /** Verified registration ⇒ reverse charge (buyer accounts for tax). */
  reverseCharge?: boolean;
  /** Verified registration ⇒ zero-rated on our invoice (SG B2B). */
  b2bZeroRated?: boolean;
  /**
   * Consignment value (minor units of the threshold currency) at or below
   * which the simplified import scheme (IOSS / UK LVC) applies.
   */
  lowValueThresholdCents?: number;
  /** Flat carrier clearance fee added on DDP consignments. */
  clearanceFeeCents?: number;
  /** Border wording used for deferred/DDP consignments. */
  borderNote?: string;
}

const euRule = (country: string, rate: number): TaxRule => ({
  country,
  region: "EU",
  rate,
  name: "VAT",
  // Import VAT is assessed on the CIF value — goods plus freight.
  taxShipping: true,
  // No standing EU registration is printed on the rule: the routing branch
  // decides between the carrier DDP line and our own IOSS number.
  registrationNumber: null,
  buyerIdLabel: "EU VAT Number",
  buyerIdPattern: EU_VAT_PATTERNS[country],
  buyerIdHint: `Enter a valid ${country} VAT number, including the country prefix.`,
  reverseCharge: true,
  lowValueThresholdCents: IOSS_THRESHOLD_EUR_CENTS,
  clearanceFeeCents: DDP_CLEARANCE_FEE_CENTS.EU,
  borderNote:
    "Delivered Duty Paid. Destination VAT is collected at checkout and the carrier clears the consignment through customs on the seller's behalf.",
});

export const TAX_RULES: TaxRule[] = [
  {
    country: "SG",
    region: "SG",
    rate: 0.09,
    name: "GST",
    // GST applies to the full CIF value — goods AND delivery/freight.
    taxShipping: true,
    registrationNumber: MERCHANT_TAX_IDENTIFIERS.sgUen,
    buyerIdLabel: "Singapore GST / UEN Number",
    buyerIdPattern: /^(\d{9}[A-Z]|[TSPR]\d{2}[A-Z]{2}\d{4}[A-Z])$/,
    buyerIdHint: "Enter a valid Singapore UEN (e.g., 201717288Z).",
    b2bZeroRated: true,
  },
  {
    country: "GB",
    region: "GB",
    rate: 0.2,
    name: "VAT",
    taxShipping: true,
    registrationNumber: MERCHANT_TAX_IDENTIFIERS.ukVat,
    buyerIdLabel: "UK VAT Number",
    // GB + 9 digits, or 12 digits for branch traders; prefix optional.
    buyerIdPattern: /^(GB)?(\d{9}|\d{12})$/,
    buyerIdHint: "Enter a valid UK VAT number (9 digits, optionally prefixed GB).",
    reverseCharge: true,
    lowValueThresholdCents: UK_LOW_VALUE_THRESHOLD_GBP_CENTS,
    clearanceFeeCents: DDP_CLEARANCE_FEE_CENTS.GB,
    borderNote:
      "Delivered Duty Paid. UK VAT is collected at checkout and the carrier clears the consignment through HMRC on the seller's behalf.",
  },
  ...EU_COUNTRIES.map((c) => euRule(c, EU_VAT_RATES[c])),
];

/**
 * Returns the rule for a destination country. Currency-independent by design:
 * the second argument is accepted for call-site compatibility and ignored.
 */
export const resolveTaxRule = (
  country: string | null | undefined,
  _currency?: string | null,
): TaxRule | null => {
  const c = (country || "").trim().toUpperCase();
  if (!c) return null;
  return TAX_RULES.find((r) => r.country === c && r.rate > 0) ?? null;
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

/**
 * Format pre-check only. Passing this NEVER removes tax on its own — the
 * treatment engine additionally requires `buyerTaxIdVerified`.
 */
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

/** A single cart line as far as customs is concerned. */
export interface CustomsLine {
  /** Harmonised System 6-digit code, e.g. "940161". */
  hs6Code?: string | null;
  /** Ad-valorem duty rate as a fraction, e.g. 0.027. */
  dutyRate?: number | null;
  /** ISO-2 country the goods physically ship from. */
  originCountry?: string | null;
  /** Line value after discount, minor units of the order currency. */
  lineTotalCents: number;
}

export interface TaxTreatmentInput {
  country: string | null | undefined;
  currency: string | null | undefined;
  buyerType: BuyerType | string | null | undefined;
  buyerTaxId: string | null | undefined;
  /**
   * True only when the registration number was confirmed by VIES / the UK
   * validation API. Required for reverse charge and B2B zero-rating.
   */
  buyerTaxIdVerified?: boolean;
  /** Goods value after discount, minor units of the order currency. */
  goodsCents: number;
  /** Delivery included in the taxable base, minor units. */
  shippingCents: number;
  /**
   * Goods value converted to EUR minor units. Used for the €150 IOSS gate.
   * Falls back to `goodsCents` when not supplied.
   */
  goodsEurCents?: number | null;
  /** ISO-2 country the consignment ships FROM (mixed origins → see lines). */
  shipFromCountry?: string | null;
  /** Per-line customs manifest used for duty and mixed-origin resolution. */
  lines?: CustomsLine[];
}

export interface TaxTreatmentResult {
  rule: TaxRule | null;
  treatment: TaxTreatment;
  /** Effective rate charged at checkout (0 when not charged). */
  rate: number;
  taxCents: number;
  taxableBaseCents: number;
  /** Flat carrier clearance fee charged alongside the tax on DDP orders. */
  clearanceFeeCents: number;
  /** Estimated ad-valorem duty from the HS6 manifest, minor units. */
  dutyCents: number;
  /** Summary row label. */
  label: string;
  /** Whether a tax row amount should be shown rather than "—". */
  charged: boolean;
  /** Plain-language explanation shown at checkout. */
  note: string;
  /** Invoice-grade statement printed on documents and emails. */
  statement: string;
  /** Normalised buyer registration number, when supplied. */
  buyerTaxId: string | null;
  /** Whether that number was confirmed by the validation API. */
  buyerTaxIdVerified: boolean;
  /** Merchant registration line, when we charge under our own registration. */
  registrationLine: string | null;
  /** Identifier stamped on the invoice for this routing (UEN / IOSS / VAT). */
  merchantTaxIdentifier: string | null;
  /** True when the consignment must be tendered to the carrier as DDP. */
  requiresDdpClearance: boolean;
  countryIso: string | null;
  shipFromCountry: string | null;
}

/** Duty estimate from the per-line HS6 manifest. */
export const computeDutyCents = (lines: CustomsLine[] | undefined | null): number => {
  if (!lines?.length) return 0;
  return lines.reduce((sum, l) => {
    const rate = Number(l.dutyRate);
    if (!Number.isFinite(rate) || rate <= 0) return sum;
    return sum + Math.round(Math.max(0, l.lineTotalCents) * rate);
  }, 0);
};

/** Resolves the effective ship-from country for a mixed-origin manifest. */
export const resolveShipFrom = (input: TaxTreatmentInput): string | null => {
  const explicit = (input.shipFromCountry || "").trim().toUpperCase();
  if (explicit) return explicit;
  const origins = (input.lines || [])
    .map((l) => (l.originCountry || "").trim().toUpperCase())
    .filter(Boolean);
  if (!origins.length) return null;
  // Mixed origins: EU origin dominates only when every line ships from the EU,
  // otherwise the consignment is treated as a third-country import.
  return origins.every((o) => isEuCountry(o)) ? origins[0] : origins.find((o) => !isEuCountry(o))!;
};

/**
 * Single authority for what tax is charged, why, and what the invoice must
 * say. The checkout summary, the PaymentIntent, the order record, the emails
 * and the PDFs all read from this one result.
 */
export const resolveTaxTreatment = (input: TaxTreatmentInput): TaxTreatmentResult => {
  const countryIso = (input.country || "").trim().toUpperCase() || null;
  const currency = (input.currency || "").trim().toUpperCase();
  const rule = resolveTaxRule(countryIso);
  const goodsCents = Math.max(0, Math.round(input.goodsCents || 0));
  const shippingCents = Math.max(0, Math.round(input.shippingCents || 0));
  const isBusiness = String(input.buyerType || "").toLowerCase() === "business";
  const normalisedId = normaliseBuyerTaxId(input.buyerTaxId) || null;
  const formatOk = isBuyerTaxIdValid(rule, input.buyerTaxId);
  // Verification is mandatory: a well-formed but unverified number is treated
  // exactly like no number at all.
  const verified = input.buyerTaxIdVerified === true && formatOk;
  const buyerTaxId = normalisedId;
  const shipFrom = resolveShipFrom(input);
  const dutyCents = computeDutyCents(input.lines);

  const base = (r: TaxRule) => goodsCents + (r.taxShipping ? shippingCents : 0);

  const shell = {
    buyerTaxId,
    buyerTaxIdVerified: verified,
    countryIso,
    shipFromCountry: shipFrom,
    dutyCents,
  };

  if (!rule) {
    return {
      ...shell,
      rule: null,
      treatment: "none",
      rate: 0,
      taxCents: 0,
      taxableBaseCents: 0,
      clearanceFeeCents: 0,
      label: "Tax (zero-rated)",
      charged: false,
      note: countryIso
        ? `Zero-rated — no destination tax rule is configured for shipments to ${countryIso}.`
        : "Select a destination country to see whether tax applies.",
      statement: countryIso
        ? "Zero-rated supply. Any import tax or duty assessed in the destination country is payable by the importer of record."
        : "Tax is determined once the delivery destination is confirmed.",
      registrationLine: null,
      merchantTaxIdentifier: null,
      requiresDdpClearance: false,
    };
  }

  // ---- Verified B2B: reverse charge / zero-rating -------------------------
  if (isBusiness && verified && rule.reverseCharge) {
    return {
      ...shell,
      rule,
      treatment: "reverse_charge",
      rate: 0,
      taxCents: 0,
      taxableBaseCents: base(rule),
      clearanceFeeCents: 0,
      label: `${rule.name} (Reverse Charge)`,
      charged: false,
      note: `${rule.name} reverse charge — verified registration ${buyerTaxId}. You account for ${rule.name} on your own return.`,
      statement: `${rule.name} reverse charge: the customer is liable to account for ${rule.name} to the destination tax authority. Buyer ${rule.name} No. ${buyerTaxId} (verified).`,
      registrationLine: null,
      merchantTaxIdentifier: MERCHANT_TAX_IDENTIFIERS.sgUen,
      requiresDdpClearance: false,
    };
  }

  if (isBusiness && verified && rule.b2bZeroRated) {
    return {
      ...shell,
      rule,
      treatment: "b2b_zero_rated",
      rate: 0,
      taxCents: 0,
      taxableBaseCents: base(rule),
      clearanceFeeCents: 0,
      label: B2B_TAX_LABEL,
      charged: true,
      note: `B2B zero-rated for ${rule.name}-registered businesses. Verified registration ${buyerTaxId}.`,
      statement: `B2B zero-rated supply. Buyer ${rule.name} No. ${buyerTaxId} (verified).`,
      registrationLine: taxRegistrationLine(rule),
      merchantTaxIdentifier: MERCHANT_TAX_IDENTIFIERS.sgUen,
      requiresDdpClearance: false,
    };
  }

  // ---- Singapore domestic supply -----------------------------------------
  if (rule.region === "SG") {
    const taxCents = computeTaxCents(goodsCents, shippingCents, rule);
    return {
      ...shell,
      rule,
      treatment: "standard",
      rate: rule.rate,
      taxCents,
      taxableBaseCents: base(rule),
      clearanceFeeCents: 0,
      label: taxRowLabel(rule),
      charged: true,
      note: `${rule.name} charged on ${rule.taxShipping ? "goods and delivery" : "goods"} for ${countryIso} orders.`,
      statement: `${taxRowLabel(rule)} charged on ${rule.taxShipping ? "goods and delivery" : "goods"} at the point of sale.`,
      registrationLine: taxRegistrationLine(rule),
      merchantTaxIdentifier: MERCHANT_TAX_IDENTIFIERS.sgUen,
      requiresDdpClearance: false,
    };
  }

  const taxCents = computeTaxCents(goodsCents, shippingCents, rule);

  // ---- Intra-EU movement: OSS (destination rate, no import step) ----------
  if (rule.region === "EU" && isEuCountry(shipFrom)) {
    const identifier = MERCHANT_TAX_IDENTIFIERS.euOss;
    return {
      ...shell,
      rule,
      treatment: "oss_intra_eu",
      rate: rule.rate,
      taxCents,
      taxableBaseCents: base(rule),
      clearanceFeeCents: 0,
      label: taxRowLabel(rule),
      charged: true,
      note: `Intra-EU supply from ${shipFrom} to ${countryIso}. ${rule.name} is charged at the destination rate under the One-Stop Shop.`,
      statement: `Intra-Community distance sale from ${shipFrom} to ${countryIso}. ${taxRowLabel(rule)} accounted for under the EU One-Stop Shop scheme.`,
      registrationLine: identifier ? `OSS Reg. No. ${identifier}` : null,
      merchantTaxIdentifier: identifier ?? MERCHANT_TAX_IDENTIFIERS.sgUen,
      requiresDdpClearance: false,
    };
  }

  // ---- Third-country import into the EU / UK ------------------------------
  const thresholdBase =
    rule.region === "EU"
      ? Math.max(0, Math.round(Number(input.goodsEurCents ?? goodsCents)))
      : goodsCents;
  const lowValue =
    !!rule.lowValueThresholdCents && thresholdBase <= rule.lowValueThresholdCents;
  const clearanceFeeCents = lowValue ? 0 : (rule.clearanceFeeCents ?? 0);

  if (rule.region === "EU" && lowValue && MERCHANT_TAX_IDENTIFIERS.ioss) {
    return {
      ...shell,
      rule,
      treatment: "ioss",
      rate: rule.rate,
      taxCents,
      taxableBaseCents: base(rule),
      clearanceFeeCents: 0,
      label: `${taxRowLabel(rule)} — IOSS`,
      charged: true,
      note: `Consignment at or below €150. ${rule.name} is collected at checkout under the Import One-Stop Shop; no further charges on delivery.`,
      statement: `Import One-Stop Shop supply. ${taxRowLabel(rule)} collected at the point of sale. IOSS identifier ${MERCHANT_TAX_IDENTIFIERS.ioss}.`,
      registrationLine: `IOSS No. ${MERCHANT_TAX_IDENTIFIERS.ioss}`,
      merchantTaxIdentifier: MERCHANT_TAX_IDENTIFIERS.ioss,
      requiresDdpClearance: false,
    };
  }

  // Absolute DDP: destination VAT prepaid at checkout, carrier clears customs
  // on our behalf, buyer receives the goods with nothing further to pay.
  return {
    ...shell,
    rule,
    treatment: "ddp_import",
    rate: rule.rate,
    taxCents,
    taxableBaseCents: base(rule),
    clearanceFeeCents,
    label: `${taxRowLabel(rule)} — Prepaid (DDP)`,
    charged: true,
    note:
      `${rule.name} for ${countryIso} is collected here and prepaid on your behalf. ` +
      (clearanceFeeCents > 0
        ? "A fixed carrier customs-clearance fee is shown separately. "
        : "") +
      "Nothing further is payable on delivery.",
    statement:
      rule.borderNote ??
      `Delivered Duty Paid. ${taxRowLabel(rule)} collected at the point of sale and remitted through the carrier's import facilities.`,
    registrationLine: taxRegistrationLine(rule),
    merchantTaxIdentifier: MERCHANT_TAX_IDENTIFIERS.sgUen,
    requiresDdpClearance: true,
  };
};

/** Buyer-type toggle label for a destination, e.g. "VAT-Registered Business". */
export const businessToggleLabel = (rule: TaxRule | null | undefined): string =>
  rule?.buyerIdLabel ? `${rule.name}-Registered Business` : "Registered Business";

/** Which validation authority a registration number must be checked against. */
export const vatValidationAuthority = (
  country: string | null | undefined,
  taxId: string | null | undefined,
): "vies" | "uk" | "sg" | null => {
  const id = normaliseBuyerTaxId(taxId);
  const iso = (country || "").trim().toUpperCase();
  if (!id) return null;
  if (id.startsWith("GB") || iso === "GB") return "uk";
  if (iso === "SG") return "sg";
  const prefix = id.slice(0, 2);
  if (isEuCountry(prefix === "EL" ? "GR" : prefix) || isEuCountry(iso)) return "vies";
  return null;
};
