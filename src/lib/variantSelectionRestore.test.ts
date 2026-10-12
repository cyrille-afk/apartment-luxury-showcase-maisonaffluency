import { describe, it, expect } from "vitest";
import { sanitizeStoredSelection } from "./variantSelectionRestore";

const mushroomRug = [
  { label: "Small: 250 x 300 cm", base: "65% nettle and 35% silk", top: "100 knots/sq. inch, 155 000 knots/sq. meter" },
  { label: "Large: 300 x 400 cm ", base: "65% nettle and 35% silk", top: "100 knots/sq. inch, 155 000 knots/sq. meter" },
];

describe("sanitizeStoredSelection", () => {
  it("drops a remembered composition/density that the rug no longer offers", () => {
    const out = sanitizeStoredSelection(
      { base: "65% nettle & 35% silk", top: "100 knots/sq. inch", dualSize: null },
      mushroomRug,
    );
    expect(out.base).toBeNull();
    expect(out.top).toBeNull();
  });

  it("keeps a remembered selection that still exists", () => {
    const out = sanitizeStoredSelection(
      { base: "65% nettle and 35% silk", top: "100 knots/sq. inch, 155 000 knots/sq. meter", dualSize: "Large: 300 x 400 cm" },
      mushroomRug,
    );
    expect(out.base).toBe("65% nettle and 35% silk");
    expect(out.top).toBe("100 knots/sq. inch, 155 000 knots/sq. meter");
    expect(out.dualSize).toBe("Large: 300 x 400 cm");
  });

  it("drops a remembered size that no longer exists", () => {
    const out = sanitizeStoredSelection({ dualSize: "Medium: 200 x 250 cm" }, mushroomRug);
    expect(out.dualSize).toBeNull();
  });
});
