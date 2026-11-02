import { describe, it, expect } from "vitest";
import { buildSharedQuoteSnapshot } from "./quoteClientShare";

describe("buildSharedQuoteSnapshot", () => {
  it("includes recorded dimensions, materials and finish options without copying private product fields", () => {
    const product = { product_name: "Saint Honoré Sofa", dimensions: "W 280 × D 100 × H 80 cm", materials: "Solid oak and mohair", available_finishes: [" Natural oak ", "Black oak", "Natural oak", ""], internal_notes: "Private supplier notes" };
    const s = buildSharedQuoteSnapshot("e3ccd6aa-0000", null, [{ quantity: 1, unit_price_cents: null, unit_price_currency: null, product }]);
    expect(s.lines[0].dimensions).toBe("W 280 × D 100 × H 80 cm");
    expect(s.lines[0].materials).toBe("Solid oak and mohair");
    expect(s.lines[0].finishOptions).toEqual(["Natural oak", "Black oak"]);
    expect(JSON.stringify(s)).not.toContain("Private supplier notes");
  });
  it("does not invent materials or finish options for products without recorded specifications", () => {
    const s = buildSharedQuoteSnapshot("e3ccd6aa-0000", null, [{ quantity: 1, unit_price_cents: null, unit_price_currency: null, product: { product_name: "Piece" } }]);
    expect(s.lines[0].materials).toBeNull();
    expect(s.lines[0].finishOptions).toEqual([]);
  });
  it("shows the chosen finish with its swatch instead of the full catalogue stone list", () => {
    const product = { product_name: "Angelo M/H High Table", materials: "Natural Stone: Kynos, Grafite, Travertino Rosso", available_finishes: ["Kynos", "Grafite"] };
    const s = buildSharedQuoteSnapshot("28f3303b-0000", null, [{ quantity: 1, unit_price_cents: null, unit_price_currency: null, variant_label: "Ø 110 × H 92 cm · Travertino Rosso", wood_fabric: { name: "Travertino Rosso", image_url: "https://x/tr.jpg" }, product }]);
    expect(s.lines[0].finish).toBe("Travertino Rosso");
    expect(s.lines[0].finishSwatches).toEqual([{ name: "Travertino Rosso", image: "https://x/tr.jpg" }]);
    expect(s.lines[0].materials).toBeNull();
    expect(s.lines[0].finishOptions).toEqual([]);
  });
  it("uses retail price, never the net trade price", () => {
    const s = buildSharedQuoteSnapshot("e3ccd6aa-0000", "Mrs Tan", [
      { quantity: 7, unit_price_cents: 2034000, unit_price_currency: "EUR", product: { product_name: "Saint Honoré Sofa", rrp_price_cents: 2250000, currency: "EUR" } },
    ]);
    expect(s.lines[0].unitCents).toBe(2250000);
    expect(s.lines[0].lineTotalCents).toBe(2250000 * 7);
    expect(s.totals).toEqual([{ currency: "EUR", cents: 2250000 * 7 }]);
    expect(JSON.stringify(s)).not.toContain("2034000");
  });
});
