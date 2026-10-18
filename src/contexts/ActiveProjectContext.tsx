import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import { DEFAULT_LAYOUT_BOUNDS, layoutItems, type ActiveProjectState, type RoomBounds, type WorkspaceView } from "@/lib/activeProjectLayout";

type ProjectContext = {
  state: ActiveProjectState; objects: PlacedObject[]; setObjects: Dispatch<SetStateAction<PlacedObject[]>>;
  view: WorkspaceView; setView: Dispatch<SetStateAction<WorkspaceView>>;
  setFloorPlanUrl: Dispatch<SetStateAction<string | null>>; setBounds: Dispatch<SetStateAction<RoomBounds>>;
  hasSavedLayout: boolean; sandboxStorageKey: string;
};
const Context = createContext<ProjectContext | null>(null);
export const useActiveProject = () => useContext(Context);
export function ActiveProjectProvider({ children, projectId, accountId, initialView }: { children: ReactNode; projectId: string; accountId: string; initialView: WorkspaceView }) {
  const key = `ma-active-layout-v1:${accountId}:${projectId}`;
  const sandboxStorageKey = `trade-visualiser-sandbox-v3:${accountId}:${projectId}`;
  const initial = useMemo(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      if (saved && Array.isArray(saved.objects)) return { ...saved, hasSavedLayout: true };
      const sandbox = JSON.parse(sessionStorage.getItem("trade-visualiser-sandbox-v3") || "null");
      if (sandbox && (sandbox.projectId || "sandbox") === projectId) return { objects: sandbox.objects || [], hasSavedLayout: true };
    } catch { /* Invalid/offline storage leaves the current workspace usable. */ }
    return { objects: [] };
  }, [key, projectId]);
  const [objects, setObjects] = useState<PlacedObject[]>(initial.objects);
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(initial.floorPlanUrl || null);
  const [bounds, setBounds] = useState<RoomBounds>(initial.bounds || DEFAULT_LAYOUT_BOUNDS);
  const [view, setView] = useState<WorkspaceView>(initialView);
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify({ objects, floorPlanUrl, bounds })); } catch { /* Full storage does not clear the room. */ }
  }, [key, objects, floorPlanUrl, bounds]);
  const state: ActiveProjectState = { projectId, floorPlanUrl, placedItems: layoutItems(objects), bounds, cameraPerspective: view === "sandbox" ? "eye-level" : "isometric" };
  return <Context.Provider value={{ state, objects, setObjects, view, setView, setFloorPlanUrl, setBounds, hasSavedLayout: initial.hasSavedLayout === true, sandboxStorageKey }}>{children}</Context.Provider>;
}