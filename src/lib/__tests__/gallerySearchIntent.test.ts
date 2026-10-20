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

import { priceForSize } from "../gallerySearchIntent";
describe("budget uses the matching size's price", () => {
  const v = [
    { label: "W 200 × D 95 cm", price_cents: 715000 },
    { label: "W 260 × D 95 cm", price_cents: 918000 },
    { label: "W 260 × D 95 cm", price_cents: 834000 },
  ];
  it("picks the cheapest 260 cm variant, not the cheapest overall", () => {
    expect(priceForSize(715000, null, v, 2600, "about")).toBe(834000);
  });
  it("returns null when the size isn't offered", () => {
    expect(priceForSize(715000, null, v, 3500, "about")).toBeNull();
  });
});
