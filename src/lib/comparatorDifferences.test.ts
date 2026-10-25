import { describe, expect, it } from "vitest";
import { differingSpecificationCells } from "./comparatorDifferences";
import type { TradeProduct } from "./tradeProducts";
const piece = (fields: Partial<TradeProduct>): TradeProduct => ({ id: "piece", product_name: "Piece", brand_name: "Maker", category: "Seating", tags: [], image_url: null, ...fields });
describe("specification differences", () => {
  it("highlights differing populated values but not empty slots", () => {
    expect(differingSpecificationCells([piece({ category: "Seating" }), piece({ category: "Lighting" }), null], "category")).toEqual([true, true, false]);
  });
  it("leaves equivalent values and single-product comparisons unhighlighted", () => {
    expect(differingSpecificationCells([piece({ category: " Seating " }), piece({ category: "seating" }), piece({ category: "" })], "category")).toEqual([false, false, false]);
    expect(differingSpecificationCells([piece({ dimensions: "W 76 cm" }), null], "dimensions")).toEqual([false, false]);
  });
  it("compares material lists independent of order and separators", () => {
    expect(differingSpecificationCells([piece({ materials: "Oak · Leather" }), piece({ materials: "leather\nOak" })], "materials")).toEqual([false, false]);
    expect(differingSpecificationCells([piece({ materials: "Oak · Leather" }), piece({ materials: "Oak · Fabric" })], "materials")).toEqual([true, true]);
  });
  it("never treats pricing as a specification difference", () => {
    expect(differingSpecificationCells([piece({}), piece({})], "trade_price_cents")).toEqual([false, false]);
  });
});