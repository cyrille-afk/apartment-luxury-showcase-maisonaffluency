import { describe, expect, it } from "vitest";
import {
  EU_VAT_RATES,
  TAX_RULES,
  computeDutyCents,
  isBuyerTaxIdValid,
  resolveShipFrom,
  resolveTaxRule,
  resolveTaxTreatment,
} from "./taxRules";

const base = { goodsCents: 5_000_000, shippingCents: 100_000 };

describe("resolveTaxTreatment — United Kingdom", () => {
  it("charges 20% VAT to a private UK consumer on a low-value order", () => {
    const r = resolveTaxTreatment({
      country: "GB",
      currency: "GBP",
      buyerType: "private",
      buyerTaxId: null,
      goodsCents: 10_000,
      shippingCents: 0,
    });
    expect(r.rate).toBe(0.2);
    expect(r.taxCents).toBe(2_000);
    // Below the £135 threshold: VAT prepaid at checkout, no clearance fee.
    expect(r.treatment).toBe("ddp_import");
    expect(r.clearanceFeeCents).toBe(0);
  });

  it("reverse charges only when the registration is authority-verified", () => {
    const r = resolveTaxTreatment({
      country: "GB",
      currency: "GBP",
      buyerType: "business",
      buyerTaxId: "gb123456789",
      buyerTaxIdVerified: true,
      goodsCents: 10_000,
      shippingCents: 0,
    });
    expect(r.treatment).toBe("reverse_charge");
    expect(r.taxCents).toBe(0);
    expect(r.buyerTaxId).toBe("GB123456789");
    expect(r.statement).toMatch(/reverse charge/i);
  });

  it("falls back to destination VAT when the number is unverified", () => {
    const r = resolveTaxTreatment({
      country: "GB",
      currency: "GBP",
      buyerType: "business",
      buyerTaxId: "GB123456789",
      buyerTaxIdVerified: false,
      goodsCents: 10_000,
      shippingCents: 0,
    });
    expect(r.treatment).toBe("ddp_import");
    expect(r.taxCents).toBe(2_000);
    expect(r.buyerTaxIdVerified).toBe(false);
  });

  it("routes a high-value consignment through DDP import clearance", () => {
    const r = resolveTaxTreatment({
      country: "GB",
      currency: "GBP",
      buyerType: "business",
      buyerTaxId: "GB123456789",
      ...base,
    });
    expect(r.treatment).toBe("ddp_import");
    expect(r.requiresDdpClearance).toBe(true);
    expect(r.clearanceFeeCents).toBeGreaterThan(0);
  });

  it("rejects a malformed UK VAT number", () => {
    expect(isBuyerTaxIdValid(resolveTaxRule("GB", "GBP"), "GB12345")).toBe(false);
  });
});

describe("resolveTaxTreatment — Singapore", () => {
  it("charges GST to a private buyer", () => {
    const r = resolveTaxTreatment({
      country: "SG",
      currency: "SGD",
      buyerType: "private",
      buyerTaxId: null,
      ...base,
    });
    expect(r.rate).toBeGreaterThan(0);
    expect(r.taxCents).toBeGreaterThan(0);
  });

  it("zero-rates a verified UEN business buyer", () => {
    const r = resolveTaxTreatment({
      country: "SG",
      currency: "SGD",
      buyerType: "business",
      buyerTaxId: "201912345K",
      buyerTaxIdVerified: true,
      ...base,
    });
    expect(r.treatment).toBe("b2b_zero_rated");
    expect(r.taxCents).toBe(0);
  });

  it("charges GST when the UEN was not verified", () => {
    const r = resolveTaxTreatment({
      country: "SG",
      currency: "SGD",
      buyerType: "business",
      buyerTaxId: "201912345K",
      ...base,
    });
    expect(r.taxCents).toBeGreaterThan(0);
  });
});

describe("EU coverage", () => {
  it("carries a standard rate for all 27 member states", () => {
    expect(Object.keys(EU_VAT_RATES)).toHaveLength(27);
    expect(EU_VAT_RATES.FR).toBe(0.2);
    expect(EU_VAT_RATES.DE).toBe(0.19);
    expect(EU_VAT_RATES.IT).toBe(0.22);
    for (const code of Object.keys(EU_VAT_RATES)) {
      expect(TAX_RULES.some((r) => r.country === code)).toBe(true);
    }
  });

  it("applies the German rate to a private Berlin buyer", () => {
    const r = resolveTaxTreatment({
      country: "DE",
      currency: "EUR",
      buyerType: "private",
      buyerTaxId: null,
      goodsCents: 10_000,
      shippingCents: 0,
      goodsEurCents: 10_000,
    });
    expect(r.rate).toBe(0.19);
    expect(r.taxCents).toBe(1_900);
  });

  it("routes an EU consignment over €150 through DDP", () => {
    const r = resolveTaxTreatment({
      country: "FR",
      currency: "EUR",
      buyerType: "private",
      buyerTaxId: null,
      goodsCents: 5_000_000,
      shippingCents: 0,
      goodsEurCents: 5_000_000,
    });
    expect(r.requiresDdpClearance).toBe(true);
    expect(r.treatment).toBe("ddp_import");
  });
});

describe("currency independence", () => {
  it("applies UK VAT when a GB buyer pays in EUR", () => {
    const r = resolveTaxTreatment({
      country: "GB",
      currency: "EUR",
      buyerType: "private",
      buyerTaxId: null,
      goodsCents: 10_000,
      shippingCents: 0,
    });
    expect(r.rate).toBe(0.2);
    expect(r.charged).toBe(true);
  });

  it("applies SG GST when an SG buyer pays in USD", () => {
    const r = resolveTaxTreatment({
      country: "SG",
      currency: "USD",
      buyerType: "private",
      buyerTaxId: null,
      goodsCents: 10_000,
      shippingCents: 0,
    });
    expect(r.charged).toBe(true);
    expect(r.rate).toBeGreaterThan(0);
  });
});

describe("customs manifest", () => {
  it("estimates ad-valorem duty from the HS6 lines", () => {
    expect(
      computeDutyCents([
        { hs6Code: "940161", dutyRate: 0.027, lineTotalCents: 1_000_000 },
        { hs6Code: "940360", dutyRate: 0, lineTotalCents: 500_000 },
      ]),
    ).toBe(27_000);
  });

  it("treats a mixed-origin consignment as a third-country import", () => {
    expect(
      resolveShipFrom({
        country: "FR",
        currency: "EUR",
        buyerType: "private",
        buyerTaxId: null,
        goodsCents: 0,
        shippingCents: 0,
        lines: [
          { originCountry: "FR", lineTotalCents: 1 },
          { originCountry: "TH", lineTotalCents: 1 },
        ],
      }),
    ).toBe("TH");
  });
});

describe("resolveTaxTreatment — no rule", () => {
  it("returns no tax for an unmapped destination", () => {
    const r = resolveTaxTreatment({
      country: "US",
      currency: "USD",
      buyerType: "private",
      buyerTaxId: null,
      ...base,
    });
    expect(r.taxCents).toBe(0);
    expect(r.charged).toBe(false);
  });
});
