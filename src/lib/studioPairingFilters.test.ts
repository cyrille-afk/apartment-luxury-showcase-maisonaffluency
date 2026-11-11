import { describe, expect, it } from "vitest";
import { filterStudioPairings, studioPairingFilterOptions } from "./studioPairingFilters";

const pairings = [
  { id: "oak-table", category: "Coffee Tables", finishes: ["oak", "timber"] },
  { id: "bronze-table", category: "Coffee Tables", finishes: ["bronze"] },
  { id: "oak-lamp", category: "Lighting", finishes: ["oak", "ceramic"] },
  { id: "unknown", category: "Mirrors", finishes: [] },
];

describe("Studio pairing filters", () => {
  it("narrows by category", () => {
    expect(filterStudioPairings(pairings, "Coffee Tables", "").map(p => p.id)).toEqual(["oak-table", "bronze-table"]);
  });
  it("narrows by recorded finish", () => {
    expect(filterStudioPairings(pairings, "", "oak").map(p => p.id)).toEqual(["oak-table", "oak-lamp"]);
  });
  it("requires both filters and retains the original ranking", () => {
    expect(filterStudioPairings(pairings, "Coffee Tables", "oak").map(p => p.id)).toEqual(["oak-table"]);
    expect(filterStudioPairings(pairings, "Mirrors", "oak")).toEqual([]);
  });
  it("clearing filters restores every pairing", () => {
    expect(filterStudioPairings(pairings, "", "")).toEqual(pairings);
  });
  it("offers only unique recorded categories and finishes", () => {
    expect(studioPairingFilterOptions(pairings)).toEqual({ categories: ["Coffee Tables", "Lighting", "Mirrors"], finishes: ["bronze", "ceramic", "oak", "timber"] });
  });
});