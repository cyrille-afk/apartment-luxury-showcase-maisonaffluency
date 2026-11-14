import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";

/**
 * Shared room state handed between the Visualiser Sandbox and the Curated Room
 * Layout. Persisted per project (or "sandbox") in localStorage; both tools read
 * and write the same shape, so pieces, positions and prices never drift.
 * Coordinates are room metres with the origin at the room centre (x, z).
 */
export type SharedRoomItem = {
  productId: string;
  name: string;
  glbUrl: string | null;
  x: number;
  z: number;
  rotationY: number;
  /** Live EUR RRP; null = Price upon Request (excluded from the budget). */
  priceEur: number | null;
};

export type SharedRoomLayout = {
  projectId: string | null;
  room: { width: number; length: number; height: number };
  wallFinish?: string | null;
  floorFinish?: string | null;
  items: SharedRoomItem[];
  source: "visualiser" | "curated";
  updatedAt: number;
};

const KEY = "ma-shared-room-layout-v1:";
export const sharedRoomKey = (projectId: string | null | undefined) => `${KEY}${projectId || "sandbox"}`;

// In-memory copy survives same-tab navigation even when localStorage is full.
const memory = new Map<string, SharedRoomLayout>();

export function readSharedRoomLayout(projectId: string | null | undefined, stamp?: number | null): SharedRoomLayout | null {
  const mem = memory.get(sharedRoomKey(projectId));
  if (mem && (stamp == null || mem.updatedAt === stamp)) return mem;
  try {
    const raw = JSON.parse(localStorage.getItem(sharedRoomKey(projectId)) || "null");
    if (!(raw && Array.isArray(raw.items) && raw.room)) return null;
    // A stamped handoff must never fall back to an older, different layout.
    if (stamp != null && raw.updatedAt !== stamp) return null;
    return raw as SharedRoomLayout;
  } catch { return null; }
}

export function writeSharedRoomLayout(layout: SharedRoomLayout) {
  const key = sharedRoomKey(layout.projectId);
  memory.set(key, layout);
  const json = JSON.stringify(layout);
  try { localStorage.setItem(key, json); return; } catch { /* full: free other shared layouts and retry */ }
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(KEY) && k !== key).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(key);
    localStorage.setItem(key, json);
  } catch { /* still full: in-memory copy carries the handoff in this tab */ }
}

/** Allocated = sum of priced pieces; POR pieces never count. */
export function sharedBudget(items: Pick<SharedRoomItem, "priceEur">[], totalBudget: number) {
  const allocated = items.reduce((sum, item) => sum + (item.priceEur ?? 0), 0);
  return { totalBudget, allocatedSpend: allocated, remainingBuffer: totalBudget - allocated };
}

export function sharedToScene(layout: SharedRoomLayout, totalBudget: number): AICuratedSceneSchema {
  const { width: W, length: L, height: H } = layout.room;
  return {
    roomDimensions: { width: W, length: L, height: H },
    architecturalAnchors: [
      { type: "window", position: [0, 1.5, -L / 2], rotation: [0, 0, 0], scale: [2.4, 1.8, 0.1] },
      { type: "door", position: [W / 2, 1.1, L / 4], rotation: [0, -Math.PI / 2, 0], scale: [1.0, 2.2, 0.1] },
    ],
    curatedAssets: layout.items.filter((item) => item.glbUrl).map((item) => ({
      sku: item.productId,
      componentId: item.productId,
      glbUrl: item.glbUrl as string,
      position: [item.x, 0, item.z],
      rotation: [0, item.rotationY, 0],
      scale: [1, 1, 1],
      priceAtCuration: item.priceEur ?? 0,
    })),
    financialSummary: sharedBudget(layout.items, totalBudget),
  };
}

export function sceneToSharedItems(scene: AICuratedSceneSchema, names: (id: string) => string, price: (id: string, fallback: number) => number | null): SharedRoomItem[] {
  return scene.curatedAssets.map((a) => ({
    productId: a.componentId,
    name: names(a.componentId),
    glbUrl: a.glbUrl,
    x: a.position[0],
    z: a.position[2],
    rotationY: a.rotation[1],
    priceEur: price(a.componentId, a.priceAtCuration),
  }));
}
