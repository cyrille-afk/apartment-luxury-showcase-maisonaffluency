import { describe, expect, it } from "vitest";
import { advancedSceneLighting, clampAdvancedRendering, DEFAULT_ADVANCED_RENDERING, environmentSourcePref } from "./visualiserAdvancedRendering";

describe("advanced rendering scene mappings", () => {
  it("sharpens contact shadows through bias, radius and contact blur", () => {
    const soft = advancedSceneLighting({ shadowSharpness: 0, contrastIntensity: 50 });
    const sharp = advancedSceneLighting({ shadowSharpness: 100, contrastIntensity: 50 });
    expect(sharp.shadowRadius).toBeLessThan(soft.shadowRadius);
    expect(sharp.shadowBias).toBeGreaterThan(soft.shadowBias);
    expect(sharp.shadowNormalBias).toBeLessThan(soft.shadowNormalBias);
    expect(sharp.contactBlur).toBeLessThan(soft.contactBlur);
  });
  it("increases directional intensity while lowering ambient/fill with contrast", () => {
    const low = advancedSceneLighting({ shadowSharpness: 50, contrastIntensity: 0 });
    const high = advancedSceneLighting({ shadowSharpness: 50, contrastIntensity: 100 });
    expect(high.directionalIntensity).toBeGreaterThan(low.directionalIntensity);
    expect(high.ambientIntensity).toBeLessThan(low.ambientIntensity);
    expect(high.fillIntensity).toBeLessThan(low.fillIntensity);
    const defaults = advancedSceneLighting(DEFAULT_ADVANCED_RENDERING);
    expect(defaults.directionalIntensity).toBe(2.5);
    expect(defaults.ambientIntensity).toBeCloseTo(0.2);
    expect(defaults.contactBlur).toBeCloseTo(1.5);
  });
  it("retains all three selected EXR environments and legacy presets", () => {
    for (const source of ["studio-softbox-exr", "window-interior-exr", "empty-room-exr", "studio-hdr"]) expect(environmentSourcePref(source)).toBe(source);
    expect(environmentSourcePref("unknown")).toBe("empty-room-exr");
  });
  it("clamps invalid saved slider settings", () => {
    expect(clampAdvancedRendering({ shadowSharpness: 200, contrastIntensity: -1 })).toEqual({ shadowSharpness: 100, contrastIntensity: 0 });
    expect(clampAdvancedRendering({ shadowSharpness: NaN })).toEqual(DEFAULT_ADVANCED_RENDERING);
  });
});