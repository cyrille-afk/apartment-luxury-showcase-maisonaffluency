import { describe, expect, it } from "vitest";
import { clampPtQuality, DEFAULT_PT_QUALITY } from "../visualiserPathTracing";

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
