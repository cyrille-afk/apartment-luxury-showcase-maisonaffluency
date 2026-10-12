import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { PlacedObject } from "./SceneObject";

/**
 * Shared reactive selection state between the 3D canvas viewport and the
 * inspector sidebar. The canvas writes via setSelectedId; the inspector
 * reads the derived `selected` object. Single source of truth — both sides
 * can never drift apart.
 */
type VisualiserSelectionContextValue = {
  objects: PlacedObject[];
  selectedId: string | null;
  selected: PlacedObject | null;
  setSelectedId: (id: string | null) => void;
};

const VisualiserSelectionContext = createContext<VisualiserSelectionContextValue | null>(null);

export const VisualiserSelectionProvider = ({
  objects,
  selectedId,
  setSelectedId,
  children,
}: {
  objects: PlacedObject[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  children: ReactNode;
}) => {
  const selected = useMemo(
    () => objects.find((object) => object.instanceId === selectedId) ?? null,
    [objects, selectedId],
  );
  const value = useMemo(
    () => ({ objects, selectedId, selected, setSelectedId }),
    [objects, selectedId, selected, setSelectedId],
  );
  return (
    <VisualiserSelectionContext.Provider value={value}>
      {children}
    </VisualiserSelectionContext.Provider>
  );
};

export const useVisualiserSelection = (): VisualiserSelectionContextValue => {
  const context = useContext(VisualiserSelectionContext);
  if (!context) {
    throw new Error("useVisualiserSelection must be used within VisualiserSelectionProvider");
  }
  return context;
};
