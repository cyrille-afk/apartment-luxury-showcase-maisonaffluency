import { describe, it, expect } from "vitest";
import { resolveAutoDefaultPair } from "@/lib/variantAutoDefault";

describe("resolveAutoDefaultPair", () => {
  it("returns null when there are no size variants", () => {
    expect(resolveAutoDefaultPair(null)).toBeNull();
    expect(resolveAutoDefaultPair(undefined)).toBeNull();
    expect(resolveAutoDefaultPair([])).toBeNull();
  });

  it("returns null when variants have no base or top axis", () => {
    expect(
      resolveAutoDefaultPair([
        { label: "W 100 cm", price_cents: 100000 },
        { label: "W 120 cm", price_cents: 120000 },
      ])
    ).toBeNull();
  });

  it("auto-defaults a true single pairing (1 base × 1 top)", () => {
    const variants = [
      { base: "Aged Brass", top: "Bisque Leather", label: "Small", price_cents: 1 },
      { base: "Aged Brass", top: "Bisque Leather", label: "Large", price_cents: 2 },
    ];
    expect(resolveAutoDefaultPair(variants)).toEqual({
      base: "Aged Brass",
      top: "Bisque Leather",
    });
  });

  it("does NOT auto-default products with multiple bases (Stone D case)", () => {
    // Pierre Bonnefille — Stone D Coffee Table has 3 distinct bases sharing
    // a single Top. Without this guard, the gallery would jump to the first
    // base's mapped finish image on load and hide the editorial photos.
    const variants = [
      {
        base: "Cuprite D'eau - Wooden Structure covered with Brass",
        top: "Mixed Media on Wood with Resin",
        label: "W 105",
      },
      {
        base: "Mousse D'eau - Wooden Structure covered with Copper",
        top: "Mixed Media on Wood with Resin",
        label: "W 105",
      },
      {
        base: "Limonite D'eau - Wooden Structure covered with Brass",
        top: "Mixed Media on Wood with Resin",
        label: "W 105",
      },
    ];
    expect(resolveAutoDefaultPair(variants)).toBeNull();
  });

  it("does NOT auto-default when the single base has multiple compatible tops", () => {
    // One base, two tops — user still has a real choice to make.
    const variants = [
      { base: "Aged Brass", top: "Bisque Leather", label: "Small" },
      { base: "Aged Brass", top: "Travertine", label: "Small" },
    ];
    expect(resolveAutoDefaultPair(variants)).toBeNull();
  });

  it("trims whitespace when computing distinct bases and tops", () => {
    const variants = [
      { base: "Aged Brass ", top: " Bisque Leather", label: "S" },
      { base: " Aged Brass", top: "Bisque Leather ", label: "L" },
    ];
    expect(resolveAutoDefaultPair(variants)).toEqual({
      base: "Aged Brass",
      top: "Bisque Leather",
    });
  });

  it("ignores empty/blank base or top entries when counting distinct values", () => {
    const variants = [
      { base: "Aged Brass", top: "Bisque Leather", label: "S" },
      { base: "", top: "", label: "L" },
    ];
    expect(resolveAutoDefaultPair(variants)).toEqual({
      base: "Aged Brass",
      top: "Bisque Leather",
    });
  });
});
