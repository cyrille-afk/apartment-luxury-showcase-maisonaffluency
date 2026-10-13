import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";

/** Named finish configuration for one furniture product (saved per product, reusable across placements). */
export type FinishPreset = {
  name: string;
  material: VisualiserMaterial | null;
  topMaterial: VisualiserMaterial | null;
  baseMaterial: VisualiserMaterial | null;
  upholsteryMaterial: VisualiserMaterial | null;
  partMaterials?: Record<string, VisualiserMaterial | null>;
  savedAt: string;
};

const KEY = "ma_visualiser_finish_presets_v1";
type Store = Record<string, FinishPreset[]>;

const read = (): Store => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Store; } catch { return {}; }
};
const write = (store: Store) => {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage full/blocked */ }
};

export const listFinishPresets = (productId: string): FinishPreset[] => read()[productId] ?? [];

/** Saving under an existing name (case-insensitive) replaces that preset. */
export function saveFinishPreset(productId: string, preset: Omit<FinishPreset, "savedAt">): FinishPreset[] {
  const name = preset.name.trim();
  if (!name) return listFinishPresets(productId);
  const store = read();
  const others = (store[productId] ?? []).filter((p) => p.name.toLowerCase() !== name.toLowerCase());
  store[productId] = [...others, { ...preset, name, savedAt: new Date().toISOString() }];
  write(store);
  return store[productId];
}

export function deleteFinishPreset(productId: string, name: string): FinishPreset[] {
  const store = read();
  store[productId] = (store[productId] ?? []).filter((p) => p.name !== name);
  write(store);
  return store[productId];
}
