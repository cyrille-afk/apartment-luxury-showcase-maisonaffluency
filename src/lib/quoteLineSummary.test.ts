import { describe, it, expect } from "vitest";
import { quoteLinePricing, summarizeQuoteLines, type QuoteSummaryLine } from "./quoteLineSummary";

const sofaLine: QuoteSummaryLine = {
  quantity: 7,
  unit_price_cents: 1845000,
  unit_price_currency: "EUR",
  variant_label: "Saint Honoré 280",
  product: { currency: "EUR", rrp_price_cents: 2260000, trade_price_cents: 1845000 },
};

describe("quoteLinePricing", () => {
  it("uses the saved net unit price in trade mode and multiplies by quantity", () => {
    const pricing = quoteLinePricing(sofaLine, false);
    expect(pricing).toEqual({ unitCents: 1845000, currency: "EUR", lineTotalCents: 1845000 * 7, basis: "net" });
  });

  it("never uses the net unit price in presentation mode — retail only", () => {
    const pricing = quoteLinePricing(sofaLine, true);
    expect(pricing).toEqual({ unitCents: 2260000, currency: "EUR", lineTotalCents: 2260000 * 7, basis: "retail" });
  });

  it("adds a same-currency fabric surcharge to the net unit price", () => {
    const pricing = quoteLinePricing({ ...sofaLine, quantity: 1, fabric_upcharge_cents: 150000, fabric_currency: "EUR" }, false);
    expect(pricing?.unitCents).toBe(1995000);
    expect(pricing?.lineTotalCents).toBe(1995000);
  });

  it("ignores a fabric surcharge in a different currency rather than mixing", () => {
    const pricing = quoteLinePricing({ ...sofaLine, quantity: 1, fabric_upcharge_cents: 150000, fabric_currency: "GBP" }, false);
    expect(pricing?.unitCents).toBe(1845000);
  });

  it("falls back to catalogue retail when no net price is saved", () => {
    const pricing = quoteLinePricing({ ...sofaLine, quantity: 2, unit_price_cents: null }, false);
    expect(pricing).toEqual({ unitCents: 2260000, currency: "EUR", lineTotalCents: 4520000, basis: "retail" });
  });

  it("returns null when no price can be resolved", () => {
    const pricing = quoteLinePricing({ quantity: 1, unit_price_cents: null, unit_price_currency: null, product: { currency: "EUR" } }, false);
    expect(pricing).toBeNull();
  });
});

describe("summarizeQuoteLines", () => {
  it("separates product lines from total units", () => {
    const summary = summarizeQuoteLines([sofaLine, { ...sofaLine, quantity: 1 }], false);
    expect(summary.lineCount).toBe(2);
    expect(summary.totalUnits).toBe(8);
    expect(summary.unpricedCount).toBe(0);
  });

  it("sums line totals per currency", () => {
    const gbpLine: QuoteSummaryLine = { quantity: 2, unit_price_cents: 500000, unit_price_currency: "GBP", product: { currency: "GBP" } };
    const summary = summarizeQuoteLines([sofaLine, gbpLine], false);
    const eur = summary.totals.find((t) => t.currency === "EUR");
    const gbp = summary.totals.find((t) => t.currency === "GBP");
    expect(eur?.cents).toBe(1845000 * 7);
    expect(gbp?.cents).toBe(1000000);
  });

  it("counts unpriced lines without inventing a total", () => {
    const unpriced: QuoteSummaryLine = { quantity: 3, unit_price_cents: null, unit_price_currency: null, product: { currency: "EUR" } };
    const summary = summarizeQuoteLines([sofaLine, unpriced], false);
    expect(summary.unpricedCount).toBe(1);
    expect(summary.totals).toHaveLength(1);
    expect(summary.totalUnits).toBe(10);
  });

  it("marks mixed bases when some lines are net and others retail", () => {
    const retailOnly: QuoteSummaryLine = { quantity: 1, unit_price_cents: null, unit_price_currency: null, product: { currency: "EUR", rrp_price_cents: 100000 } };
    const summary = summarizeQuoteLines([sofaLine, retailOnly], false);
    expect(summary.totals[0].basis).toBe("mixed");
  });
});
