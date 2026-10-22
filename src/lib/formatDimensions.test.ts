import { describe, expect, it } from "vitest";
import { formatDimensionsMultiline, splitDimensionQualifier, toImperialLine, withImperialPerLine } from "./formatDimensions";

describe("dimension conversion with a shared trailing unit", () => {
  it.each([
    ["Ø 400 x H 580 mm", "Ø 15.7 x H 22.8 in"],
    ["W 100 cm / D 500 mm", "W 39.4 / D 19.7 in"],
    ["3 × 4 m", "118.1 × 157.5 in"],
    ["2 Seater W 100 cm", "2 Seater W 39.4 in"],
    ["ENZ26 W 65.9 × D 40.6 × H 50.7 cm", "ENZ26 W 25.9 × D 16.0 × H 20.0 in"],
    ["D. 21 × H. 38 cm / 8 kg", "D. 8.3 × H. 15.0 in / 8 kg"],
    ["W 100 cm (SH 45 cm)", "W 39.4 in (SH 17.7 in)"],
    ["W 100 cm (2 Seater)", "W 39.4 in (2 Seater)"],
    ["608W × 545D × 940H mm | 23.9W × 21.5D × 37H in", "23.9W × 21.5D × 37.0H in"],
    ["230x350cm", "90.6x137.8 in"],
    ["056M W 240 × D 95 × H 75.5 cm", "056M W 94.5 × D 37.4 × H 29.7 in"],
    ["177L — W 300 × D 124 × H 74.5 cm", "177L — W 118.1 × D 48.8 × H 29.3 in"],
    ["Cloud 19 (Ø 77 cm)", "Cloud 19 (Ø 30.3 in)"],
    ["Medium — Ø 26 × H 20 cm (~7 kg)", "Medium — Ø 10.2 × H 7.9 in (~7 kg)"],
    ["Seat Height: 41 cm", "Seat Height: 16.1 in"],
  ])("converts only the actual measurements in %s", (metric, imperial) => {
    expect(toImperialLine(metric)).toBe(imperial);
  });
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