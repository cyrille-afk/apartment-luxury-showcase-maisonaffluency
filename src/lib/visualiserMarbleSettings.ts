export type MarbleSurfaceSettings = { reflectivity: number; roughness: number };
export const DEFAULT_MARBLE_SURFACE: MarbleSurfaceSettings = { reflectivity: 0.5, roughness: 0.15 };
export const MARBLE_SURFACE_PRESETS = [
  { id: "polished", label: "Polished", settings: { reflectivity: 0.5, roughness: 0.15 } },
  { id: "honed", label: "Honed", settings: { reflectivity: 0.25, roughness: 0.6 } },
  { id: "satin", label: "Satin", settings: { reflectivity: 0.4, roughness: 0.3 } },
] as const;

export function marbleSurfacePreset(value?: Partial<MarbleSurfaceSettings> | null) {
  const settings = clampMarbleSurface(value);
  return MARBLE_SURFACE_PRESETS.find((preset) =>
    Math.abs(settings.reflectivity - preset.settings.reflectivity) < 0.000001 &&
    Math.abs(settings.roughness - preset.settings.roughness) < 0.000001
  )?.id;
}
export const isCoffeeTable = (name: string) => /coffee\s*table/i.test(name);

export function clampMarbleSurface(value?: Partial<MarbleSurfaceSettings> | null): MarbleSurfaceSettings {
  const clamp = (v: number | undefined, fallback: number) => typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
  return { reflectivity: clamp(value?.reflectivity, DEFAULT_MARBLE_SURFACE.reflectivity), roughness: clamp(value?.roughness, DEFAULT_MARBLE_SURFACE.roughness) };
}