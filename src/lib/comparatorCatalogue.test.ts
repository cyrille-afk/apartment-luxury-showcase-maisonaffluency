import { describe, expect, it } from "vitest";
import { comparatorDesignerGroups, comparatorPrices } from "./comparatorCatalogue";
import type { TradeProduct } from "./tradeProducts";

const piece = (id: string, brand_name: string, product_name: string): TradeProduct => ({ id, brand_name, product_name, category: "Seating", tags: [], image_url: null });
describe("comparator catalogue", () => {
  const products = [piece("b", "Zanellato", "Chair"), piece("a", "Andrée Putman", "Sofa"), piece("c", "Andrée Putman", "Armchair")];
  it("browses designers A–Z and every curator pick under each designer", () => {
    expect(comparatorDesignerGroups(products, "", "").map(g => [g.designer, g.pieces.map(p => p.id)])).toEqual([["Andrée Putman", ["c", "a"]], ["Zanellato", ["b"]]]);
  });
  it("filters an accented designer by alphabet and searches pieces", () => {
    expect(comparatorDesignerGroups(products, "sofa", "A")[0]?.pieces.map(p => p.id)).toEqual(["a"]);
    expect(comparatorDesignerGroups(products, "", "Z")[0]?.designer).toBe("Zanellato");
  });
  it("favourites are optional, not a catalogue prerequisite", () => {
    expect(comparatorDesignerGroups(products, "", "")).toHaveLength(2);
    expect(comparatorDesignerGroups(products, "", "", new Set(["b"])).map(g => g.designer)).toEqual(["Zanellato"]);
  });
});
describe("comparator tier prices", () => {
  it.each([[0.1, 728820], [0.12, 712624], [0.15, 688330]])("discounts the €8,098 RRP at rate %s", (discount, expected) => {
    expect(comparatorPrices({ trade_price_cents: 809800, rrp_price_cents: 809800 }, discount)).toEqual({ retail: 809800, trade: expected });
  });
  it("does not invent a price for unpriced products", () => {
    expect(comparatorPrices({ trade_price_cents: 0, rrp_price_cents: null }, 0.1)).toEqual({ retail: null, trade: null });
  });
});