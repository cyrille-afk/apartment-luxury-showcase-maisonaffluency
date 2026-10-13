import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";

export type ScenePresetData = {
  objects: PlacedObject[];
  spacing?: number;
  snapToGrid?: boolean;
  showGrid?: boolean;
  depthOfField?: boolean;
  /** Background blur strength (bokeh scale), 1–10. */
  dofStrength?: number;
  /** Uploaded room-photo backdrop (data URL, downscaled for storage). */
  backdropDataUrl?: string | null;
};
export type ScenePreset = { id: string; name: string; savedAt: string; data: ScenePresetData };

const KEY = "trade-visualiser-scene-presets-v1";

export const readScenePresets = (): ScenePreset[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
};

const write = (list: ScenePreset[]): ScenePreset[] | null => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return list; } catch { return null; }
};

/** Saving under an existing name (case-insensitive) overwrites that preset. Returns null if storage is full. */
export const saveScenePreset = (name: string, data: ScenePresetData): ScenePreset[] | null => {
  const clean = name.trim();
  const list = readScenePresets();
  const existing = list.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  const preset: ScenePreset = {
    id: existing?.id ?? crypto.randomUUID(),
    name: clean,
    savedAt: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(data)),
  };
  return write([preset, ...list.filter((p) => p.id !== preset.id)]);
};

export const deleteScenePreset = (id: string) => write(readScenePresets().filter((p) => p.id !== id));
