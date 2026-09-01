import { describe, it, expect } from "vitest";
import { mergeFinishFacet, composeOrderFinishLabel } from "../orderFinishLabel";

describe("mergeFinishFacet", () => {
  it("keeps the reference and appends the colourway", () => {
    expect(mergeFinishFacet("Sheepskin SKANDILOCK", "Sheepskin 09 Moonlight")).toBe(
      "Sheepskin SKANDILOCK — 09 Moonlight",
    );
  });
  it("collapses when one contains the other", () => {
    expect(mergeFinishFacet("Walnut", "Oiled Walnut")).toBe("Oiled Walnut");
    expect(mergeFinishFacet("Oiled Walnut", "Walnut")).toBe("Oiled Walnut");
  });
  it("prefers the displayed swatch when the two are unrelated", () => {
    expect(mergeFinishFacet("Oiled Oak", "Fumed Ash")).toBe("Fumed Ash");
  });
  it("falls back to whichever side exists", () => {
    expect(mergeFinishFacet("Oiled Oak", null)).toBe("Oiled Oak");
    expect(mergeFinishFacet(null, "Moonlight")).toBe("Moonlight");
    expect(mergeFinishFacet(null, null)).toBeNull();
  });
});

describe("composeOrderFinishLabel", () => {
  it("merges both axes into a single line", () => {
    expect(
      composeOrderFinishLabel({
        base: "Oiled Oak",
        top: "Sheepskin SKANDILOCK",
        displayedBase: "Oiled Walnut",
        displayedUpholstery: "Sheepskin 09 Moonlight",
      }),
    ).toBe("Oiled Walnut / Sheepskin SKANDILOCK — 09 Moonlight");
  });
  it("returns null with nothing selected", () => {
    expect(composeOrderFinishLabel({})).toBeNull();
  });
});
