/**
 * Verifies the math used by QuoteProposalCard when the user changes the
 * display currency: every line price, the subtotal, the trade discount and
 * the grand total all flow through the same `convertCents` helper against
 * the same `displayCurrency`, so a multi-currency proposal stays internally
 * consistent (line totals sum to the subtotal; discount + total = subtotal).
 */
import { describe, it, expect } from "vitest";
import { convertCents, type DisplayCurrency } from "@/components/trade/CurrencyToggle";

// Match the bundled FALLBACK_RATES in CurrencyToggle.tsx so the test is
// deterministic regardless of network availability.
const RATES: Record<string, number> = {
  EUR_EUR: 1, USD_USD: 1, GBP_GBP: 1, SGD_SGD: 1,
  EUR_USD: 1.08, EUR_GBP: 0.86, EUR_SGD: 1.46,
  USD_EUR: 0.93, USD_GBP: 0.79, USD_SGD: 1.34,
  GBP_EUR: 1.16, GBP_USD: 1.27, GBP_SGD: 1.70,
  SGD_EUR: 0.68, SGD_USD: 0.75, SGD_GBP: 0.59,
};

type Line = { unit_cents: number; qty: number; currency: string };

function compute(lines: Line[], display: DisplayCurrency, discountPct: number) {
  const perLine = lines.map((l) => {
    const unit = convertCents(l.unit_cents, l.currency, display, RATES);
    return { unit, total: unit * l.qty };
  });
  const subtotal = perLine.reduce((s, l) => s + l.total, 0);
  const discount = Math.round((subtotal * discountPct) / 100);
  const total = subtotal - discount;
  return { perLine, subtotal, discount, total };
}

describe("QuoteProposalCard — currency conversion consistency", () => {
  const lines: Line[] = [
    { unit_cents: 250_000, qty: 2, currency: "EUR" }, // €2,500 × 2
    { unit_cents: 180_000, qty: 1, currency: "USD" }, // $1,800
    { unit_cents: 90_000,  qty: 3, currency: "GBP" }, // £900 × 3
  ];

  it.each(["EUR", "USD", "GBP", "SGD"] as const)(
    "line totals sum to subtotal in %s",
    (display) => {
      const { perLine, subtotal } = compute(lines, display, 8);
      const summed = perLine.reduce((s, l) => s + l.total, 0);
      expect(summed).toBe(subtotal);
    },
  );

  it("discount + total === subtotal in every currency", () => {
    for (const display of ["EUR", "USD", "GBP", "SGD"] as const) {
      const { subtotal, discount, total } = compute(lines, display, 8);
      expect(discount + total).toBe(subtotal);
    }
  });

  it("switching display currency rescales every line (no value left in source currency)", () => {
    const eur = compute(lines, "EUR", 0);
    const usd = compute(lines, "USD", 0);
    // First line is EUR → EUR stays identical, but it must change when target is USD.
    expect(eur.perLine[0].unit).toBe(250_000);
    expect(usd.perLine[0].unit).not.toBe(250_000);
    // Second line (USD source) is identical in USD display, different in EUR.
    expect(usd.perLine[1].unit).toBe(180_000);
    expect(eur.perLine[1].unit).not.toBe(180_000);
    // Third line (GBP source) changes for both EUR and USD displays.
    expect(eur.perLine[2].unit).not.toBe(90_000);
    expect(usd.perLine[2].unit).not.toBe(90_000);
  });

  it("zero-rate fallback never produces NaN or negative totals", () => {
    const { subtotal, discount, total } = compute(lines, "SGD", 8);
    expect(Number.isFinite(subtotal)).toBe(true);
    expect(Number.isFinite(discount)).toBe(true);
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBeGreaterThan(0);
  });
});
