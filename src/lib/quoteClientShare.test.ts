import { describe, it, expect } from "vitest";
import { buildSharedQuoteSnapshot } from "./quoteClientShare";

describe("buildSharedQuoteSnapshot", () => {
  it("freezes separate Madison designer and publisher credits without trade values", () => {
    const s = buildSharedQuoteSnapshot("quote", null, [{ quantity: 1, unit_price_cents: 123400, unit_price_currency: "EUR", product: { product_name: "Madison Avenue Side Table by Yabu Pushelberg", brand_name: "Man of Parts", rrp_price_cents: 260000, currency: "EUR" } }]);
    expect(s.lines[0]).toMatchObject({ name: "Madison Avenue Side Table", designer: "Yabu Pushelberg", house: "Man of Parts", edition: "Man of Parts Edition", unitCents: 260000 });
    expect(JSON.stringify(s)).not.toContain("123400");
  });
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
  it("shows the chosen finish with its cropped swatch", () => {
    const product = { product_name: "Angelo M/H High Table", materials: "Natural Stone: Kynos, Grafite, Travertino Rosso", available_finishes: ["Kynos", "Grafite"] };
    const s = buildSharedQuoteSnapshot("28f3303b-0000", null, [{ quantity: 1, unit_price_cents: null, unit_price_currency: null, variant_label: "Ø 110 × H 92 cm · Travertino Rosso", wood_fabric: { name: "Travertino Rosso", image_url: "https://x/tr.jpg" }, product }]);
    expect(s.lines[0].finish).toBe("Travertino Rosso");
    expect(s.lines[0].finishSwatches).toEqual([{ name: "Travertino Rosso", image: "https://x/tr.jpg" }]);
    expect(s.lines[0].finishOptions).toEqual([]);
  });
  it("offers each finish at the recorded size with its own retail price and swatch, marking the designer's choice", () => {
    const size_variants = [
      { base: "Ø 90 × H 92 cm", top: "Kynos", price_cents: 921600 },
      { base: "Ø 110 × H 92 cm", top: "Kynos", price_cents: 977300 },
      { base: "Ø 110 × H 92 cm", top: "Travertino Rosso / Grey Saint Laurent", price_cents: 1241500 },
    ];
    const swatches = [{ name: "Kyknos", image_url: "https://x/k.jpg", fabric_id: "k" }, { name: "Travertino Rosso", image_url: "https://x/tr.jpg", fabric_id: "tr" }];
    const s = buildSharedQuoteSnapshot("28f3303b-0000", null, [{ id: "line-1", quantity: 1, unit_price_cents: null, unit_price_currency: null, variant_label: "Ø 110 × H 92 cm · Travertino Rosso", product: { product_name: "Angelo", currency: "EUR", size_variants, source_pick_id: "p" } }], { p: swatches });
    const line = s.lines[0];
    expect(line.finishChoices?.map((c) => [c.name, c.unitCents])).toEqual([["Kynos", 977300], ["Travertino Rosso", 1241500], ["Grey Saint Laurent", 1241500]]);
    expect(line.finishChoices?.[0].image).toBe("https://x/k.jpg");
    expect(line.designerFinishKey).toBe("travertino-rosso");
    expect(line.finishSwatches).toEqual([{ name: "Travertino Rosso", image: "https://x/tr.jpg" }]);
    expect(line.itemId).toBe("line-1");
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
