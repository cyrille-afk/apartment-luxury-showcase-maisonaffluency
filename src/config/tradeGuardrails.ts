/**
 * Trade guardrails — grey-market, credit and allocation controls.
 *
 * Pure decision logic shared by the browser and the edge runtime. The Deno
 * copy lives at `supabase/functions/_shared/tradeGuardrails.ts` and must stay
 * byte-identical below the import line; server-only database helpers are added
 * there, never here.
 *
 * Three independent gates:
 *  1. Net-terms credit ceiling (EUR-denominated, conservative on first order).
 *  2. Registry-vs-destination arbitrage interception for tax-relieved orders.
 *  3. Allocation caps on restricted, low-stock or artisan pieces.
 */

import { EU_COUNTRIES, type TaxTreatment } from "./taxRules";

/* ------------------------------------------------------------------ */
/* 1. Net terms credit control                                         */
/* ------------------------------------------------------------------ */

/** Conservative ceiling every newly approved trade account starts on: €10,000. */
export const DEFAULT_APPROVED_CREDIT_LIMIT_EUR_CENTS = 1_000_000;
/** Hard ceiling before an account has settled its first order: €5,000. */
export const FIRST_ORDER_CREDIT_LIMIT_EUR_CENTS = 500_000;

/** Payment terms that consume credit rather than settling up front. */
export const NET_TERMS = new Set(["net_30", "net_60", "one_percent_10_net_30"]);

export interface TradeCreditProfile {
  approved_credit_limit_eur_cents: number | null;
  first_order_limit_eur_cents: number | null;
  net_terms_enabled: boolean | null;
  settled_order_count: number | null;
  outstanding_balance_eur_cents: number | null;
}

export interface CreditDecision {
  /** Terms consume credit at all. */
  usesCredit: boolean;
  approved: boolean;
  /** Ceiling actually applied to this submission, in EUR cents. */
  limitEurCents: number;
  /** Order value plus anything already outstanding, in EUR cents. */
  exposureEurCents: number;
  status: "not_applicable" | "within_limit" | "exceeds_limit" | "first_order_restricted" | "terms_suspended";
  reason: string | null;
}

export const isNetTerms = (terms: string) => NET_TERMS.has(String(terms || "").toLowerCase());

/**
 * Decide whether a purchase order may be accepted on net terms.
 *
 * A first order is never allowed to draw the full approved allowance: until an
 * account has settled at least one invoice, the lower of the approved limit and
 * `first_order_limit_eur_cents` applies.
 */
export function evaluateCreditLimit(input: {
  paymentTerms: string;
  orderTotalEurCents: number;
  profile: TradeCreditProfile | null;
}): CreditDecision {
  const exposureBase = Math.max(0, Math.round(input.orderTotalEurCents));

  if (!isNetTerms(input.paymentTerms)) {
    return {
      usesCredit: false,
      approved: true,
      limitEurCents: 0,
      exposureEurCents: exposureBase,
      status: "not_applicable",
      reason: null,
    };
  }

  const profile = input.profile;
  const approvedLimit = Math.max(
    0,
    Math.round(Number(profile?.approved_credit_limit_eur_cents ?? DEFAULT_APPROVED_CREDIT_LIMIT_EUR_CENTS)),
  );
  const outstanding = Math.max(0, Math.round(Number(profile?.outstanding_balance_eur_cents ?? 0)));
  const settledOrders = Math.max(0, Math.round(Number(profile?.settled_order_count ?? 0)));
  const exposure = exposureBase + outstanding;

  if (profile && profile.net_terms_enabled === false) {
    return {
      usesCredit: true,
      approved: false,
      limitEurCents: 0,
      exposureEurCents: exposure,
      status: "terms_suspended",
      reason: "Net terms are currently suspended on this account. Settle by bank transfer or card, or contact your advisor.",
    };
  }

  const firstOrderCeiling = Math.max(
    0,
    Math.round(Number(profile?.first_order_limit_eur_cents ?? FIRST_ORDER_CREDIT_LIMIT_EUR_CENTS)),
  );
  const isFirstOrder = settledOrders < 1;
  const limit = isFirstOrder ? Math.min(approvedLimit, firstOrderCeiling) : approvedLimit;

  if (exposure > limit) {
    return {
      usesCredit: true,
      approved: false,
      limitEurCents: limit,
      exposureEurCents: exposure,
      status: isFirstOrder ? "first_order_restricted" : "exceeds_limit",
      reason: isFirstOrder
        ? "A first order on net terms is capped while your credit file is established. Settle this order by bank transfer or deposit, or request a credit review."
        : "This purchase order exceeds the credit allowance approved on your account. Reduce the order value, settle outstanding invoices, or request a credit review.",
    };
  }

  return {
    usesCredit: true,
    approved: true,
    limitEurCents: limit,
    exposureEurCents: exposure,
    status: "within_limit",
    reason: null,
  };
}

/* ------------------------------------------------------------------ */
/* 2. Geographic shipment enforcement                                  */
/* ------------------------------------------------------------------ */

const GCC = ["AE", "SA", "QA", "KW", "BH", "OM"];
const ASEAN = ["SG", "MY", "ID", "TH", "VN", "PH", "BN", "KH", "LA", "MM"];
const UK_TERRITORIES = ["GB", "GG", "JE", "IM"];
const NORTH_AMERICA = ["US", "CA", "MX", "PR"];

