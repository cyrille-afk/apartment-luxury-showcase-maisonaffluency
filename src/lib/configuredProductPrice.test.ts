import { describe, expect, it } from "vitest";
import { configuredProductPrice } from "./configuredProductPrice";

describe("Cloud Stratus selected-finish pricing", () => {
  it("keeps AVA at €5,350 retail and €4,815 Silver net", () => {
    expect(configuredProductPrice(535000, 0, 0.10)).toEqual({ retailCents: 535000, netCents: 481500 });
  });
  it("keeps COM at €5,000 retail and €4,500 Silver net", () => {
    expect(configuredProductPrice(500000, 0, 0.10)).toEqual({ retailCents: 500000, netCents: 450000 });
  });
  it("does not discount a separately priced fabric surcharge", () => {
    expect(configuredProductPrice(535000, 12000, 0.10)).toEqual({ retailCents: 547000, netCents: 493500 });
  });
});