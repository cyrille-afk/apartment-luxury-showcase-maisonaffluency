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
    // DDP handling is the forwarder-confirmed €80 flat + 2% of freight
    // (£40 + £80 = £120 here), so the CIF value assessed is £52,120.
    expect(est.handlingCents).toBe(12_000);
    expect(est.vatCents).toBe(1_042_400);
    expect(est.clearanceCents).toBe(15_000);
    expect(est.totalCents).toBe(1_057_400);
    expect(est.deferredTotalCents).toBe(0);
    expect(est.taxName).toBe("UK VAT");
  });

  it("defers the border charges and drops the handling fee under DDU", () => {
    const ddu = getLandedCostEstimate({
      countryCode: "GB",
      goodsCents: 5_000_000,
      freightCents: 200_000,
      incoterm: "DDU",
    });
    expect(ddu.incoterm).toBe("DDU");
    expect(ddu.handlingCents).toBe(0);
    // Nothing is collected at checkout...
    expect(ddu.totalCents).toBe(0);
    expect(ddu.vatCents).toBe(0);
    // ...but the buyer is shown what the carrier will invoice: 20% of £52,000
    // plus the £150 clearance fee.
    expect(ddu.deferredTotalCents).toBe(1_055_000);
    expect(ddu.note).toContain("Delivered Duty Unpaid");
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

  it("uses the converted flat handling fee when supplied", () => {
    const est = getLandedCostEstimate({
      countryCode: "GB",
      goodsCents: 100_000,
      freightCents: 100_000,
      handlingFlatInOrderCurrencyCents: 6_900, // €80 → £69
    });
    // 2% of £1,000 (£20) + £69 flat.
    expect(est.handlingCents).toBe(8_900);
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
