import { describe, expect, it } from "vitest";
import { comparatorSwatches, splitComparatorSwatches } from "./comparatorSwatches";

describe("comparator swatches", () => {
  it("shows six finishes and keeps every remaining finish in overflow", () => {
    const all = Array.from({ length: 9 }, (_, i) => ({ id: String(i), name: `Finish ${i}` }));
    const { visible, more } = splitComparatorSwatches(all);
    expect(visible.map(s => s.id)).toEqual(["0", "1", "2", "3", "4", "5"]);
    expect(more.map(s => s.id)).toEqual(["6", "7", "8"]);
  });
  it("retains real linked textures without inventing photographs for unmatched materials", () => {
    expect(comparatorSwatches("Tobacco Oak\nCOM Fabric", [{ id: "oak", name: "Tobacco Oak", imageUrl: "https://example.com/oak.jpg" }])).toEqual([
      { id: "oak", name: "Tobacco Oak", imageUrl: "https://example.com/oak.jpg" },
      { id: "material:com fabric", name: "COM Fabric", color: null },
    ]);
  });
  it("uses explicit hex colours and deduplicates equivalent material labels", () => {
    const result = comparatorSwatches("Ivory #F0EADB\n ivory #f0eadb", []);
    expect(result).toHaveLength(1); expect(result[0].color).toBe("#F0EADB");
  });
});