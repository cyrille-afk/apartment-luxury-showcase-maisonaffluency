import { describe, expect, it } from "vitest";
import { clampPtQuality, DEFAULT_PT_QUALITY, PATH_TRACING, tracedRenderScale } from "../visualiserPathTracing";

describe("clampPtQuality lightIntensity", () => {
  it("defaults to 1.6 when unset or invalid", () => {
    expect(clampPtQuality({}).lightIntensity).toBe(1.6);
    expect(clampPtQuality({ lightIntensity: Number.NaN }).lightIntensity).toBe(1.6);
    expect(DEFAULT_PT_QUALITY.lightIntensity).toBe(1.6);
  });

  it("keeps values inside the 0.2–3 slider range", () => {
    expect(clampPtQuality({ lightIntensity: 0.8 }).lightIntensity).toBe(0.8);
    expect(clampPtQuality({ lightIntensity: 0 }).lightIntensity).toBe(1.6);
    expect(clampPtQuality({ lightIntensity: 0.05 }).lightIntensity).toBe(0.2);
    expect(clampPtQuality({ lightIntensity: 10 }).lightIntensity).toBe(3);
  });
});

describe("photoreal sampling cost", () => {
  it("caps traced pixel density at 1.5x while 1x screens stay native", () => {
    expect(tracedRenderScale(1, 2)).toBe(0.75);
    expect(tracedRenderScale(1, 1.5)).toBe(1);
    expect(tracedRenderScale(1, 1)).toBe(1);
    expect(tracedRenderScale(2, 2)).toBe(1.5);
  });
  it("uses 5 GI bounces and 6 glass bounces", () => {
    expect(PATH_TRACING.bounces).toBe(5);
    expect(PATH_TRACING.transmissiveBounces).toBe(6);
  });
});
