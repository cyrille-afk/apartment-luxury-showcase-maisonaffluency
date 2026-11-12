import { describe, expect, it } from "vitest";
import { filterMoodBoardCatalog, shouldRecommendMoodBoard } from "./moodBoardCatalog";

describe("mood board catalogue", () => {
  const products = Array.from({ length: 973 }, (_, index) => ({ product_name: `Piece ${index}`, brand_name: index === 972 ? "Maker B" : "Maker A", category: index === 972 ? "Lighting / Seating" : "Tables" }));
  it("searches all 973 records, including the final record", () => {
    expect(filterMoodBoardCatalog(products, "Piece 972", "All", "").map(p => p.product_name)).toEqual(["Piece 972"]);
  });
  it("combines category and maker without excluding dual-purpose placements", () => {
    expect(filterMoodBoardCatalog(products, "", "Seating", "Maker B")).toHaveLength(1);
    expect(filterMoodBoardCatalog(products, "", "Tables", "Maker B")).toHaveLength(0);
  });
  it("starts complements with one item and clears them with zero", () => {
    expect(shouldRecommendMoodBoard(1)).toBe(true);
    expect(shouldRecommendMoodBoard(0)).toBe(false);
  });
});