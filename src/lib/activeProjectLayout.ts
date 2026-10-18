import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";

export type WorkspaceView = "plan" | "axonometric" | "sandbox";
export type RoomBounds = { width: number; depth: number; height: number };
export type ActiveProjectState = {
  projectId: string;
  floorPlanUrl: string | null;
  placedItems: Array<{ id: string; name: string; x: number; y: number; rotation: number; texture: string }>;
  cameraPerspective: "isometric" | "eye-level";
  bounds: RoomBounds;
};
export const DEFAULT_LAYOUT_BOUNDS: RoomBounds = { width: 12, depth: 8, height: 3 };
export function layoutItems(objects: PlacedObject[]): ActiveProjectState["placedItems"] {
  return objects.map(object => ({ id: object.instanceId, name: object.product_name, x: object.position[0], y: object.position[2], rotation: object.rotation[1], texture: object.material?.image_url || object.topMaterial?.image_url || object.upholsteryMaterial?.image_url || "" }));
}
export function patchLayoutItem(objects: PlacedObject[], id: string, patch: { x?: number; y?: number; rotation?: number }): PlacedObject[] {
  return objects.map(object => object.instanceId !== id || object.positionLocked ? object : {
    ...object,
    position: [patch.x ?? object.position[0], object.position[1], patch.y ?? object.position[2]],
    rotation: [object.rotation[0], patch.rotation ?? object.rotation[1], object.rotation[2]],
  });
}
export function layoutCamera(bounds: RoomBounds, view: WorkspaceView): { position: [number, number, number]; target: [number, number, number]; polar: number; fov: number } {
  if (view === "axonometric") return { position: [bounds.width * 0.65, Math.max(bounds.width, bounds.depth) * 1.25, bounds.depth * 0.9], target: [0, 0, 0], polar: Math.PI / 5, fov: 45 };
  return { position: [0, 1.6, Math.max(bounds.width, bounds.depth) * 1.2], target: [0, 1.6, 0], polar: Math.PI / 2, fov: 60 };
}