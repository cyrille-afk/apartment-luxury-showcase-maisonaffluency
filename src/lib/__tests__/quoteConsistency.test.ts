import { describe, it, expect } from "vitest";
import { computePdfTotals, checkQuoteConsistency, type PdfTotalsInput } from "@/lib/quoteConsistency";

const TIERS = [
  { tier: "silver", label: "Silver", pct: 0.1, minSpendEurCents: 0 },
  { tier: "gold", label: "Gold", pct: 0.15, minSpendEurCents: 15_000_000 },
  { tier: "platinum", label: "Platinum", pct: 0.2, minSpendEurCents: 30_000_000 },
];

const FX = 9.0071; // EUR -> HKD

const pdfArgs = (over: Partial<PdfTotalsInput> = {}): PdfTotalsInput => ({
  currency: "HKD",
  subtotalCents: 32_573_276,
  tradeDiscountPct: 0.1,
  tradeDiscountApplied: true,
  tierLabel: "Silver",
  extras: [{ label: "PREMIUM PACKING & CUSTOM WOOD CRATES × 4", amountCents: Math.round(176_000 * FX) }],
  gstEnabled: false,
  gstRate: 0,
  shippingEstimateCents: 0,
  depositPct: 0.6,
  tierBreakdown: TIERS.map((t) => ({
    label: t.label,
    pct: t.pct,
    minSpendCents: Math.round(t.minSpendEurCents * FX),
    active: t.tier === "silver",
  })),
  ...over,
});

const screenFor = (args: PdfTotalsInput) => {
  const t = computePdfTotals(args);
  return {
    currency: args.currency,
    subtotalCents: t.subtotalCents,
    discountCents: t.discountCents,
    extrasCents: t.extrasCents,
    insuranceCents: t.insuranceCents,
    taxCents: t.taxCents,
    shippingCents: t.shippingCents,
    orderTotalCents: t.grandTotalCents,
  };
};

describe("computePdfTotals", () => {
  it("matches the printed order of operations", () => {
    const t = computePdfTotals(pdfArgs());
    expect(t.discountCents).toBe(3_257_328);
    expect(t.afterDiscountCents).toBe(29_315_948);
    expect(t.extrasCents).toBe(1_585_250);
    expect(t.grandTotalCents).toBe(30_901_198);
    expect(t.depositCents + t.balanceCents).toBe(t.grandTotalCents);
  });

  it("taxes extras and insurance along with the discounted goods", () => {
    const t = computePdfTotals(pdfArgs({ gstEnabled: true, gstRate: 9, insurancePremiumCents: 100_000 }));
    expect(t.taxCents).toBe(Math.round((29_315_948 + 1_585_250 + 100_000) * 0.09));
  });
});

describe("checkQuoteConsistency", () => {
  it("passes a consistent quote", () => {
    const args = pdfArgs();
    const res = checkQuoteConsistency({
      screen: screenFor(args),
      pdf: args,
      extraRows: [{ label: "PREMIUM PACKING & CUSTOM WOOD CRATES", currency: "EUR", amountCents: 44_000, quantity: 4 }],
      tierConfigEur: TIERS,
      activeTier: "silver",
    });
    expect(res.issues).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("flags an extra that was printed without currency conversion", () => {
    const args = pdfArgs({ extras: [{ label: "PREMIUM PACKING & CUSTOM WOOD CRATES × 4", amountCents: 176_000 }] });
    const res = checkQuoteConsistency({
      screen: screenFor(args),
      pdf: args,
      extraRows: [{ label: "PREMIUM PACKING & CUSTOM WOOD CRATES", currency: "EUR", amountCents: 44_000, quantity: 4 }],
      tierConfigEur: TIERS,
      activeTier: "silver",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.code)).toContain("extra_not_converted");
  });

  it("flags tier thresholds still printed as EUR figures under another currency", () => {
    const args = pdfArgs({
      tierBreakdown: TIERS.map((t) => ({ label: t.label, pct: t.pct, minSpendCents: t.minSpendEurCents, active: t.tier === "silver" })),
    });
    const res = checkQuoteConsistency({ screen: screenFor(args), pdf: args, tierConfigEur: TIERS, activeTier: "silver" });
    expect(res.issues.map((i) => i.code)).toContain("tier_threshold_not_converted");
  });

  it("flags a tier percentage that drifted from the configuration", () => {
    const args = pdfArgs({
      tierBreakdown: TIERS.map((t) => ({
        label: t.label,
        pct: t.label === "Gold" ? 0.18 : t.pct,
        minSpendCents: Math.round(t.minSpendEurCents * FX),
        active: t.tier === "silver",
      })),
    });
    const res = checkQuoteConsistency({ screen: screenFor(args), pdf: args, tierConfigEur: TIERS, activeTier: "silver" });
    expect(res.issues.map((i) => i.code)).toContain("tier_pct_mismatch");
  });

  it("flags totals and deposit drift between screen and PDF", () => {
    const args = pdfArgs();
    const screen = screenFor(args);
    const res = checkQuoteConsistency({
      screen: { ...screen, orderTotalCents: screen.orderTotalCents + 500_000, extrasCents: 0 },
      pdf: args,
      tierConfigEur: TIERS,
      activeTier: "silver",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["extras_mismatch", "total_mismatch"]));
  });

  it("flags a currency mismatch between screen and PDF", () => {
    const args = pdfArgs();
    const res = checkQuoteConsistency({ screen: { ...screenFor(args), currency: "USD" }, pdf: args });
    expect(res.issues.map((i) => i.code)).toContain("currency_mismatch");
  });

  it("flags a missing FX rate", () => {
    const args = pdfArgs();
    const res = checkQuoteConsistency({ screen: screenFor(args), pdf: args, missingFxPairs: ["EUR/HKD"] });
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.code)).toContain("fx_rate_missing");
  });

  it("rejects an out-of-range deposit percentage", () => {
    const args = pdfArgs({ depositPct: 0 });
    const res = checkQuoteConsistency({ screen: screenFor(args), pdf: args });
    expect(res.issues.map((i) => i.code)).toContain("deposit_pct_invalid");
  });
});
