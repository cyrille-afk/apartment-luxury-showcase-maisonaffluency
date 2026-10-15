import { describe, expect, it } from "vitest";
import { advancedSceneLighting, clampAdvancedRendering, DEFAULT_ADVANCED_RENDERING, environmentSourcePref } from "./visualiserAdvancedRendering";

describe("advanced rendering scene mappings", () => {
  it("keeps 100% lighting at the baseline", () => {
    const lighting = advancedSceneLighting(DEFAULT_ADVANCED_RENDERING, 1);
    expect(lighting.directionalIntensity).toBe(2.5);
    expect(lighting.lightScale).toBe(1);
    expect(lighting.shadowBias).toBeCloseTo(-0.0004);
    expect(lighting.shadowNormalBias).toBeCloseTo(0.02);
  });
  it("scales key and environment strength proportionally at 128% and beyond", () => {
    for (const scale of [1.28, 2, 3]) {
      const lighting = advancedSceneLighting(DEFAULT_ADVANCED_RENDERING, scale);
      expect(lighting.directionalIntensity).toBeCloseTo(2.5 * scale);
      expect(lighting.lightScale * 0.5).toBeCloseTo(0.5 * scale);
      expect(lighting.ambientIntensity).toBeCloseTo(0.2 * scale);
      expect(lighting.fillIntensity).toBeCloseTo(0.4 * scale);
    }
  });
  it("tightens both shadow biases above 100% without changing shadow sharpness", () => {
    const lighting = advancedSceneLighting(DEFAULT_ADVANCED_RENDERING, 1.28);
    expect(lighting.shadowBias).toBeCloseTo(-0.0004 / 1.28);
    expect(lighting.shadowNormalBias).toBeCloseTo(0.02 / 1.28);
    expect(advancedSceneLighting(DEFAULT_ADVANCED_RENDERING, 3).shadowNormalBias).toBeLessThan(lighting.shadowNormalBias);
    expect(advancedSceneLighting(DEFAULT_ADVANCED_RENDERING, 0.2).shadowNormalBias).toBeCloseTo(0.02);
  });
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
    expect(clampAdvancedRendering({ shadowSharpness: 200, contrastIntensity: -1 })).toEqual({ shadowSharpness: 100, contrastIntensity: 0, contactShadowIntensity: 72 });
    expect(clampAdvancedRendering({ shadowSharpness: NaN })).toEqual(DEFAULT_ADVANCED_RENDERING);
  });
  it("preserves 0.72 contact opacity for default and legacy saved scenes", () => {
    expect(advancedSceneLighting(DEFAULT_ADVANCED_RENDERING).contactOpacity).toBe(0.72);
    expect(advancedSceneLighting({ shadowSharpness: 50, contrastIntensity: 50 }).contactOpacity).toBe(0.72);
  });
  it("maps adjustable contact intensity directly to opacity and clamps saved values", () => {
    for (const [percentage, opacity] of [[0, 0], [35, 0.35], [100, 1], [200, 1], [-1, 0]]) {
      expect(advancedSceneLighting({ ...DEFAULT_ADVANCED_RENDERING, contactShadowIntensity: percentage }).contactOpacity).toBe(opacity);
    }
  });
});