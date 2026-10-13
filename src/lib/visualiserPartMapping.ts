import { useSyncExternalStore } from "react";
import { classifyTextureNode, type FinishPart } from "./visualiserFinishTargets";

/** "none" = force a part to stay on Whole Piece only. */
export type PartAssignment = FinishPart | "none";
export type PartOverrides = Record<string, PartAssignment>;
export type ModelMesh = { key: string; label: string; auto: FinishPart | null };

const STORAGE_KEY = "ma_visualiser_part_mapping_v1";
const listeners = new Set<() => void>();
let overrides: Record<string, PartOverrides> = load();
let meshes: Record<string, ModelMesh[]> = {};
let groupLabels: Record<string, Record<string, string>> = {};
const NO_LABELS: Record<string, string> = {};
const EMPTY: PartOverrides = {};
const NO_MESHES: ModelMesh[] = [];

function load(): Record<string, PartOverrides> {
  try {
    return typeof localStorage === "undefined" ? {} : JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Stable per-model mesh key: traversal index + node name (coded/empty names stay unique). */
export const meshKey = (index: number, name: string) => `${index}:${name}`;

/** Override wins; otherwise the node-name classifier decides. */
export function resolvePart(nodeName: string, key: string, map: PartOverrides): FinishPart | null {
  const o = map[key];
  if (o === "none") return null;
  return o ?? classifyTextureNode(nodeName);
}

export function setPartOverride(productId: string, key: string, value: PartAssignment | null) {
  const next = { ...(overrides[productId] ?? {}) };
  if (value === null) delete next[key];
  else next[key] = value;
  overrides = { ...overrides, [productId]: next };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)); } catch { /* storage full/blocked */ }
  emit();
}

/** Clears every manual mapping for a product so schema/auto roles take over. */
export function clearPartOverrides(productId: string) {
  if (!overrides[productId]) return;
  const next = { ...overrides };
  delete next[productId];
  overrides = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)); } catch { /* storage full/blocked */ }
  emit();
}

export function registerModelMeshes(productId: string, list: ModelMesh[], labels: Record<string, string> = {}) {
  // Upgrade the old shared upholstery assignment only on a declared backrest;
  // all unrelated manual mappings stay as the user saved them.
  const saved = overrides[productId];
  if (saved) {
    const next = { ...saved };
    let changed = false;
    for (const mesh of list) {
      if (mesh.auto === "backrest" && next[mesh.key] === "upholstery") {
        delete next[mesh.key];
        changed = true;
      }
    }
    if (changed) {
      overrides = { ...overrides, [productId]: next };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)); } catch { /* storage blocked */ }
      emit();
    }
  }
  if (JSON.stringify(meshes[productId]) === JSON.stringify(list) && JSON.stringify(groupLabels[productId]) === JSON.stringify(labels)) return;
  meshes = { ...meshes, [productId]: list };
  groupLabels = { ...groupLabels, [productId]: labels };
  emit();
}

export const usePartOverrides = (productId: string | undefined) =>
  useSyncExternalStore(subscribe, () => (productId && overrides[productId]) || EMPTY);
export const useModelMeshes = (productId: string | undefined) =>
  useSyncExternalStore(subscribe, () => (productId && meshes[productId]) || NO_MESHES);
export const usePartGroupLabels = (productId: string | undefined) =>
  useSyncExternalStore(subscribe, () => (productId && groupLabels[productId]) || NO_LABELS);
