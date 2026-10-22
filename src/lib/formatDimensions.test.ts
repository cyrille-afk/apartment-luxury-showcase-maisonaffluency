import { describe, expect, it } from "vitest";
import { formatDimensionsMultiline, splitDimensionQualifier, toImperialLine, withImperialPerLine } from "./formatDimensions";

describe("dimension conversion with a shared trailing unit", () => {
  it.each([
    [100, 24, 10, "39.4", "9.4", "3.9"],
    [150, 25, 11, "59.1", "9.8", "4.3"],
    [200, 25, 11, "78.7", "9.8", "4.3"],
    [240, 25, 11, "94.5", "9.8", "4.3"],
  ])("converts the No. 1 Pendant's %s cm size and 400 cm cable", (w, d, h, wi, di, hi) => {
    const metric = `W ${w} x D ${d} x H ${h} - 400 (cable)  cm`;
    expect(formatDimensionsMultiline(metric)).toBe(metric);
    expect(withImperialPerLine(metric)).toBe(`${metric} | W ${wi} x D ${di} x H ${hi} - 157.5 in (cable)`);
  });

  it("keeps parenthetical counts unchanged while converting dimensions", () => {
    expect(toImperialLine("W 100 x D 50 cm (2 Seater) (No. 1)"))
      .toBe("W 39.4 x D 19.7 in (2 Seater) (No. 1)");
  });

  it("does not treat an axis-labelled measurement as a qualifier", () => {
    expect(splitDimensionQualifier("400 (cable) cm — W 100 x D 24 x H 10"))
      .toEqual({ dim: "400 (cable) cm — W 100 x D 24 x H 10", qual: "" });
  });

  it("still keeps actual product qualifiers out of numeric conversion", () => {
    expect(withImperialPerLine("10 Lights - Dia 100 x H 100 cm"))
      .toBe("Dia 100 x H 100 cm | Dia 39.4 x H 39.4 in — 10 Lights");
  });
});