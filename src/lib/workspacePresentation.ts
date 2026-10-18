import { sharedVisualiserRoom, type SharedVisualiserRoom } from "./sharedVisualiserRoom";
export type WorkspacePresentation = { title: string; studioName: string; studioLogo: string | null; floorPlanUrl: string | null; views: { id: string; name: string; created_at: string; floorPlanUrl: string | null; bounds: { width: number; depth: number; height: number }; scene: SharedVisualiserRoom | null }[] };
export function parseWorkspacePresentation(value: unknown): WorkspacePresentation {
  const data = value as WorkspacePresentation;
  if (!data || typeof data.title !== "string" || !Array.isArray(data.views)) throw new Error("Invalid presentation");
  return { ...data, views: data.views.map(view => ({ ...view, scene: view.scene?.objects.length ? sharedVisualiserRoom(view.scene) : null })) };
}