import { describe, expect, it } from "vitest";
import {
  getLandedCostEstimate,
  getLandedCostRule,
  getShippingZone,
} from "./shippingZones";

describe("UK landed cost", () => {
  it("prices the UK as its own third-country zone, not Domestic EU", () => {
    const zone = getShippingZone("GB");
    expect(zone?.label).toBe("United Kingdom (DDP)");
    expect(zone?.currency).toBe("GBP");
  });

  it("charges 20% UK VAT on goods plus freight, with clearance", () => {
    const est = getLandedCostEstimate({
      countryCode: "GB",
      goodsCents: 5_000_000, // £50,000
      freightCents: 200_000, // £2,000
    });
    expect(est.available).toBe(true);
    expect(est.dutyCents).toBe(0);
    expect(est.vatCents).toBe(1_040_000); // 20% of 52,000
    expect(est.clearanceCents).toBe(15_000);
    expect(est.totalCents).toBe(1_055_000);
    expect(est.taxName).toBe("UK VAT");
  });

  it("applies a converted clearance fee when supplied", () => {
    const est = getLandedCostEstimate({
      countryCode: "GB",
      goodsCents: 100_000,
      freightCents: 0,
      clearanceInOrderCurrencyCents: 17_500,
    });
    expect(est.clearanceCents).toBe(17_500);
  });

  it("returns nothing for destinations that need no import clearance", () => {
    expect(getLandedCostRule("FR")).toBeNull();
    expect(
      getLandedCostEstimate({ countryCode: "FR", goodsCents: 100_000 }).available,
    ).toBe(false);
  });

  it("covers Switzerland and the UAE", () => {
    expect(getLandedCostRule("CH")?.vatPercent).toBe(8.1);
    expect(getLandedCostRule("AE")?.dutyPercent).toBe(5);
  });
});
