import { describe, expect, it } from "vitest";
import { comparatorFacets, finishFacetKey, matchesComparatorFacets, mergeFacetOverrides, previewFacetGroups } from "./comparatorFacets";

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
  it("uses explicit admin categories for ambiguous finish names", () => {
    const o = new Map([[finishFacetKey("Opera Drift"), { material: "Fabric", color: "Beige" }]]);
    const f = comparatorFacets("Opera Drift", [], o);
    expect(f.material).toEqual(["Fabric"]);
    expect(f.color).toEqual(["Beige"]);
    expect(comparatorFacets("Opera Drift").material).toEqual([]);
  });
  it("an explicit category replaces guessed words for that kind only", () => {
    const f = comparatorFacets("Dark Oak", [], new Map([[finishFacetKey("dark oak"), { color: "Brown" }]]));
    expect(f.color).toEqual(["Brown"]);
    expect(f.material).toEqual(["Oak"]);
  });
});
