import { describe, it, expect } from "vitest";
import { dedupeVariantLabels, resolveDefaultVariant } from "@/lib/variantDefault";

// Real Galet Dining Table variant list (Emma Donnersberg).
const GALET = [
  { label: "Small — W 250 × D 125 × H 72.4 cm" },
  { label: "Medium — W 280 × D 125 × H 72.4 cm" },
  { label: "Large — W 350 × D 125 × H 72.4 cm" },
];

describe("dedupeVariantLabels", () => {
  it("returns trimmed labels in order and drops blanks", () => {
    expect(
      dedupeVariantLabels([
        { label: " Small — W 250 " },
        { label: null },
        { label: "Large — W 350" },
      ]),
    ).toEqual(["Small — W 250", "Large — W 350"]);
  });

  it("collapses repeated labels to their first occurrence", () => {
    expect(
      dedupeVariantLabels([
        { label: "Aged Brass" },
        { label: "Aged Brass" },
        { label: "Travertine" },
      ]),
    ).toEqual(["Aged Brass", "Travertine"]);
  });

  it("tolerates a missing variant list", () => {
    expect(dedupeVariantLabels(null)).toEqual([]);
    expect(dedupeVariantLabels(undefined)).toEqual([]);
  });
});

describe("resolveDefaultVariant", () => {
  it("returns null when no default is stored", () => {
    expect(resolveDefaultVariant(GALET, null)).toBeNull();
    expect(resolveDefaultVariant(GALET, undefined)).toBeNull();
    expect(resolveDefaultVariant(GALET, "   ")).toBeNull();
  });

  it("returns null when the product has no variants", () => {
    expect(resolveDefaultVariant([], "Large")).toBeNull();
    expect(resolveDefaultVariant(null, "Large")).toBeNull();
  });

  it("selects Large on the Galet tables (word prefix)", () => {
    expect(resolveDefaultVariant(GALET, "Large")).toEqual({
      index: 2,
      label: "Large — W 350 × D 125 × H 72.4 cm",
    });
  });

  it("selects Large when the full label is stored", () => {
    expect(
      resolveDefaultVariant(GALET, "Large — W 350 × D 125 × H 72.4 cm"),
    ).toEqual({ index: 2, label: "Large — W 350 × D 125 × H 72.4 cm" });
  });

  it("matches case-insensitively and ignores surrounding spaces", () => {
    expect(resolveDefaultVariant(GALET, "  medium ")).toEqual({
      index: 1,
      label: "Medium — W 280 × D 125 × H 72.4 cm",
    });
  });

  it("falls back to a substring such as a dimension", () => {
    expect(resolveDefaultVariant(GALET, "W 350")).toEqual({
      index: 2,
      label: "Large — W 350 × D 125 × H 72.4 cm",
    });
  });

  it("never matches a prefix that is not a whole word", () => {
    // "Large" must not select "Larger" — and a name that matches nothing
    // returns null rather than silently picking the first variant.
    const rows = [
      { label: "Larger — W 350 cm" },
      { label: "Small — W 200 cm" },
    ];
    expect(resolveDefaultVariant(rows, "Large")).toBeNull();
  });

  it("indexes into the deduped list the picker actually renders", () => {
    const rows = [
      { label: "Aged Brass" },
      { label: "Aged Brass" },
      { label: "Travertine" },
    ];
    expect(resolveDefaultVariant(rows, "Travertine")).toEqual({
      index: 1,
      label: "Travertine",
    });
  });

  it("returns null when the default names a variant the product doesn't offer", () => {
    expect(resolveDefaultVariant(GALET, "Extra Large")).toBeNull();
  });
});
