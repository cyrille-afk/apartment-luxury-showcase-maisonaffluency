import { describe, expect, it } from "vitest";
import { hasDimensionMeasurement, splitDimensionHeights } from "./DimensionText";
import { withImperialPerLine } from "@/lib/formatDimensions";

describe("measurement detection in shared specification text", () => {
  it.each([
    "Frame upholstered in bouclé, legs in solid oak",
    "Finished in bronze — hand-polished in the atelier",
    "Available in 3 finishes",
    "Fabric woven in 100% wool",
    "Collection 2026 in natural oak",
    "Made in 2026 in Italy — finished in bronze",
    "2 in 1 finish options",
    "Available in 12 in-stock finishes",
  ])("keeps ordinary materials prose out of dimension formatting: %s", (text) => {
    expect(hasDimensionMeasurement(text)).toBe(false);
  });
  it.each([
    "W 62 × D 59 × H 80 cm — SH 46 cm / AH 65 cm",
    "W 24.4 × D 23.2 × H 31.5 in",
    "608W × 545D × 940H mm",
    "230x350cm",
    "400 (cable) cm",
    "3 × 4 m",
    "W 24.4 × D 23.2 × H 31.5 inches",
    "24 in wide",
    "24 in / SH 18 in",
  ])("recognizes actual measurements: %s", (text) => {
    expect(hasDimensionMeasurement(text)).toBe(true);
  });
});

describe("auxiliary dimension grouping", () => {
  it("groups seat and arm heights below the main centimetre dimensions", () => {
    expect(splitDimensionHeights("W 46.5 x D 55 x H 90.3 cm / SH 48 cm / AH 67 cm")).toEqual({ main: "W 46.5 x D 55 x H 90.3 cm", heights: "SH 48 cm / AH 67 cm" });
  });
  it("supports AR and imperial heights without altering values", () => {
    expect(splitDimensionHeights("W 18.3 x D 21.7 x H 35.6 in / SH 18.9 / AR 26.4 in")).toEqual({ main: "W 18.3 x D 21.7 x H 35.6 in", heights: "SH 18.9 / AR 26.4 in" });
  });
  it("keeps Hamrei's em-dash seat height below each unit's main dimensions", () => {
    const paired = withImperialPerLine("PePe S W 51 × D 59 × H 86 cm — SH 46 cm");
    const [metric, imperial] = paired.split(" | ");
    expect(splitDimensionHeights(metric)).toEqual({ main: "PePe S W 51 × D 59 × H 86 cm", heights: "SH 46 cm" });
    expect(splitDimensionHeights(imperial)).toEqual({ main: "W 20.1 × D 23.2 × H 33.9", heights: "SH 18.1 in" });
  });
  it.each(["—", "–", "-"])("groups SH and AH together after a %s separator for any maker", (separator) => {
    expect(splitDimensionHeights(`W 62 × D 59 × H 80 cm ${separator} SH 46 cm / AH 65 cm`)).toEqual({ main: "W 62 × D 59 × H 80 cm", heights: "SH 46 cm / AH 65 cm" });
  });
});