export type MarbleSurfaceSettings = { reflectivity: number; roughness: number };
export const DEFAULT_MARBLE_SURFACE: MarbleSurfaceSettings = { reflectivity: 0.5, roughness: 0.15 };
export const isCoffeeTable = (name: string) => /coffee\s*table/i.test(name);

export function clampMarbleSurface(value?: Partial<MarbleSurfaceSettings> | null): MarbleSurfaceSettings {
  const clamp = (v: number | undefined, fallback: number) => typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
  return { reflectivity: clamp(value?.reflectivity, DEFAULT_MARBLE_SURFACE.reflectivity), roughness: clamp(value?.roughness, DEFAULT_MARBLE_SURFACE.roughness) };
}