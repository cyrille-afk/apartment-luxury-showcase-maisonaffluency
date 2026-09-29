import { describe, expect, it } from "vitest";
import { curateGrid, type Tone } from "./curateGrid";

type Piece = { brand: string; tone: Tone };
const piece = (brand: string, tone: Tone = "light"): Piece => ({ brand, tone });

describe("curateGrid", () => {
  it("spreads a brand grouped at the end of the catalogue across the grid", () => {
    const items = [
      ...Array.from({ length: 20 }, (_, i) => piece(`Maker ${i}`)),
      ...Array.from({ length: 4 }, () => piece("Saint-Louis")),
    ];
    const curated = curateGrid(items, (item) => item.brand, (item) => item.tone);
    const positions = curated.flatMap((item, index) => item.brand === "Saint-Louis" ? [index] : []);
    expect(positions).toHaveLength(4);
    expect(positions[0]).toBeLessThan(10);
    expect(positions.every((position, i) => i === 0 || position - positions[i - 1] > 2)).toBe(true);
    expect(curated).toHaveLength(items.length);
  });

  it("inserts a light photo between dark ones while spacing repeated brands", () => {
    const items = [piece("A", "dark"), piece("B", "dark"), piece("C"), piece("A", "dark"), piece("A", "dark"), piece("D"), piece("E")];
    const curated = curateGrid(items, (item) => item.brand, (item) => item.tone);
    expect(curated).toHaveLength(items.length);
    expect(curated.every((item, i) => i === 0 || item.tone !== "dark" || curated[i - 1].tone !== "dark")).toBe(true);
    expect(curated.every((item, i) => i < 2 || item.brand !== curated[i - 1].brand || item.brand !== curated[i - 2].brand)).toBe(true);
  });

  it("disperses six late-arriving pieces from one maker among trade search results", () => {
    const items = [
      ...Array.from({ length: 16 }, (_, i) => piece(`Maker ${i}`)),
      ...Array.from({ length: 6 }, () => piece("Emmanuel Levet Stenne")),
    ];
    const curated = curateGrid(items, (item) => item.brand, (item) => item.tone);
    const positions = curated.flatMap((item, i) => item.brand === "Emmanuel Levet Stenne" ? [i] : []);
    expect(positions).toHaveLength(6);
    expect(positions[0]).toBeLessThan(8);
    expect(positions.every((position, i) => i === 0 || position - positions[i - 1] > 2)).toBe(true);
    expect(curated).toHaveLength(items.length);
  });
});