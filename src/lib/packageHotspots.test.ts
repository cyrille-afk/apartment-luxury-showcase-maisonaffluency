import { describe, expect, it } from "vitest";
import { compatibleHotspotAlternative, hotspotPinsError } from "./packageHotspots";

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
});