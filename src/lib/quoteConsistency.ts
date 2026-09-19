/**
 * Pre-send consistency checks for trade quotes.
 *
 * The on-screen quote editor and the generated PDF compute their totals
 * independently. Any drift between the two (unconverted extras currency,
 * tier ladder printed in the wrong currency, capped per-line discounts,
 * a deposit that doesn't add back up to the order total) has historically
 * reached clients. These helpers recompute the PDF totals from the exact
 * PDF arguments and compare them against the editor's own numbers so the
 * mismatch is caught *before* a quote is downloaded, published or emailed.
 *
 * Pure functions only — no React, no Supabase — so they are unit testable.
 */

export interface QuoteTotalsBreakdown {
  subtotalCents: number;
  discountCents: number;
  afterDiscountCents: number;
  extrasCents: number;
  insuranceCents: number;
  taxCents: number;
  shippingCents: number;
  grandTotalCents: number;
  depositPct: number;
  depositCents: number;
  balanceCents: number;
}

/** Minimal shape of the PDF arguments the totals block consumes. */
export interface PdfTotalsInput {
  currency: string;
  subtotalCents: number;
  tradeDiscountPct: number;
  tradeDiscountApplied?: boolean;
  /** Exact per-line (cap-aware) discount total, when the PDF was given one. */
  tradeDiscountCents?: number | null;
  extras?: Array<{ label?: string; amountCents: number }> | null;
  insurancePremiumCents?: number | null;
  gstEnabled?: boolean;
  gstRate?: number;
  shippingEstimateCents?: number | null;
  depositPct?: number | null;
  tierLabel?: string | null;
  tierBreakdown?: Array<{ label: string; pct: number; minSpendCents: number; active: boolean }>;
}

/**
 * Mirror of `drawTotals()` in `src/lib/quotePdf.ts`. Kept deliberately in the
 * same order and with the same rounding so the numbers compared here are the
 * numbers the client actually sees on the printed quote.
 */
export function computePdfTotals(args: PdfTotalsInput): QuoteTotalsBreakdown {
  const subtotalCents = Math.round(args.subtotalCents || 0);
  const extrasCents = (args.extras || [])
    .filter((e) => (e?.amountCents || 0) !== 0)
    .reduce((s, e) => s + (e.amountCents || 0), 0);
  const discountCents = args.tradeDiscountApplied
    ? (typeof args.tradeDiscountCents === "number"
        ? Math.round(args.tradeDiscountCents)
        : Math.round(subtotalCents * (args.tradeDiscountPct || 0)))
    : 0;
  const afterDiscountCents = subtotalCents - discountCents;
  const insuranceCents = Math.max(0, Math.round(args.insurancePremiumCents || 0));
  const baseForTax = afterDiscountCents + extrasCents + insuranceCents;
  const taxCents = args.gstEnabled ? Math.round(baseForTax * (args.gstRate || 0) / 100) : 0;
  const shippingCents = Math.max(0, Math.round(args.shippingEstimateCents || 0));
  const grandTotalCents = baseForTax + taxCents + shippingCents;
  const depositPct = Math.max(0, Math.min(1, args.depositPct ?? 0.6));
  const depositCents = Math.round(grandTotalCents * depositPct);
  return {
    subtotalCents,
    discountCents,
    afterDiscountCents,
    extrasCents,
    insuranceCents,
    taxCents,
    shippingCents,
    grandTotalCents,
    depositPct,
    depositCents,
    balanceCents: grandTotalCents - depositCents,
  };
}

export type QuoteCheckSeverity = "error" | "warning";

export interface QuoteCheckIssue {
  code: string;
  severity: QuoteCheckSeverity;
  message: string;
}

export interface ScreenTotalsInput {
  currency: string;
  subtotalCents: number;
  /** Per-line (cap-aware) discount total shown in the editor. */
  discountCents: number;
  /** Extras total already converted into the quote currency. */
  extrasCents: number;
  insuranceCents?: number;
  taxCents?: number;
  shippingCents?: number;
  orderTotalCents: number;
}

