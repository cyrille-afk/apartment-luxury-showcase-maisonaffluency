export type EnvironmentSourcePref = "empty-room-exr" | "studio-hdr" | "studio-softbox-exr" | "window-interior-exr";

export const VISUALISER_ENVIRONMENTS = [
  { value: "studio-hdr", label: "Studio" },
  { value: "studio-softbox-exr", label: "Studio Softbox" },
  { value: "window-interior-exr", label: "Window Interior" },
  { value: "empty-room-exr", label: "Small Empty Room" },
] as const;

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
export function advancedSceneLighting(settings: AdvancedRenderingSettings, lightIntensity = 1) {
  const { shadowSharpness, contrastIntensity } = clampAdvancedRendering(settings);
  const sharpness = shadowSharpness / 100;
  const contrast = contrastIntensity / 100;
  const lightScale = Number.isFinite(lightIntensity) ? Math.min(3, Math.max(0.2, lightIntensity)) : 1;
  const biasScale = Math.max(1, lightScale);
  return {
    lightScale,
    shadowBias: (-0.0007 + sharpness * 0.0006) / biasScale,
    shadowNormalBias: (0.035 - sharpness * 0.03) / biasScale,
    shadowRadius: 4 - sharpness * 3.75,
    contactBlur: 2.8 - sharpness * 2.6,
    directionalIntensity: (1.25 + contrast * 2.5) * lightScale,
    ambientIntensity: (0.35 - contrast * 0.3) * lightScale,
    fillIntensity: (0.6 - contrast * 0.4) * lightScale,
  };
}