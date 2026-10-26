import { describe, expect, it } from "vitest";
import { comparatorDesignerGroups, comparatorPrices, comparatorDetails, comparatorParentMaker } from "./comparatorCatalogue";
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
  it("makes child pieces available under both their designer and recorded parent house", () => {
    const products = [{ ...piece("frank", "Jean-Michel Frank", "Chair"), maker_name: "Ecart" }, { ...piece("fuga", "Cristián Mohaded", "Fuga"), maker_name: "CC-Tapis" }];
    expect(comparatorDesignerGroups(products, "", "E")[0]?.pieces.map(p => p.id)).toEqual(["frank"]);
    expect(comparatorDesignerGroups(products, "CC-Tapis", "").find(g => g.designer === "CC-Tapis")?.pieces.map(p => p.id)).toEqual(["fuga"]);
  });
  it("does not turn Dagmar founder Aaron Fitzgerald into a catalogue designer", () => {
    const maker = comparatorParentMaker("Aaron Fitzgerald", ["Dagmar", "Ecart", "CC-Tapis"]);
    expect(maker).toBeNull();
    const groups = comparatorDesignerGroups([{ ...piece("clam", "Dagmar", "Clam Chair, 1944"), subtitle: "Arnold Madsen", maker_name: maker }], "", "");
    expect(groups.map(group => group.designer)).toEqual(["Dagmar"]);
    expect(groups[0].pieces[0].subtitle).toBe("Arnold Madsen");
  });
  it("preserves published parent houses despite accent and case differences", () => {
    expect(comparatorParentMaker("écart", ["Dagmar", "Ecart"])).toBe("Ecart");
    expect(comparatorParentMaker("CC-Tapis", ["CC-Tapis"])).toBe("CC-Tapis");
  });
  it("includes favorites stored with the trade twin identity", () => {
    expect(comparatorDesignerGroups([{ ...piece("pick", "Ecart", "Chair"), trade_product_id: "trade" }], "", "", new Set(["trade"]))[0]?.pieces[0].id).toBe("pick");
  });
  it("keeps every recorded size and material while deduplicating repeated sizes", () => {
    const details = comparatorDetails({ size_variants: [{ label: "W 52.5 x D 56 x H 77 cm", base: "Solid Oak Wood", top: "Neve Fabric" }, { label: "W 52.5 x D 56 x H 77 cm", base: "Solid Stained Ash Wood", top: "Schiuma Fabric" }, { label: "W 60 x D 60 x H 80 cm", base: "Solid Oak Wood", top: "Acqua Fabric" }] });
    expect(details.dimensions.match(/52.5/g)).toHaveLength(1);
    expect(details.dimensions).toContain("W 60");
    expect(details.dimensions).toContain("in");
    expect(details.materials).toBe("Solid Oak Wood\nNeve Fabric\nSolid Stained Ash Wood\nSchiuma Fabric\nAcqua Fabric");
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