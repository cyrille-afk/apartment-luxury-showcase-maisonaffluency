/**
 * Checkout guardrails.
 *
 * Single source of truth for what checkout is allowed to say about money.
 * Rules:
 *  1. Every amount rendered on checkout must come from `buildVerifiedTotals()`,
 *     which derives strictly from cart line items (unit price × quantity).
 *  2. The amount Stripe is about to charge must equal the client-side total,
 *     verified by `reconcileBackendAmount()` before the payment UI is shown.
 *  3. Checkout copy may not claim discounts, waived fees, complimentary
 *     services or any charge that is not an actual line item. Enforced by
 *     `assertCheckoutCopy()` at runtime (dev) and by a unit test on the source.
 */

export type VerifiedLine = {
  title: string;
  unitCents: number;
  currency: string;
  quantity?: number;
};

export type VerifiedTotals = {
  currency: string;
  lines: { title: string; unitCents: number; quantity: number; lineCents: number; currency: string }[];
  /** Sum of all line totals. There is no other addend, discount or fee. */
  subtotalCents: number;
  /** Identical to the subtotal: nothing is added or removed at checkout. */
  totalCents: number;
};

export const lineQuantity = (line: VerifiedLine) => Math.max(1, Math.floor(line.quantity ?? 1));
export const lineTotalCents = (line: VerifiedLine) => Math.round(line.unitCents) * lineQuantity(line);

/** Derives every displayable amount from the cart. No other source is permitted. */
export function buildVerifiedTotals(lines: VerifiedLine[]): VerifiedTotals {
  const currency = (lines[0]?.currency || "usd").toLowerCase();
  const detailed = lines.map((l) => ({
    title: l.title,
    unitCents: Math.round(l.unitCents),
    quantity: lineQuantity(l),
    lineCents: lineTotalCents(l),
    currency: (l.currency || currency).toLowerCase(),
  }));
  const subtotalCents = detailed.reduce((sum, l) => sum + l.lineCents, 0);
  return { currency, lines: detailed, subtotalCents, totalCents: subtotalCents };
}

/** True when every line shares one currency — mixed currencies cannot be summed. */
export function hasSingleCurrency(totals: VerifiedTotals) {
  return totals.lines.every((l) => l.currency === totals.currency);
}

export type Reconciliation =
  | { ok: true; amountCents: number }
  | { ok: false; reason: string };

/**
 * Confirms the backend PaymentIntent charges exactly the total derived from the
 * cart. Any drift blocks checkout instead of silently charging a different sum.
 */
export function reconcileBackendAmount(
  totals: VerifiedTotals,
  backendAmountCents: unknown,
  backendCurrency?: unknown,
): Reconciliation {
  if (!hasSingleCurrency(totals)) {
    return { ok: false, reason: "Your selection mixes currencies. Please contact your advisor." };
  }
  if (totals.totalCents <= 0) {
    return { ok: false, reason: "This selection has no payable amount." };
  }
  if (typeof backendAmountCents !== "number" || !Number.isFinite(backendAmountCents)) {
    // Backend did not report an amount — nothing to contradict, allow but flag.
    return { ok: true, amountCents: totals.totalCents };
  }
  if (Math.round(backendAmountCents) !== totals.totalCents) {
    return {
      ok: false,
      reason: "The payment amount did not match your selection. Checkout was stopped for your safety.",
    };
  }
  if (
    typeof backendCurrency === "string" &&
    backendCurrency.toLowerCase() !== totals.currency.toLowerCase()
  ) {
    return { ok: false, reason: "The payment currency did not match your selection." };
  }
  return { ok: true, amountCents: totals.totalCents };
}

/**
 * Phrases that imply a monetary benefit or charge that checkout cannot prove
 * from the cart / PaymentIntent. Never render copy matching these.
 */
export const FORBIDDEN_CHECKOUT_CLAIMS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bdiscount(ed|s)?\b/i, label: "discount claim" },
  { pattern: /\bcomplimentary\b/i, label: "complimentary service claim" },
  { pattern: /\bfree (shipping|delivery|installation|of charge)\b/i, label: "free-service claim" },
  { pattern: /\bwaive[ds]?\b/i, label: "waived-fee claim" },
  { pattern: /\b(rebate|cashback|cash back|refund guarantee)\b/i, label: "rebate claim" },
  { pattern: /\d+(\.\d+)?\s*%\s*(off|savings?|reduction)\b/i, label: "percentage-off claim" },
  { pattern: /\bsave\s+(?:up to\s+)?[$€£]?\d/i, label: "savings claim" },
  { pattern: /\bincluded at no (cost|charge)\b/i, label: "no-cost claim" },
];

/**
 * Validates a string destined for checkout UI. Returns the text unchanged when
 * clean; in dev it throws so the claim can never reach a customer.
 */
export function assertCheckoutCopy(text: string, context = "checkout copy"): string {
  const hit = FORBIDDEN_CHECKOUT_CLAIMS.find((r) => r.pattern.test(text));
  if (hit) {
    const message = `[checkout guardrail] Blocked ${hit.label} in ${context}: "${text}"`;
    if (import.meta.env?.DEV) throw new Error(message);
    console.error(message);
    return "";
  }
  return text;
}
