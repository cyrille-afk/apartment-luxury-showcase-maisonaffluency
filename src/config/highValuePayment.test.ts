import { describe, expect, it } from "vitest";
import {
  cardPracticalLimitCents,
  depositAmountCents,
  isHighValueOrder,
} from "./highValuePayment";

describe("high-value payment routing", () => {
  it("treats a £50,000 London order as beyond a card", () => {
    expect(isHighValueOrder(50_000_00, "GBP")).toBe(true);
    expect(cardPracticalLimitCents("GBP")).toBe(20_000_00);
  });

  it("leaves ordinary orders on the card path", () => {
    expect(isHighValueOrder(4_800_00, "GBP")).toBe(false);
    expect(isHighValueOrder(30_000_00, "SGD")).toBe(false);
  });

  it("falls back to a sane ceiling for unlisted currencies", () => {
    expect(cardPracticalLimitCents("NOK")).toBe(25_000_00);
  });

  it("rounds deposits to whole currency units", () => {
    expect(depositAmountCents(50_000_00, 0.3)).toBe(15_000_00);
    expect(depositAmountCents(1_234_57, 0.5)).toBe(617_00);
    expect(depositAmountCents(50_000_00, 0)).toBe(50_000_00);
  });
});
