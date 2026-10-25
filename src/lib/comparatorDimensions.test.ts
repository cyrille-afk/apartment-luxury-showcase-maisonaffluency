import { describe, expect, it } from "vitest";
import { comparatorDimensionGroups } from "./comparatorDimensions";

describe("structured comparator dimensions", () => {
  it.each(["x", "X", "×", "|", "-"])("parses labelled axes separated by %s", separator => {
    expect(comparatorDimensionGroups(`W 79 cm ${separator} D 77 cm ${separator} H 67 cm`)[0]?.rows).toEqual([
      { label: "Width", metric: "79 cm", imperial: "31.1 in" },
      { label: "Depth", metric: "77 cm", imperial: "30.3 in" },
      { label: "Height", metric: "67 cm", imperial: "26.4 in" },
    ]);
  });
  it("labels auxiliary heights and ignores duplicate supplier inches", () => {
    expect(comparatorDimensionGroups("W 76.5 x D 87 x H 68.5 cm — SH 41 cm - AH 58.5 cm | W 30.1 x D 34.3 x H 27 in — SH 16.1 in - AH 23 in")[0]?.rows.slice(3)).toEqual([
      { label: "Seat Height", metric: "41 cm", imperial: "16.1 in" },
      { label: "Arm Height", metric: "58.5 cm", imperial: "23.0 in" },
    ]);
  });
  it("converts shared millimetres and suffix axes", () => {
    expect(comparatorDimensionGroups("790W X 770D X 670H mm")[0]?.rows.map(r => r.metric)).toEqual(["79 cm", "77 cm", "67 cm"]);
  });
  it("handles full labels, decimal commas and parenthesised equivalents", () => {
    expect(comparatorDimensionGroups("Width: 79 cm (31.1 in) | Seat Height: 41,5 cm | AR 58 cm")[0]?.rows.map(r => [r.label, r.metric])).toEqual([["Width", "79 cm"], ["Seat Height", "41.5 cm"], ["Arm Height", "58 cm"]]);
  });
  it("retains named sizes and diameter", () => {
    const groups = comparatorDimensionGroups("Small: Ø 80 x H 40 cm\nLarge: Ø 100 x H 45 cm");
    expect(groups.map(g => g.name)).toEqual(["Small", "Large"]);
    expect(groups[1]?.rows[0]).toEqual({ label: "Diameter", metric: "100 cm", imperial: "39.4 in" });
  });
  it("parses plain clusters without inventing units for unknown strings", () => {
    expect(comparatorDimensionGroups("79 X 77 X 67 cm")[0]?.rows.map(r => r.label)).toEqual(["Width", "Depth", "Height"]);
    expect(comparatorDimensionGroups("Made to measure")[0]?.rows).toEqual([]);
    expect(comparatorDimensionGroups("W 79 x D 77 x H 67")[0]?.rows).toEqual([]);
  });
  it("keeps product code numbers out of measurements and preserves ranges", () => {
    const group = comparatorDimensionGroups("056M W 240 x D 95 x H 75–80 cm")[0];
    expect(group?.rows.length).toBe(3);
    expect(group?.rows[2]?.metric).toBe("75–80 cm");
  });
});