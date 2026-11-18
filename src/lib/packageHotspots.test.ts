import { describe, expect, it } from "vitest";
import { compatibleHotspotAlternative, hotspotConfigurationError, hotspotPinsError } from "./packageHotspots";

describe("package hotspot rules", () => {
  const source = { id: "original", category_role: "lounge_chair", width_m: 1, depth_m: 2 };
  it("requires the same category role", () => expect(compatibleHotspotAlternative(source, { ...source, id: "other", category_role: "dining_chair" })).toBe(false));
  it("accepts inclusive ±15% width and depth", () => {
    expect(compatibleHotspotAlternative(source, { ...source, id: "other", width_m: .85, depth_m: 2.3 })).toBe(true);
    expect(compatibleHotspotAlternative(source, { ...source, id: "other", width_m: 1.15, depth_m: 1.7 })).toBe(true);
    expect(compatibleHotspotAlternative(source, { ...source, id: "other", width_m: 1.151 })).toBe(false);
    expect(compatibleHotspotAlternative(source, { ...source, id: "other", depth_m: 1.699 })).toBe(false);
  });
  it("never guesses missing measurements", () => expect(compatibleHotspotAlternative(source, { ...source, id: "other", width_m: null })).toBe(false));
  it("requires 2–4 unique compatible pins on enabled swaps", () => {
    const alternatives = ["a", "b", "c", "d", "e"].map(id => ({ id })) as Parameters<typeof hotspotPinsError>[0]["alternatives"];
    const check = (pins: string[]) => hotspotPinsError({ is_swappable: true, pinned_alternative_ids: pins, alternatives });
    expect(check(["a"])).not.toBeNull(); expect(check(["a", "b"])).toBeNull(); expect(check(["a", "b", "c", "d"])).toBeNull(); expect(check(["a", "b", "c", "d", "e"])).not.toBeNull(); expect(check(["a", "a"])).not.toBeNull(); expect(check(["a", "x"])).not.toBeNull();
  });
  it("allows disabled slots without pins", () => expect(hotspotPinsError({ is_swappable: false, pinned_alternative_ids: [], alternatives: [] })).toBeNull());
  it("requires complete manual dimensions before enabling a custom swap", () => {
    const base = { category_role: "console", category_role_override: "console", width_m: 1.5, depth_m: .4, height_m: .8, width_m_override: 1.5, depth_m_override: .4, height_m_override: .8, is_swappable: true, alternatives: [] };
    expect(hotspotConfigurationError({ ...base, pinned_alternative_ids: [] })).toBe("Select 2–4 approved options for each enabled swap.");
    expect(hotspotConfigurationError({ ...base, height_m_override: null, pinned_alternative_ids: [] })).toBe("Select 2–4 approved options for each enabled swap.");
    expect(hotspotConfigurationError({ ...base, height_m: null, height_m_override: null, pinned_alternative_ids: [] })).toBe("Add a category and W × D × H dimensions before enabling swaps.");
    expect(hotspotConfigurationError({ ...base, width_m: null, depth_m: null, height_m: null, width_m_override: null, depth_m_override: null, height_m_override: null, pinned_alternative_ids: [] })).toBe("Add a category and W × D × H dimensions before enabling swaps.");
  });
  it("accepts every requested manual category and rejects unsupported roles", () => {
    const base = { category_role: "sofa", category_role_override: "sofa", width_m: 2, depth_m: 1, height_m: .8, width_m_override: null, depth_m_override: null, height_m_override: null, is_swappable: false, pinned_alternative_ids: [], alternatives: [] };
    for (const category_role of ["sofa", "lounge_chair", "coffee_table", "side_table", "console"]) expect(hotspotConfigurationError({ ...base, category_role, category_role_override: category_role })).toBeNull();
    expect(hotspotConfigurationError({ ...base, category_role_override: "dining_chair" })).toBe("Choose a supported category.");
  });
});