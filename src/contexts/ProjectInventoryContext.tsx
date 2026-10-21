import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Global project inventory: products added from the product page via
 * "Add to Co-Pilot Workspace" accumulate here so the Spatial Visualiser
 * (2D Layout Plan / Axonometric Studio) can place them into the room.
 *
 * Persisted to sessionStorage so the list survives in-app navigation
 * (product page → visualiser) without leaking across sessions.
 */

export interface ProjectInventoryItem {
  /** Product id (trade product or curator pick id). */
  id: string;
  productName: string;
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
  addToInventory: (item: Omit<ProjectInventoryItem, "addedAt">) => void;
  removeFromInventory: (id: string, variantLabel: string | null) => void;
  clearInventory: () => void;
}

const ProjectInventoryContext = createContext<ProjectInventoryContextValue | undefined>(undefined);

const STORAGE_KEY = "ma:project-inventory-v1";

function loadInitial(): ProjectInventoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string") : [];
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

  const addToInventory = (item: Omit<ProjectInventoryItem, "addedAt">) => {
    setProjectInventory((current) => {
      // Same product + same variant is already in the project — don't duplicate.
      const exists = current.some(
        (entry) => entry.id === item.id && entry.variantLabel === item.variantLabel,
      );
      if (exists) return current;
      return [...current, { ...item, addedAt: Date.now() }];
    });
  };

  const removeFromInventory = (id: string, variantLabel: string | null) => {
    setProjectInventory((current) =>
      current.filter((entry) => !(entry.id === id && entry.variantLabel === variantLabel)),
    );
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