export interface QuoteConsistencyInput {
  screen: ScreenTotalsInput;
  pdf: PdfTotalsInput;
  /** Raw extras rows as stored, to verify currency conversion was applied. */
  extraRows?: Array<{ label?: string | null; currency?: string | null; amountCents: number; quantity?: number | null }>;
  /** Tier thresholds as configured (stored in EUR). */
  tierConfigEur?: Array<{ tier: string; label: string; pct: number; minSpendEurCents: number }>;
  /** Tier the member is actually on, as resolved by the app. */
  activeTier?: string | null;
  /** Currency pairs the FX layer could not resolve at build time. */
  missingFxPairs?: string[];
}

/** Money comparisons tolerate 1 cent of rounding drift per component. */
const TOLERANCE_CENTS = 2;

const fmt = (cents: number, ccy: string) =>
  `${ccy} ${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Compare the editor's numbers against the PDF's numbers and validate tier,
 * currency and deposit integrity. Returns every problem found; callers decide
 * whether to block (any `error`) or merely warn.
 */
export function checkQuoteConsistency(input: QuoteConsistencyInput): {
  ok: boolean;
  issues: QuoteCheckIssue[];
  pdfTotals: QuoteTotalsBreakdown;
} {
  const issues: QuoteCheckIssue[] = [];
  const pdfTotals = computePdfTotals(input.pdf);
  const { screen } = input;
  const ccy = (input.pdf.currency || screen.currency || "").toUpperCase();

  // --- Currency ----------------------------------------------------------
  if (!ccy) {
    issues.push({ code: "currency_missing", severity: "error", message: "The quote has no currency set." });
  } else if ((screen.currency || "").toUpperCase() !== ccy) {
    issues.push({
      code: "currency_mismatch",
      severity: "error",
      message: `On-screen currency (${screen.currency}) differs from the PDF currency (${ccy}).`,
    });
  }

  // Extras must be converted into the quote currency before printing.
  for (const row of input.extraRows || []) {
    const src = (row.currency || ccy).toUpperCase();
    if (src && src !== ccy) {
      const qty = Math.max(1, Number(row.quantity) || 1);
      const raw = (row.amountCents || 0) * qty;
      const printed = (input.pdf.extras || []).find((e) => (e.label || "").startsWith((row.label || "").trim()));
      if (printed && Math.abs(printed.amountCents - raw) <= TOLERANCE_CENTS) {
        issues.push({
          code: "extra_not_converted",
          severity: "error",
          message: `"${row.label || "Additional charge"}" is stored in ${src} but printed unconverted as ${ccy}.`,
        });
      }
    }
  }

  for (const pair of input.missingFxPairs || []) {
    issues.push({
      code: "fx_rate_missing",
      severity: "error",
      message: `No exchange rate available for ${pair} — amounts may be printed unconverted.`,
    });
  }

  // --- Totals ------------------------------------------------------------
  const compare = (code: string, label: string, a: number, b: number, severity: QuoteCheckSeverity = "error") => {
    if (Math.abs(a - b) > TOLERANCE_CENTS) {
      issues.push({
        code,
        severity,
        message: `${label} differs: screen ${fmt(a, ccy)} vs PDF ${fmt(b, ccy)}.`,
      });
    }
  };

  compare("subtotal_mismatch", "Subtotal", screen.subtotalCents, pdfTotals.subtotalCents);
  compare("discount_mismatch", "Trade discount", screen.discountCents, pdfTotals.discountCents);
  compare("extras_mismatch", "Additional charges", screen.extrasCents, pdfTotals.extrasCents);
  compare("insurance_mismatch", "Insurance", screen.insuranceCents ?? 0, pdfTotals.insuranceCents);
  compare("tax_mismatch", "Tax", screen.taxCents ?? 0, pdfTotals.taxCents);
  compare("shipping_mismatch", "Shipping", screen.shippingCents ?? 0, pdfTotals.shippingCents);
  compare("total_mismatch", "Order total", screen.orderTotalCents, pdfTotals.grandTotalCents);

  // --- Deposit -----------------------------------------------------------
  if (pdfTotals.depositPct <= 0 || pdfTotals.depositPct > 1) {
    issues.push({ code: "deposit_pct_invalid", severity: "error", message: "The deposit percentage is outside 0–100%." });
  }
  if (pdfTotals.depositCents + pdfTotals.balanceCents !== pdfTotals.grandTotalCents) {
    issues.push({
      code: "deposit_split_mismatch",
      severity: "error",
      message: "Deposit and balance do not add back up to the order total.",
    });
  }
  if (pdfTotals.grandTotalCents > 0 && pdfTotals.depositCents <= 0) {
    issues.push({ code: "deposit_zero", severity: "warning", message: "The deposit due now is zero." });
  }

  // --- Trade tier --------------------------------------------------------
  const cfg = input.tierConfigEur || [];
  const ladder = input.pdf.tierBreakdown || [];
  if (cfg.length > 0 && ladder.length > 0) {
    if (cfg.length !== ladder.length) {
      issues.push({ code: "tier_ladder_incomplete", severity: "warning", message: "The printed tier ladder does not list every configured tier." });
    }
    for (const t of cfg) {
      const printed = ladder.find((l) => l.label.toLowerCase() === t.label.toLowerCase());
      if (!printed) {
        issues.push({ code: "tier_missing", severity: "warning", message: `Tier "${t.label}" is missing from the printed ladder.` });
        continue;
      }
      if (Math.abs(printed.pct - t.pct) > 0.0001) {
        issues.push({
          code: "tier_pct_mismatch",
          severity: "error",
          message: `Tier "${t.label}" prints ${(printed.pct * 100).toFixed(1)}% but is configured at ${(t.pct * 100).toFixed(1)}%.`,
        });
      }
      // Thresholds are stored in EUR; printing the EUR figure under a non-EUR
      // currency label is the classic mislabel bug.
      if (ccy !== "EUR" && t.minSpendEurCents > 0 && Math.abs(printed.minSpendCents - t.minSpendEurCents) <= TOLERANCE_CENTS) {
        issues.push({
          code: "tier_threshold_not_converted",
          severity: "error",
          message: `Tier "${t.label}" threshold is printed in ${ccy} but still holds the EUR figure.`,
        });
      }
    }
    const active = ladder.filter((l) => l.active);
    if (active.length !== 1) {
      issues.push({ code: "tier_active_ambiguous", severity: "warning", message: "The printed tier ladder does not mark exactly one current tier." });
    } else if (input.activeTier) {
      const expected = cfg.find((t) => t.tier === input.activeTier);
      if (expected && expected.label.toLowerCase() !== active[0].label.toLowerCase()) {
        issues.push({
          code: "tier_active_mismatch",
          severity: "error",
          message: `The quote applies "${expected.label}" but the PDF marks "${active[0].label}" as current.`,
        });
      }
    }
  }

  if (input.pdf.tradeDiscountApplied && input.pdf.tierLabel) {
    const expectedPct = cfg.find((t) => t.label.toLowerCase() === (input.pdf.tierLabel || "").toLowerCase())?.pct;
    if (typeof expectedPct === "number" && Math.abs(expectedPct - (input.pdf.tradeDiscountPct || 0)) > 0.0001) {
      issues.push({
        code: "discount_pct_off_tier",
        severity: "warning",
        message: `The applied discount (${((input.pdf.tradeDiscountPct || 0) * 100).toFixed(1)}%) differs from the "${input.pdf.tierLabel}" tier rate (${(expectedPct * 100).toFixed(1)}%).`,
      });
    }
  }

  return { ok: issues.every((i) => i.severity !== "error"), issues, pdfTotals };
}

/** One-line summary suitable for a toast description. */
export function summariseIssues(issues: QuoteCheckIssue[]): string {
  return issues.map((i) => `• ${i.message}`).join("\n");
}
