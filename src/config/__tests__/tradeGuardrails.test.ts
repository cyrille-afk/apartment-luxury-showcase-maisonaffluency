import { describe, expect, it } from "vitest";
import {
  evaluateAllocation,
  evaluateCreditLimit,
  evaluateRegionalCompliance,
  REGIONAL_REVIEW_STATUS,
} from "../tradeGuardrails";

describe("credit limits", () => {
  const profile = {
    approved_credit_limit_eur_cents: 1_000_000,
    first_order_limit_eur_cents: 500_000,
    net_terms_enabled: true,
    settled_order_count: 0,
    outstanding_balance_eur_cents: 0,
  };

  it("ignores prepaid terms", () => {
    const d = evaluateCreditLimit({ paymentTerms: "card", orderTotalEurCents: 9_000_000, profile });
    expect(d.usesCredit).toBe(false);
    expect(d.approved).toBe(true);
  });

  it("caps a first net-30 order at the first-order ceiling", () => {
    const d = evaluateCreditLimit({ paymentTerms: "net_30", orderTotalEurCents: 600_000, profile });
    expect(d.approved).toBe(false);
    expect(d.status).toBe("first_order_restricted");
    expect(d.limitEurCents).toBe(500_000);
  });

  it("allows an established account up to the approved limit and blocks beyond it", () => {
    const settled = { ...profile, settled_order_count: 4, outstanding_balance_eur_cents: 200_000 };
    expect(
      evaluateCreditLimit({ paymentTerms: "net_60", orderTotalEurCents: 700_000, profile: settled }).approved,
    ).toBe(true);
    const over = evaluateCreditLimit({ paymentTerms: "net_60", orderTotalEurCents: 900_000, profile: settled });
    expect(over.approved).toBe(false);
    expect(over.status).toBe("exceeds_limit");
  });

  it("blocks when net terms are suspended", () => {
    const d = evaluateCreditLimit({
      paymentTerms: "net_30",
      orderTotalEurCents: 1_000,
      profile: { ...profile, net_terms_enabled: false },
    });
    expect(d.status).toBe("terms_suspended");
  });

  it("applies the conservative default when no profile exists", () => {
    const d = evaluateCreditLimit({ paymentTerms: "net_30", orderTotalEurCents: 600_000, profile: null });
    expect(d.approved).toBe(false);
  });
});

describe("regional compliance", () => {
  it("clears a UK reverse-charge order delivered in the UK", () => {
    expect(
      evaluateRegionalCompliance({
        buyerTaxCountry: "GB",
        shippingCountry: "GB",
        treatment: "reverse_charge",
        taxCents: 0,
      }).cleared,
    ).toBe(true);
  });

  it("halts a UK zero-rated order routed to Asia", () => {
    const d = evaluateRegionalCompliance({
      buyerTaxCountry: "GB",
      shippingCountry: "HK",
      treatment: "reverse_charge",
      taxCents: 0,
    });
    expect(d.cleared).toBe(false);
    expect(d.status).toBe(REGIONAL_REVIEW_STATUS);
  });

  it("allows intra-EU relief within the EU", () => {
    expect(
      evaluateRegionalCompliance({
        buyerTaxCountry: "FR",
        shippingCountry: "DE",
        treatment: "reverse_charge",
        taxCents: 0,
      }).cleared,
    ).toBe(true);
  });

  it("does not interfere with taxed private orders", () => {
    expect(
      evaluateRegionalCompliance({
        buyerTaxCountry: "GB",
        shippingCountry: "US",
        treatment: "standard",
        taxCents: 5_000,
      }).cleared,
    ).toBe(true);
  });
});

describe("allocation gate", () => {
  it("ignores unrestricted pieces", () => {
    expect(
      evaluateAllocation([{ pickId: "a", title: "Chair", quantity: 12 }]).cleared,
    ).toBe(true);
  });

  it("caps restricted pieces at three units", () => {
    const d = evaluateAllocation([
      { pickId: "a", title: "Rare Console", quantity: 4, isAllocationRestricted: true },
    ]);
    expect(d.cleared).toBe(false);
    expect(d.breaches[0].allowed).toBe(3);
  });

  it("caps at half of known stock when stock is scarce", () => {
    const d = evaluateAllocation([
      {
        pickId: "a",
        title: "Artisan Light",
        quantity: 2,
        isAllocationRestricted: true,
        availableStockUnits: 2,
      },
    ]);
    expect(d.cleared).toBe(false);
    expect(d.breaches[0].allowed).toBe(1);
    expect(d.breaches[0].reason).toBe("stock_share");
  });
});
