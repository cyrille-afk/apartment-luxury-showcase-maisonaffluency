import { describe, it, expect } from "vitest";
import { parseGallerySearch, matchesSize } from "../gallerySearchIntent";

describe("gallery budget + size search", () => {
  it("parses '260 cm table under Eur 20,000'", () => {
    const i = parseGallerySearch("260 cm table under Eur 20,000");
    expect(i).toMatchObject({ text: "table", sizeMm: 2600, budgetCents: 2_000_000, budgetCurrency: "EUR" });
  });
  it("parses €20k shorthand", () => {
    expect(parseGallerySearch("dining table under €20k").budgetCents).toBe(2_000_000);
  });
  it("matches a 260 cm table within ±10 cm only", () => {
    expect(matchesSize("W 260  x D 150 × H 75 cm", 2600, "about")).toBe(true);
    expect(matchesSize("W 200 / 240 / 265 × D 100 × H 75 cm", 2600, "about")).toBe(true);
    expect(matchesSize("W 180 × D 90 × H 75 cm", 2600, "about")).toBe(false);
  });
});
