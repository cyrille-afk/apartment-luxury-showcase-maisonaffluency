import { describe, expect, it } from "vitest";
import { splitDimensionHeights } from "./DimensionText";

describe("auxiliary dimension grouping", () => {
  it("groups seat and arm heights below the main centimetre dimensions", () => {
    expect(splitDimensionHeights("W 46.5 x D 55 x H 90.3 cm / SH 48 cm / AH 67 cm")).toEqual({ main: "W 46.5 x D 55 x H 90.3 cm", heights: "SH 48 cm / AH 67 cm" });
  });
  it("supports AR and imperial heights without altering values", () => {
    expect(splitDimensionHeights("W 18.3 x D 21.7 x H 35.6 in / SH 18.9 / AR 26.4 in")).toEqual({ main: "W 18.3 x D 21.7 x H 35.6 in", heights: "SH 18.9 / AR 26.4 in" });
  });
});