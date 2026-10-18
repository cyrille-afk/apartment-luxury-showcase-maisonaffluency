import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ScenePresetData } from "@/lib/visualiserScenePresets";
import type { RoomBounds } from "@/lib/activeProjectLayout";

export type ProjectSnapshotData = { version: 1; scene: ScenePresetData; bounds: RoomBounds; floorPlanUrl: string | null };
export type ProjectSnapshot = { id: string; name: string; created_at: string; piece_count: number; thumbnail: string | null };
export function snapshotData(scene: ScenePresetData, bounds: RoomBounds, floorPlanUrl: string | null): ProjectSnapshotData {
  return JSON.parse(JSON.stringify({ version: 1, scene, bounds, floorPlanUrl }));
}
export function validateSnapshot(value: unknown): ProjectSnapshotData {
  const data = value as ProjectSnapshotData | null;
  if (!data || data.version !== 1 || !Array.isArray(data.scene?.objects) || !data.bounds ||
    ![data.bounds.width, data.bounds.depth, data.bounds.height].every(n => Number.isFinite(n) && n > 0) ||
    !(data.floorPlanUrl === null || typeof data.floorPlanUrl === "string") ||
    data.scene.objects.some(o => !o.instanceId || !Array.isArray(o.position) || o.position.length !== 3 || !o.position.every(Number.isFinite) || !Array.isArray(o.rotation) || o.rotation.length !== 3 || !o.rotation.every(Number.isFinite))) {
    throw new Error("This snapshot cannot be restored. Your current layout has not changed.");
  }
  return JSON.parse(JSON.stringify(data));
}
export async function listProjectSnapshots(projectKey: string): Promise<ProjectSnapshot[]> {
  const { data, error } = await supabase.from("project_layout_snapshots").select("id,name,created_at,piece_count,thumbnail").eq("project_key", projectKey).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function saveProjectSnapshot(projectKey: string, name: string, data: ProjectSnapshotData, thumbnail?: string): Promise<ProjectSnapshot> {
  const clean = name.trim();
  if (!clean || clean.length > 120) throw new Error("Enter a snapshot name of up to 120 characters.");
  const frozen = validateSnapshot(data);
  const { data: saved, error } = await supabase.from("project_layout_snapshots").insert({ project_key: projectKey, name: clean, data: frozen as unknown as Json, piece_count: frozen.scene.objects.length, thumbnail: thumbnail ?? null }).select("id,name,created_at,piece_count,thumbnail").single();
  if (error) throw error;
  return saved;
}
export async function loadProjectSnapshot(projectKey: string, id: string): Promise<ProjectSnapshotData> {
  const { data, error } = await supabase.from("project_layout_snapshots").select("data").eq("project_key", projectKey).eq("id", id).single();
  if (error) throw error;
  return validateSnapshot(data.data);
}
export async function deleteProjectSnapshot(projectKey: string, id: string) {
  const { error } = await supabase.from("project_layout_snapshots").delete().eq("project_key", projectKey).eq("id", id);
  if (error) throw error;
}
