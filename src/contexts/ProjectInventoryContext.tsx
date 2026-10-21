import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { VisualiserMaterial } from "./VisualiserMaterialContext";

/**
 * Global project inventory: products added from the product page via
 * "Add to Co-Pilot Workspace" accumulate here so the Spatial Visualiser
 * (2D Layout Plan / Axonometric Studio) can place them into the room.
 *
 * Persisted to sessionStorage so the list survives in-app navigation
 * (product page → visualiser) without leaking across sessions.
 */

export interface ProjectInventoryItem {
  /** Unique id for THIS configured instance — every "Add to Co-Pilot
   *  Workspace" click mints one, so the same product can appear multiple
   *  times with different finishes/dimensions. */
  instanceId: string;
  /** Product id (trade product or curator pick id). */
  id: string;
  productName: string;
  /** Exact page item identity, never a related product or taxonomy label. */
  productType?: string;
  selectedUpholstery?: string | null;
  selectedFrameFinish?: string | null;
  upholsteryMaterial?: VisualiserMaterial | null;
  brandName: string;
  imageUrl: string | null;
  /** 3D model path (GLB) when the product has one. */
  glbUrl: string | null;
  /** Selected dimensions / size label, falling back to catalogue dimensions. */
  dimensions: string | null;
  /** Full selected variant label (size · finishes) as shown on the quote line. */
  variantLabel: string | null;
  /** Individual selected finish names (base, top, material, fabric, wood). */
  finishes: string[];
  addedAt: number;
}

interface ProjectInventoryContextValue {
  projectInventory: ProjectInventoryItem[];
  addToInventory: (item: Omit<ProjectInventoryItem, "addedAt" | "instanceId">) => void;
  removeFromInventory: (instanceId: string) => void;
  clearInventory: () => void;
}

const ProjectInventoryContext = createContext<ProjectInventoryContextValue | undefined>(undefined);

const STORAGE_KEY = "ma:project-inventory-v1";

function newInstanceId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* fall through to the manual id */
  }
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Every add appends a NEW deep-cloned instance with its own instanceId.
 * The snapshot is fully detached from the live product-page selection, so
 * later changes to the page (fabric, size, image) never mutate items that
 * already rest in the workspace drawer, and the same product can appear
 * multiple times with distinct configurations.
 */
export function upsertInventory(current: ProjectInventoryItem[], item: Omit<ProjectInventoryItem, "addedAt" | "instanceId">): ProjectInventoryItem[] {
  const productName = item.productName.trim();
  const snapshot: ProjectInventoryItem = {
    ...item,
    instanceId: newInstanceId(),
    productName,
    productType: productName,
    finishes: [...item.finishes],
    upholsteryMaterial: item.upholsteryMaterial ? { ...item.upholsteryMaterial } : null,
    addedAt: Date.now(),
  };
  return [...current, snapshot];
}

function loadInitial(): ProjectInventoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === "string")
      .map((item) => ({
        ...item,
        // Legacy entries saved before instanceId existed get one on load.
        instanceId: typeof item.instanceId === "string" && item.instanceId ? item.instanceId : newInstanceId(),
      }));
  } catch {
    return [];
  }
}

export function ProjectInventoryProvider({ children }: { children: ReactNode }) {
  const [projectInventory, setProjectInventory] = useState<ProjectInventoryItem[]>(loadInitial);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(projectInventory));
    } catch {
      /* Full storage does not clear the workspace. */
    }
  }, [projectInventory]);

  const addToInventory = (item: Omit<ProjectInventoryItem, "addedAt" | "instanceId">) => {
    setProjectInventory((current) => upsertInventory(current, item));
  };

  const removeFromInventory = (instanceId: string) => {
    setProjectInventory((current) => current.filter((entry) => entry.instanceId !== instanceId));
  };

  const clearInventory = () => setProjectInventory([]);

  return (
    <ProjectInventoryContext.Provider
      value={{ projectInventory, addToInventory, removeFromInventory, clearInventory }}
    >
      {children}
    </ProjectInventoryContext.Provider>
  );
}

export function useProjectInventory(): ProjectInventoryContextValue {
  const context = useContext(ProjectInventoryContext);
  if (!context) {
    throw new Error("useProjectInventory must be used within a ProjectInventoryProvider");
  }
  return context;
}
