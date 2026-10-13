import { describe, expect, it } from "vitest";
import { countTradeCollectionPieces, filterTradeProducts } from "@/lib/tradeFilter";
import type { TradeProduct } from "@/lib/tradeProducts";

const base: TradeProduct = {
  id: "1",
  product_name: "Piece",
  brand_name: "Atelier",
  subtitle: null,
  edition: null,
  category: "Furniture",
  subcategory: "Tables",
  materials: null,
  materials_description: null,
  description: null,
  reedition_by: null,
  tags: [],
  image_url: null,
} as unknown as TradeProduct;

const mk = (over: Partial<TradeProduct>): TradeProduct => ({ ...base, ...over });

const fuga = mk({
  id: "fuga",
  product_name: "Fuga Scene 1",
  brand_name: "Atelier Février",
  edition: "CC-Tapis Edition",
  category: "Rugs",
  subcategory: "Rugs",
});
const mushroom = mk({
  id: "mushroom",
  product_name: "Mushroom",
  brand_name: "Emma Donnersberg",
  edition: "CC-Tapis Edition",
  category: "Rugs",
  subcategory: "Rugs",
});
const puzzle = mk({
  id: "puzzle",
  product_name: "Puzzle Console",
  brand_name: "Michel Amar Studio",
  edition: "Michel Amar x Emma Donnersberg",
  category: "Furniture",
  subcategory: "Consoles",
});
const all = [fuga, mushroom, puzzle];

describe("filterTradeProducts", () => {
  it("combines designer, category, collection and search (AND)", () => {
    const result = filterTradeProducts(all, {
      search: "fuga",
      brand: "Atelier Février",
      category: "Rugs",
      edition: "CC-Tapis Edition",
    });
    expect(result.map((p) => p.id)).toEqual(["fuga"]);
  });

  it("drops pieces failing any single active filter", () => {
    // Same collection + category + search token "mushroom", wrong designer.
    expect(
      filterTradeProducts(all, {
        search: "mushroom",
        brand: "Atelier Février",
        category: "Rugs",
        edition: "CC-Tapis Edition",
      }),
    ).toEqual([]);
  });

  it("treats 'all' and empty criteria as inactive", () => {
    expect(filterTradeProducts(all, {}).map((p) => p.id)).toEqual(["fuga", "mushroom", "puzzle"]);
    expect(
      filterTradeProducts(all, { brand: "all", category: "all", subcategory: "all", edition: "all" }),
    ).toHaveLength(3);
  });

  it("matches a credited designer via reedition_by", () => {
    const reedition = mk({ id: "reed", brand_name: "Ecart", reedition_by: "Andrée Putman" });
    expect(filterTradeProducts([reedition], { brand: "Andrée Putman" })).toHaveLength(1);
  });

  it("combines subcategory with collection", () => {
    const result = filterTradeProducts(all, {
      subcategory: "Consoles",
      edition: "Michel Amar x Emma Donnersberg",
    });
    expect(result.map((p) => p.id)).toEqual(["puzzle"]);
  });
});

describe("countTradeCollectionPieces", () => {
  const unlabelled = mk({ id: "plain", product_name: "Bare Table", brand_name: "Michel Amar Studio" });
  const withPlain = [...all, unlabelled];

  it("counts every piece in each collection for the chosen designer", () => {
    const counts = countTradeCollectionPieces(all, { brand: "Atelier Février" });
    expect(counts.total).toBe(1);
    expect(counts.byCollection.get("cc-tapis edition")).toBe(1);
    expect(counts.byCollection.has("michel amar x emma donnersberg")).toBe(false);
  });

  it("ignores the collection filter itself but respects the other filters", () => {
    const counts = countTradeCollectionPieces(all, {
      category: "Rugs",
      edition: "CC-Tapis Edition",
    });
    expect(counts.total).toBe(2);
    expect(counts.byCollection.get("cc-tapis edition")).toBe(2);
    expect(counts.byCollection.has("michel amar x emma donnersberg")).toBe(false);
  });

  it("narrows counts with search", () => {
    const counts = countTradeCollectionPieces(all, { search: "mushroom" });
    expect(counts.total).toBe(1);
    expect(counts.byCollection.get("cc-tapis edition")).toBe(1);
  });

  it("counts pieces without a collection in the total only", () => {
    const counts = countTradeCollectionPieces(withPlain, {});
    expect(counts.total).toBe(4);
    expect(counts.byCollection.get("cc-tapis edition")).toBe(2);
    expect(counts.byCollection.get("michel amar x emma donnersberg")).toBe(1);
    expect(counts.byCollection.size).toBe(2);
  });
});
