import { describe, it, expect } from "vitest";
import { prepareFelixQuote } from "./felixQuoteSave";
import { felixQuoteTotals } from "./felixQuoteQuantity";
const ava = { productId: "cloud", productName: "Cloud", fabricLabel: "AVA Range", baseLabel: "Oak", unitPriceCents: 481500, priceCurrency: "EUR", quantity: 3 };
describe("Felix saved quote", () => {
  it("preserves AVA finishes, quantities and matching prices", () => {
    const [saved] = prepareFelixQuote([ava], "quote");
    expect(saved.quantity).toBe(3);
    expect(saved.unitPriceCents).toBe(481500);
    expect(saved.fabricLabel).toBe("AVA Range");
    expect(felixQuoteTotals([saved])[0].cents).toBe(1444500);
  });
  it("reuses identifiers on retries", () => {
    const saved = prepareFelixQuote([ava], "quote");
    expect(prepareFelixQuote(saved, "quote")).toEqual(saved);
  });
  it("updates quantity without adding a second line", () => {
    const [first] = prepareFelixQuote([ava], "quote");
    const [second] = prepareFelixQuote([{ ...first, quantity: 2 }], "quote");
    expect(second.savedLineId).toBe(first.savedLineId);
    expect(felixQuoteTotals([second])[0].cents).toBe(963000);
  });
  it("does not invent missing prices", () => {
    expect(prepareFelixQuote([{ ...ava, unitPriceCents: null }], "quote")[0].unitPriceCents).toBeNull();
  });
});