import { describe, it, expect } from "vitest";
import { picturedVariantPriceCents } from "@/lib/picturedVariantPrice";

const orsayVariants = [
  { top: "Brushed Ocean Onyx", base: "Unfilled Alabastrino Travertine", label: "W 170 × D 100 × H 40 cm", price_cents: 3860000 },
  { top: "High Gloss Ebony Macassar", base: "High Gloss Ebony Macassar", label: "W 170 × D 100 × H 40 cm", price_cents: 3730000 },
  { top: "Light Tamo", base: "Natural Oak", label: "W 170 × D 100 × H 40 cm", price_cents: 2820000 },
];
const orsayMap = {
  "w170d100h40cm|topinbrushedoceanonyxlegsinunfilledalabastrinotravertinelimitededitionof12pcs": 0,
};

describe("picturedVariantPriceCents", () => {
  it("Orsay card prices the pictured Travertine + Ocean Onyx (€38,600), not the cheapest", () => {
    expect(picturedVariantPriceCents(orsayMap, orsayVariants)).toBe(3860000);
  });
  it("returns null when the photo has no mapped finish", () => {
    expect(picturedVariantPriceCents({}, orsayVariants)).toBeNull();
  });
  it("uses canonical base|top keys", () => {
    expect(picturedVariantPriceCents({ "naturaloak|lighttamo": 0 }, orsayVariants)).toBe(2820000);
  });
});
