import { describe, expect, it } from "vitest";
import { priceDifferences, priceValue, startPriceAttempt, finishPriceAttempt, getPriceAttempts } from "./adminPriceHistory";
describe("admin price history", () => {
  it("records previous and new main prices in cents", () => {
    expect(priceDifferences({ trade_price_cents: 399000 }, { trade_price_cents: 499000 })).toEqual([{ label: "Main price", before: 399000, after: 499000 }]);
  });
  it("records changed finish prices without treating reordering as price changes", () => {
    const dark = { base: "Dark Solid Oak", price_cents: 499000 };
    expect(priceDifferences({ size_variants: [dark, { base: "Light Solid Oak", price_cents: 0 }] }, { size_variants: [{ base: "Light Solid Oak", price_cents: 499000 }, dark] })).toEqual([{ label: "Light Solid Oak", before: 0, after: 499000 }]);
  });
  it("does not mistake photo edits for price changes", () => {
    expect(priceDifferences({ size_variants: [{ base: "Oak", price_cents: 499000, image_index: 0 }] }, { size_variants: [{ base: "Oak", price_cents: 499000, image_index: 2 }] })).toEqual([]);
  });
  it("marks failed saves without inventing saved records", () => {
    const id = startPriceAttempt({ userId: "admin", product: "Chair", currency: "EUR", changes: [{ label: "Main price", before: 399000, after: 499000 }] });
    expect(getPriceAttempts().find((row) => row.id === id)?.status).toBe("Saving");
    finishPriceAttempt(id, "Failed");
    expect(getPriceAttempts().find((row) => row.id === id)?.status).toBe("Failed");
    finishPriceAttempt(id, "Saved");
    expect(getPriceAttempts().find((row) => row.id === id)).toBeUndefined();
  });
  it("does not render missing prices as free", () => { expect(priceValue(0, "EUR")).toBe("Price upon Request"); });
});