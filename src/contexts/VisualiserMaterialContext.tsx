import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type VisualiserMaterial = {
  id: string;
  name: string;
  brand_name: string;
  category: string;
  material_type: string | null;
  color_family: string | null;
  image_url: string | null;
};

type VisualiserMaterialContextValue = {
  activeMaterial: VisualiserMaterial | null;
  setActiveMaterial: (material: VisualiserMaterial | null) => void;
};

const STORAGE_KEY = "trade-visualiser-active-material-v1";
const EVENT_NAME = "trade-visualiser-material-changed";

const readMaterial = (): VisualiserMaterial | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as VisualiserMaterial : null;
  } catch {
    return null;
  }
};

const VisualiserMaterialContext = createContext<VisualiserMaterialContextValue | null>(null);

export function VisualiserMaterialProvider({ children }: { children: ReactNode }) {
  const [activeMaterial, setActiveMaterialState] = useState<VisualiserMaterial | null>(readMaterial);

  const setActiveMaterial = useCallback((material: VisualiserMaterial | null) => {
    setActiveMaterialState(material);
    try {
      if (material) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(material));
      else window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    } catch {
      /* Material selection remains available in memory. */
    }
  }, []);

  useEffect(() => {
    const sync = () => setActiveMaterialState(readMaterial());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const value = useMemo(() => ({ activeMaterial, setActiveMaterial }), [activeMaterial, setActiveMaterial]);
  return <VisualiserMaterialContext.Provider value={value}>{children}</VisualiserMaterialContext.Provider>;
}

export function useVisualiserMaterial() {
  const context = useContext(VisualiserMaterialContext);
  if (!context) throw new Error("useVisualiserMaterial must be used within VisualiserMaterialProvider");
  return context;
}