import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import { DEFAULT_LAYOUT_BOUNDS, layoutItems, type ActiveProjectState, type PlanColumn, type RoomBounds, type WorkspaceView } from "@/lib/activeProjectLayout";

type ProjectContext = {
  state: ActiveProjectState; objects: PlacedObject[]; setObjects: Dispatch<SetStateAction<PlacedObject[]>>;
  view: WorkspaceView; setView: Dispatch<SetStateAction<WorkspaceView>>;
  setFloorPlanUrl: Dispatch<SetStateAction<string | null>>; setBounds: Dispatch<SetStateAction<RoomBounds>>; setColumns: Dispatch<SetStateAction<PlanColumn[]>>;
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
    return { objects: [] } as { objects: PlacedObject[]; savedAt?: number; floorPlanUrl?: string; bounds?: RoomBounds; columns?: PlanColumn[]; hasSavedLayout?: boolean };
  }, [key, projectId]);
  const [objects, setObjects] = useState<PlacedObject[]>(initial.objects);
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(initial.floorPlanUrl || null);
  const [bounds, setBounds] = useState<RoomBounds>(initial.bounds || DEFAULT_LAYOUT_BOUNDS);
  const [columns, setColumns] = useState<PlanColumn[]>(Array.isArray(initial.columns) ? initial.columns : []);
  const [view, setView] = useState<WorkspaceView>(initialView);
  // Project copy: pieces with their fabrics/finishes, bounds and plan are saved with the project so any
  // later visit (new tab or device) restores them. The newer of session and project copy wins on load.
  const persistable = /^[0-9a-f-]{36}$/i.test(projectId);
  const [cloudReady, setCloudReady] = useState(!persistable);
  const [savedAt, setSavedAt] = useState<number>(typeof initial.savedAt === "number" ? initial.savedAt : 0);
  useEffect(() => {
    if (!persistable) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("project_visualiser_layouts").select("layout, updated_at").eq("project_id", projectId).maybeSingle();
      if (cancelled) return;
      const remote = data?.layout as { objects?: PlacedObject[]; floorPlanUrl?: string | null; bounds?: RoomBounds; columns?: PlanColumn[] } | undefined;
      const remoteAt = data ? new Date(data.updated_at).getTime() : 0;
      if (remote && Array.isArray(remote.objects) && remoteAt > savedAt) {
        setObjects(remote.objects); setFloorPlanUrl(remote.floorPlanUrl ?? null);
        if (remote.bounds) setBounds(remote.bounds);
        setColumns(Array.isArray(remote.columns) ? remote.columns : []);
        setSavedAt(remoteAt);
      }
      setCloudReady(true);
    })().catch(() => { if (!cancelled) setCloudReady(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  const firstWrite = useRef(true);
  useEffect(() => {
    if (!cloudReady) return;
    const now = Date.now();
    try { sessionStorage.setItem(key, JSON.stringify({ objects, floorPlanUrl, bounds, columns, savedAt: now })); } catch { /* Full storage does not clear the room. */ }
    if (firstWrite.current) { firstWrite.current = false; return; } // hydration itself is not an edit
    if (!persistable) return;
    const t = window.setTimeout(() => {
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        await supabase.from("project_visualiser_layouts").upsert({ project_id: projectId, layout: JSON.parse(JSON.stringify({ objects, floorPlanUrl, bounds, columns })), updated_by: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
      })().catch(() => { /* session copy keeps the room; next edit retries */ });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [cloudReady, key, objects, floorPlanUrl, bounds, columns, persistable, projectId]);
  const state: ActiveProjectState = { projectId, floorPlanUrl, placedItems: layoutItems(objects), bounds, columns, cameraPerspective: view === "sandbox" ? "eye-level" : "isometric" };
  return <Context.Provider value={{ state, objects, setObjects, view, setView, setFloorPlanUrl, setBounds, setColumns, hasSavedLayout: initial.hasSavedLayout === true, sandboxStorageKey }}>{children}</Context.Provider>;
}