/** Delivery countries a registry is treated as operating in. */
export function operatingRegionFor(registryCountry: string): string[] {
  const iso = String(registryCountry || "").trim().toUpperCase();
  if (!iso) return [];
  if (UK_TERRITORIES.includes(iso)) return UK_TERRITORIES;
  if (EU_COUNTRIES.includes(iso)) return [...EU_COUNTRIES];
  if (iso === "CH" || iso === "LI") return ["CH", "LI"];
  if (GCC.includes(iso)) return GCC;
  if (ASEAN.includes(iso)) return ASEAN;
  if (NORTH_AMERICA.includes(iso)) return NORTH_AMERICA;
  return [iso];
}

/** Treatments where no destination tax was charged against a registration. */
const RELIEVED_TREATMENTS: TaxTreatment[] = ["reverse_charge", "b2b_zero_rated", "export_zero_rated"];

export const REGIONAL_REVIEW_STATUS = "PENDING_REGIONAL_COMPLIANCE_REVIEW";

export interface RegionalComplianceDecision {
  cleared: boolean;
  /** `PENDING_REGIONAL_COMPLIANCE_REVIEW` when the thread must be intercepted. */
  status: string | null;
  reason: string | null;
  registryCountry: string | null;
  destinationCountry: string | null;
}

/**
 * Cross-check the verified tax registry country against the delivery country.
 *
 * A relieved order (reverse charge, B2B zero rating, export zero rating) routed
 * outside the registry's operating region is the classic parallel-export
 * signature, so automated checkout halts and the order is flagged for review.
 */
export function evaluateRegionalCompliance(input: {
  buyerTaxCountry: string | null | undefined;
  shippingCountry: string | null | undefined;
  treatment: TaxTreatment;
  buyerTaxIdVerified?: boolean;
  taxCents?: number;
}): RegionalComplianceDecision {
  const registry = String(input.buyerTaxCountry || "").trim().toUpperCase() || null;
  const destination = String(input.shippingCountry || "").trim().toUpperCase() || null;
  const relieved = RELIEVED_TREATMENTS.includes(input.treatment) || (input.taxCents ?? 1) === 0;

  if (!registry || !destination || !relieved) {
    return { cleared: true, status: null, reason: null, registryCountry: registry, destinationCountry: destination };
  }
  if (registry === destination) {
    return { cleared: true, status: null, reason: null, registryCountry: registry, destinationCountry: destination };
  }

  const region = operatingRegionFor(registry);
  if (region.includes(destination)) {
    return { cleared: true, status: null, reason: null, registryCountry: registry, destinationCountry: destination };
  }

  return {
    cleared: false,
    status: REGIONAL_REVIEW_STATUS,
    reason:
      `Tax relief was claimed on a ${registry} registration but delivery is routed to ${destination}, ` +
      "outside the registered operating region. The order is held for regional compliance review.",
    registryCountry: registry,
    destinationCountry: destination,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Allocation reserve gate                                          */
/* ------------------------------------------------------------------ */

/** Default per-order ceiling on a restricted piece. */
export const DEFAULT_ALLOCATION_UNIT_CAP = 3;
/** Share of known warehouse stock a single order may absorb. */
export const MAX_STOCK_SHARE = 0.5;

export interface AllocationItemInput {
  pickId: string;
  title: string;
  quantity: number;
  isAllocationRestricted?: boolean | null;
  allocationUnitCap?: number | null;
  availableStockUnits?: number | null;
}

export interface AllocationBreach {
  pickId: string;
  title: string;
  requested: number;
  allowed: number;
  reason: "unit_cap" | "stock_share";
}

export interface AllocationDecision {
  cleared: boolean;
  breaches: AllocationBreach[];
  message: string | null;
}

/** Highest quantity a single order may take of one restricted piece. */
export function allocationCeilingFor(item: AllocationItemInput): number {
  const cap = Number(item.allocationUnitCap);
  const unitCap = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : DEFAULT_ALLOCATION_UNIT_CAP;
  const stock = Number(item.availableStockUnits);
  if (Number.isFinite(stock) && stock >= 0) {
    return Math.max(0, Math.min(unitCap, Math.floor(stock * MAX_STOCK_SHARE)));
  }
  return unitCap;
}

/**
 * Intercept carts that try to sweep a restricted piece. Breaching lines must be
 * routed through the Allocation Inquiry Request form instead of instant
 * checkout.
 */
export function evaluateAllocation(items: AllocationItemInput[]): AllocationDecision {
  const breaches: AllocationBreach[] = [];

  for (const item of items) {
    if (!item?.isAllocationRestricted) continue;
    const requested = Math.max(0, Math.round(Number(item.quantity) || 0));
    const allowed = allocationCeilingFor(item);
    if (requested > allowed) {
      const stock = Number(item.availableStockUnits);
      const stockBound = Number.isFinite(stock) && Math.floor(stock * MAX_STOCK_SHARE) < DEFAULT_ALLOCATION_UNIT_CAP;
      breaches.push({
        pickId: item.pickId,
        title: item.title,
        requested,
        allowed,
        reason: stockBound ? "stock_share" : "unit_cap",
      });
    }
  }

  if (!breaches.length) return { cleared: true, breaches: [], message: null };

  const names = breaches.map((b) => `${b.title} (max ${b.allowed} per order)`).join(", ");
  return {
    cleared: false,
    breaches,
    message:
      `${names} ${breaches.length > 1 ? "are" : "is"} held under allocation. ` +
      "Submit an allocation inquiry and an advisor will confirm availability and release the quantity.",
  };
}

/* ------------------------------------------------------------------ */
/* 4. Catalogue anti-scraping thresholds                               */
/* ------------------------------------------------------------------ */

/** Wholesale pricing reads permitted per authenticated session, per window. */
export const CATALOG_RATE_LIMIT = 90;
export const CATALOG_RATE_WINDOW_SECONDS = 60;
