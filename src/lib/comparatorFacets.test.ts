import { describe, expect, it } from "vitest";
import { comparatorFacets, matchesComparatorFacets } from "./comparatorFacets";

describe("comparatorFacets", () => {
  it("classifies material, finish and colour from names", () => {
    const f = comparatorFacets("Tobacco Oak\nGouge Dark Bronze • Polished Brass", [{ id: "1", name: "Black lacquer" }]);
    expect(f.material).toEqual(["Brass", "Bronze", "Oak"]);
    expect(f.finish).toEqual(["Lacquered", "Polished"]);
    expect(f.color).toEqual(["Black", "Dark", "Tobacco"]);
  });
  it("requires every chosen facet to match", () => {
    const f = comparatorFacets("Polished Brass");
    expect(matchesComparatorFacets(f, { material: "Brass", finish: "Polished" })).toBe(true);
    expect(matchesComparatorFacets(f, { material: "Oak" })).toBe(false);
  });
});
