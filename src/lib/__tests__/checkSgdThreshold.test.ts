import { describe, it, expect } from "vitest";
import { checkSgdThreshold } from "@/lib/checkout/checkSgdThreshold";

describe("checkSgdThreshold", () => {
  it("returns low-value goods true for exactly S$400", () => {
    const result = checkSgdThreshold(400 / 1.35, 1.35);
    expect(result.isLowValueGoods).toBe(true);
    expect(result.sgdEquivalent).toBe(400);
  });

  it("returns low-value goods true for values below S$400", () => {
    const result = checkSgdThreshold(100, 1.35);
    expect(result.isLowValueGoods).toBe(true);
    expect(result.sgdEquivalent).toBe(135);
  });

  it("returns low-value goods false for values above S$400", () => {
    const result = checkSgdThreshold(500, 1.35);
    expect(result.isLowValueGoods).toBe(false);
    expect(result.sgdEquivalent).toBe(675);
  });

  it("uses the default 1.35 rate when no rate is provided", () => {
    const result = checkSgdThreshold(1000);
    expect(result.sgdEquivalent).toBe(1350);
    expect(result.isLowValueGoods).toBe(false);
  });

  it("allows a custom conversion rate", () => {
    const result = checkSgdThreshold(500, 1.4);
    expect(result.sgdEquivalent).toBe(700);
    expect(result.isLowValueGoods).toBe(false);
  });

  it("rounds the SGD equivalent to two decimals", () => {
    const result = checkSgdThreshold(123.456, 1.35);
    expect(result.sgdEquivalent).toBe(166.67);
  });
});
