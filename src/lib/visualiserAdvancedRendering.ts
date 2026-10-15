export type EnvironmentSourcePref = "empty-room-exr" | "studio-hdr" | "studio-softbox-exr" | "window-interior-exr";

export interface AdvancedRenderingSettings {
  shadowSharpness: number;
  contrastIntensity: number;
}

export const DEFAULT_ADVANCED_RENDERING: AdvancedRenderingSettings = { shadowSharpness: 50, contrastIntensity: 50 };
const percentage = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50;
export const clampAdvancedRendering = (value?: Partial<AdvancedRenderingSettings>): AdvancedRenderingSettings => ({
  shadowSharpness: percentage(value?.shadowSharpness),
  contrastIntensity: percentage(value?.contrastIntensity),
});
export const environmentSourcePref = (value: unknown): EnvironmentSourcePref =>
  value === "studio-hdr" || value === "studio-softbox-exr" || value === "window-interior-exr" ? value : "empty-room-exr";

/** Midpoints preserve the existing key/ambient balance and contact-shadow blur. */
export function advancedSceneLighting(settings: AdvancedRenderingSettings) {
  const { shadowSharpness, contrastIntensity } = clampAdvancedRendering(settings);
  const sharpness = shadowSharpness / 100;
  const contrast = contrastIntensity / 100;
  return {
    shadowBias: -0.0007 + sharpness * 0.0006,
    shadowNormalBias: 0.035 - sharpness * 0.03,
    shadowRadius: 4 - sharpness * 3.75,
    contactBlur: 2.8 - sharpness * 2.6,
    directionalIntensity: 1.25 + contrast * 2.5,
    ambientIntensity: 0.35 - contrast * 0.3,
    fillIntensity: 0.6 - contrast * 0.4,
  };
}