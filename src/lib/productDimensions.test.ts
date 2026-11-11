import { describe, expect, it } from "vitest";
import { parseDimensionString, resolveDimensions } from "./productDimensions";

describe("recorded canvas dimensions", () => {
  it("resolves Yoma's mixed-axis centimetres without treating its weight as a measurement", () => {
    expect(resolveDimensions({
      dimensions: "255 × 70 × H 100 cm — 810 kg",
      width_mm: null,
      depth_mm: null,
      height_mm: 1000,
    })).toEqual({ w: 2550, d: 700, h: 1000 });
  });

  it("resolves mixed-axis size variants when main measurements are absent", () => {
    expect(resolveDimensions({ size_variants: [{ label: "255 × 70 × H 100 cm - Bleach Oak" }] }))
      .toEqual({ w: 2550, d: 700, h: 1000 });
  });

  it("preserves recorded millimetres and existing labelled/canonical formats", () => {
    expect(parseDimensionString("2550 × 700 × H 1000 mm")).toEqual({ w: 2550, d: 700, h: 1000 });
    expect(parseDimensionString("W 82 × D 77 × H 73 cm — SH 41 cm")).toEqual({ w: 820, d: 770, h: 730 });
    expect(parseDimensionString("820 × 770 × 730 mm")).toEqual({ w: 820, d: 770, h: 730 });
  });

  it("does not invent dimensions when none are recorded", () => {
    expect(resolveDimensions({ dimensions: "On request", height_mm: 1000 })).toBeNull();
  });
});