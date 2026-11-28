import { describe, expect, it } from "vitest";
import { eyeLevelMetricDimensions, eyeLevelShapeGuardrail } from "../../supabase/functions/_shared/eyeLevelPrompt";
import { EYE_LEVEL_LENS_MM } from "../../supabase/functions/_shared/eyeLevelCamera";

describe("recorded eye-level furniture proportions", () => {
  it("retains Rift CTS's exact 138 × 114 × 35 cm size and compact footprint ratio", () => {
    const dimensions = eyeLevelMetricDimensions("138 × 114 × 35 cm");
    expect(dimensions).toMatchObject({ w: 138, d: 114, h: 35 });
    expect(dimensions?.footprintRatio).toBeCloseTo(138 / 114, 8);
    expect(eyeLevelShapeGuardrail({ product_name: "Rift CTS", dimensions: "138 × 114 × 35 cm" })).toContain("width 138 × depth 114 × height 35 cm");
  });
  it("keeps a 35cm coffee table below recorded 42–45cm seat cushions, not chair backs", () => {
    const table = eyeLevelMetricDimensions("W138 D114 H35 cm");
    for (const seat of [42, 45]) {
      const chair = eyeLevelMetricDimensions(`W90 D92 H76 cm — SH${seat} cm`);
      expect(chair?.h).toBe(76);
      expect(chair?.seatHeight).toBe(seat);
      expect(table?.h).toBeLessThan(seat);
    }
  });
  it("uses a natural 30mm lens", () => { expect(EYE_LEVEL_LENS_MM).toBe(30); });
  it("converts recorded millimetres, metres and inches without rounding axes", () => {
    expect(eyeLevelMetricDimensions("W1382 × D1144 × H351 mm")).toMatchObject({ w: 138.2, d: 114.4, h: 35.1 });
    expect(eyeLevelMetricDimensions("1.38 × 1.14 × 0.35 m")).toMatchObject({ w: 138, d: 114, h: 35 });
    expect(eyeLevelMetricDimensions("W10 D20 H30 in")).toMatchObject({ w: 25.4, d: 50.8, h: 76.2 });
  });
  it("does not fabricate missing or partial dimensions", () => {
    for (const value of [null, "", "unconfirmed", "W138 D114 cm", "0 × 114 × 35 cm"]) expect(eyeLevelMetricDimensions(value)).toBeNull();
  });
  it("preserves another recorded Rift size rather than substituting example dimensions", () => {
    expect(eyeLevelMetricDimensions("W 108 × D 108 × H 28 cm – 254 kg")).toMatchObject({ w: 108, d: 108, h: 28, footprintRatio: 1 });
  });
});