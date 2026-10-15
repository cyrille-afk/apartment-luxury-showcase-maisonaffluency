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

export type CustomMarblePreset = { id: string; label: string; settings: MarbleSurfaceSettings };
export const CUSTOM_MARBLE_PRESETS_KEY = "trade-visualiser-marble-presets-v1";

export function loadCustomMarblePresets(storage?: Pick<Storage, "getItem"> | null): CustomMarblePreset[] {
  try {
    const raw = (storage ?? (typeof window !== "undefined" ? window.localStorage : null))?.getItem(CUSTOM_MARBLE_PRESETS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { id?: unknown; label?: unknown; settings?: unknown };
      if (typeof candidate.id !== "string" || typeof candidate.label !== "string" || !candidate.label.trim()) return [];
      return [{ id: candidate.id, label: candidate.label.trim().slice(0, 24), settings: clampMarbleSurface(candidate.settings as Partial<MarbleSurfaceSettings>) }];
    });
  } catch { return []; }
}

export function saveCustomMarblePresets(presets: CustomMarblePreset[], storage?: Pick<Storage, "setItem"> | null) {
  try { (storage ?? (typeof window !== "undefined" ? window.localStorage : null))?.setItem(CUSTOM_MARBLE_PRESETS_KEY, JSON.stringify(presets.slice(0, 12))); } catch { /* storage full or blocked */ }
}

export function addCustomMarblePreset(presets: CustomMarblePreset[], label: string, settings: MarbleSurfaceSettings): CustomMarblePreset[] {
  const trimmed = label.trim().slice(0, 24) || "Custom";
  const preset: CustomMarblePreset = { id: `custom-${Date.now().toString(36)}-${presets.length}`, label: trimmed, settings: clampMarbleSurface(settings) };
  return [...presets.filter((entry) => entry.label.toLowerCase() !== trimmed.toLowerCase()), preset].slice(-12);
}

export function customMarblePresetMatch(presets: CustomMarblePreset[], value?: Partial<MarbleSurfaceSettings> | null) {
  const settings = clampMarbleSurface(value);
  return presets.find((preset) =>
    Math.abs(settings.reflectivity - preset.settings.reflectivity) < 0.000001 &&
    Math.abs(settings.roughness - preset.settings.roughness) < 0.000001
  )?.id;
}