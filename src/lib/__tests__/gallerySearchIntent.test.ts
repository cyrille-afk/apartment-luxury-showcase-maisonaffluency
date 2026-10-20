import { describe, it, expect } from "vitest";
import { parseGallerySearch, matchesSize, parseBudgetAmount } from "../gallerySearchIntent";

describe("standalone budget field parsing", () => {
  it("parses plain numbers, thousands separators and k suffix", () => {
    expect(parseBudgetAmount("20,000")).toEqual({ cents: 2_000_000, currency: null });
    expect(parseBudgetAmount("2,500.50")).toEqual({ cents: 250_050, currency: null });
    expect(parseBudgetAmount("20k")).toEqual({ cents: 2_000_000, currency: null });
  });
  it("recognises currency words and symbols", () => {
    expect(parseBudgetAmount("€20,000").currency).toBe("EUR");
    expect(parseBudgetAmount("5000 SGD").currency).toBe("SGD");
    expect(parseBudgetAmount("$30k").currency).toBe("USD");
  });
  it("rejects empty, zero and non-numeric input", () => {
    expect(parseBudgetAmount("")).toEqual({ cents: null, currency: null });
    expect(parseBudgetAmount("0")).toEqual({ cents: null, currency: null });
    expect(parseBudgetAmount("abc")).toEqual({ cents: null, currency: null });
  });
});

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
