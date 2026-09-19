import { describe, expect, it } from "vitest";
import { isBuyerTaxIdValid, resolveTaxRule, resolveTaxTreatment } from "./taxRules";

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
    expect(r.treatment).toBe("standard");
  });

  it("reverse charges a low-value supply to a VAT-registered UK business", () => {
    const r = resolveTaxTreatment({
      country: "GB",
      currency: "GBP",
      buyerType: "business",
      buyerTaxId: "gb123456789",
      goodsCents: 10_000,
      shippingCents: 0,
    });
    expect(r.treatment).toBe("reverse_charge");
    expect(r.taxCents).toBe(0);
    expect(r.buyerTaxId).toBe("GB123456789");
    expect(r.statement).toMatch(/reverse charge/i);
  });

  it("zero-rates an export above the low-value threshold", () => {
    const r = resolveTaxTreatment({
      country: "GB",
      currency: "GBP",
      buyerType: "business",
      buyerTaxId: "GB123456789",
      ...base,
    });
    expect(r.treatment).toBe("export_zero_rated");
    expect(r.taxCents).toBe(0);
    expect(r.statement).toMatch(/border/i);
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

  it("zero-rates a valid UEN business buyer", () => {
    const r = resolveTaxTreatment({
      country: "SG",
      currency: "SGD",
      buyerType: "business",
      buyerTaxId: "201912345K",
      ...base,
    });
    expect(r.treatment).toBe("b2b_zero_rated");
    expect(r.taxCents).toBe(0);
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
