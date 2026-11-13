import { describe, expect, it } from "vitest";
import { advancedSceneLighting, clampAdvancedRendering, DEFAULT_ADVANCED_RENDERING, environmentSourcePref } from "./visualiserAdvancedRendering";

describe("advanced rendering scene mappings", () => {
  it("zero furniture intensity removes cast, contact and catcher shadows without changing illumination", () => {
    const off = advancedSceneLighting({ ...DEFAULT_ADVANCED_RENDERING, contactShadowIntensity: 0 });
    expect(off.contactOpacity).toBe(0);
    expect(off.shadowIntensity).toBe(0);
    expect(off.shadowCatcherOpacity).toBe(0);
    expect(off.directionalIntensity).toBe(2.5);
    expect(advancedSceneLighting(DEFAULT_ADVANCED_RENDERING).shadowCatcherOpacity).toBe(0.28);
    expect(advancedSceneLighting(DEFAULT_ADVANCED_RENDERING).shadowIntensity).toBe(1);
  });
  it("100% furniture softness increases edge blur independently of intensity", () => {
    const soft = advancedSceneLighting({ ...DEFAULT_ADVANCED_RENDERING, shadowSharpness: 0 });
    const hard = advancedSceneLighting({ ...DEFAULT_ADVANCED_RENDERING, shadowSharpness: 100 });
    expect(soft.contactBlur).toBe(3.7);
    expect(hard.contactBlur).toBeCloseTo(1.3);
    expect(soft.contactOpacity).toBe(hard.contactOpacity);
  });
  it("keeps 100% lighting at the baseline", () => {
    const lighting = advancedSceneLighting(DEFAULT_ADVANCED_RENDERING, 1);
    expect(lighting.directionalIntensity).toBe(2.5);
    expect(lighting.lightScale).toBe(1);
    expect(lighting.shadowBias).toBeCloseTo(-0.0005);
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
  it("keeps the requested acne-safe key bias independent of lighting and softness", () => {
    for (const scale of [0.2, 1, 1.28, 3]) for (const shadowSharpness of [0, 50, 100]) {
      const lighting = advancedSceneLighting({ ...DEFAULT_ADVANCED_RENDERING, shadowSharpness }, scale);
      expect(lighting.shadowBias).toBe(-0.0005);
      expect(lighting.shadowNormalBias).toBe(0.02);
    }
  });
  it("sharpens edges without compromising the acne-safe bias", () => {
    const soft = advancedSceneLighting({ shadowSharpness: 0, contrastIntensity: 50 });
    const sharp = advancedSceneLighting({ shadowSharpness: 100, contrastIntensity: 50 });
    expect(sharp.shadowRadius).toBeLessThan(soft.shadowRadius);
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
    expect(defaults.contactBlur).toBeCloseTo(2.5);
  });
  it("retains all three selected EXR environments and legacy presets", () => {
    for (const source of ["studio-softbox-exr", "window-interior-exr", "empty-room-exr", "studio-hdr"]) expect(environmentSourcePref(source)).toBe(source);
    expect(environmentSourcePref("unknown")).toBe("empty-room-exr");
  });
  it("clamps invalid saved slider settings", () => {
    expect(clampAdvancedRendering({ shadowSharpness: 200, contrastIntensity: -1 })).toEqual({ shadowSharpness: 100, contrastIntensity: 0, contactShadowIntensity: 72 });
    expect(clampAdvancedRendering({ shadowSharpness: NaN })).toEqual(DEFAULT_ADVANCED_RENDERING);
  });
  it("uses subtle 0.25 contact opacity for default and legacy saved scenes", () => {
    expect(advancedSceneLighting(DEFAULT_ADVANCED_RENDERING).contactOpacity).toBe(0.25);
    expect(advancedSceneLighting({ shadowSharpness: 50, contrastIntensity: 50 }).contactOpacity).toBe(0.25);
  });
  it("maps adjustable contact intensity directly to opacity and clamps saved values", () => {
    for (const [percentage, opacity] of [[0, 0], [35, 0.25 * 35 / 72], [100, 0.25 * 100 / 72], [200, 0.25 * 100 / 72], [-1, 0]]) {
      expect(advancedSceneLighting({ ...DEFAULT_ADVANCED_RENDERING, contactShadowIntensity: percentage }).contactOpacity).toBeCloseTo(opacity);
    }
  });
});