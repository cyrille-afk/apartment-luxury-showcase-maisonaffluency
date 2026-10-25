import { describe, expect, it } from "vitest";
import { comparatorFacets, finishFacetKey, groupedMaterialOptions, matchesComparatorFacets, mergeFacetOverrides, previewFacetGroups, materialParent, materialOptionLabel, materialParentOptions, materialTypeOptions, selectMaterialOption } from "./comparatorFacets";

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
  it("preview shows which pieces each filter would list after draft categories merge", () => {
    const merged = mergeFacetOverrides({ "Opera Drift": { material: null, finish: null, color: "Beige" }, "Unchanged": {} });
    const groups = previewFacetGroups([
      { name: "Clam Chair", materials: "Opera Drift", linked: [] },
      { name: "Bench", materials: "Solid Oak frame", linked: [] },
    ], merged);
    expect(groups.material).toEqual([{ value: "Oak", pieces: ["Bench"] }]);
    expect(groups.color).toEqual([{ value: "Beige", pieces: ["Clam Chair"] }]);
    // a row the admin leaves empty falls back to the automatic guess
    const guessed = mergeFacetOverrides({ "Opera Drift": {} });
    expect(previewFacetGroups([{ name: "Clam Chair", materials: "Opera Drift", linked: [] }], guessed).color).toEqual([]);
  });
  it("selecting Wood includes Ash and Oak pieces; Type narrows to one", () => {
    const oak = comparatorFacets("Natural Oak"), ash = comparatorFacets("White Ash"), bronze = comparatorFacets("Dark Bronze");
    expect([oak, ash, bronze].map(f => matchesComparatorFacets(f, { material: "Wood" }))).toEqual([true, true, false]);
    expect([oak, ash].map(f => matchesComparatorFacets(f, { material: "Wood", materialType: "Ash" }))).toEqual([false, true]);
    expect(materialParentOptions(["Oak", "Ash", "Bronze"])).toEqual(["Wood", "Metal"]);
    expect(materialTypeOptions(["Oak", "Ash", "Bronze", "Wood"], "Wood")).toEqual(["Ash", "Oak"]);
    expect(materialTypeOptions(["Oak", "Ash", "Bronze"], "Metal")).toEqual(["Bronze"]);
  });
  it("grouped dropdown: family headers, shared textiles header, generic value leads its group", () => {
    const groups = groupedMaterialOptions(["Oak", "Ash", "Bronze", "Fabric", "Leather"]);
    expect(groups.map(g => g.header)).toEqual(["Wood", "Metal", "Textiles & Leather"]);
    expect(groups[2].items.slice(0, 2)).toEqual(["Fabric", "Leather"]);
    expect(groupedMaterialOptions(["Oak", "Wood"])[0].items).toEqual(["Wood", "Ash", "Beech", "Cherry", "Elm", "Maple", "Oak", "Teak", "Walnut"]);
    expect(groupedMaterialOptions(["Ceramic"])).toEqual([{ header: "Other", items: ["Ceramic"] }]);
  });
  it("picking a dropdown item narrows to the type, or matches the whole family for a generic name", () => {
    expect(selectMaterialOption("Ash")).toEqual({ material: "Wood", materialType: "Ash" });
    expect(selectMaterialOption("Fabric")).toEqual({ material: "Fabric" });
    expect(selectMaterialOption("all")).toEqual({ material: undefined, materialType: undefined });
  });
  it("places Parchment under Textiles & Leather", () => {
    expect(groupedMaterialOptions(["Parchment"]).map(g => g.header)).toEqual(["Textiles & Leather"]);
    expect(selectMaterialOption("Parchment")).toEqual({ material: "Leather", materialType: "Parchment" });
  });
  it("classifies Bouclé and Velvet as fabrics", () => {
    expect([materialParent("Bouclé"), materialParent("Velvet")]).toEqual(["Fabric", "Fabric"]);
    expect(matchesComparatorFacets(comparatorFacets("Bouclé Velvet"), { material: "Fabric" })).toBe(true);
  });
  it("keeps Walnut available under Wood even when current pieces only contain Oak", () => {
    expect(groupedMaterialOptions(["Oak"])[0].items).toContain("Walnut");
    expect(matchesComparatorFacets(comparatorFacets("Walnut"), selectMaterialOption("Walnut"))).toBe(true);
  });
  it("distinguishes the family-wide Wood option from its header", () => {
    expect(materialOptionLabel("Wood")).toBe("All wood");
    expect(materialOptionLabel("Walnut")).toBe("Walnut");
  });
});
