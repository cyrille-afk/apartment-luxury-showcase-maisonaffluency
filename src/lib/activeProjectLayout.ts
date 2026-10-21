import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";

export type WorkspaceView = "plan" | "axonometric" | "sandbox";
export type RoomBounds = { width: number; depth: number; height: number };
/** Structural column in room metres; origin at the room centre (x = 3D x, y = 3D z). */
export type PlanColumn = { id: string; x: number; y: number; size: number };
export type ActiveProjectState = {
  projectId: string;
  floorPlanUrl: string | null;
  placedItems: Array<{ id: string; name: string; x: number; y: number; rotation: number; texture: string }>;
  cameraPerspective: "isometric" | "eye-level";
  bounds: RoomBounds;
  columns: PlanColumn[];
};
export const DEFAULT_LAYOUT_BOUNDS: RoomBounds = { width: 12, depth: 8, height: 3 };
export const DEFAULT_COLUMN_SIZE_M = 0.4;
export const WALL_THICKNESS_M = 0.15;

export function layoutItems(objects: PlacedObject[]): ActiveProjectState["placedItems"] {
  return objects.map(object => ({ id: object.instanceId, name: object.product_name, x: object.position[0], y: object.position[2], rotation: object.rotation[1], texture: object.material?.image_url || object.topMaterial?.image_url || object.upholsteryMaterial?.image_url || "" }));
}

/** Keep a footprint centre inside the room walls (radius = half footprint). */
export function clampToRoom(x: number, y: number, bounds: RoomBounds, radius = 0): [number, number] {
  const hw = Math.max(0, bounds.width / 2 - radius);
  const hd = Math.max(0, bounds.depth / 2 - radius);
  return [Math.max(-hw, Math.min(hw, x)), Math.max(-hd, Math.min(hd, y))];
}

export function patchLayoutItem(objects: PlacedObject[], id: string, patch: { x?: number; y?: number; rotation?: number }, bounds?: RoomBounds): PlacedObject[] {
  return objects.map(object => {
    if (object.instanceId !== id || object.positionLocked) return object;
    let x = patch.x ?? object.position[0];
    let y = patch.y ?? object.position[2];
    if (bounds) [x, y] = clampToRoom(x, y, bounds);
    return {
      ...object,
      position: [x, object.position[1], y],
      rotation: [object.rotation[0], patch.rotation ?? object.rotation[1], object.rotation[2]],
    };
  });
}

/** Columns as circular drag obstacles in the same footprint space as furniture. */
export function columnObstacles(columns: PlanColumn[]): Array<{ position: [number, number, number]; radius: number }> {
  return columns.map(column => ({ position: [column.x, 0, column.y], radius: (column.size * Math.SQRT2) / 2 }));
}

/** Both 3D cameras aim at the room centre — the 2D plan origin — never a fixed showroom point. */
export function layoutCamera(bounds: RoomBounds, view: WorkspaceView): { position: [number, number, number]; target: [number, number, number]; polar: number; fov: number } {
  if (view === "axonometric") return { position: [bounds.width * 0.65, Math.max(bounds.width, bounds.depth) * 1.25, bounds.depth * 0.9], target: [0, 0, 0], polar: Math.PI / 5, fov: 45 };
  return { position: [0, 1.6, bounds.depth / 2 + Math.max(bounds.width, bounds.depth) * 0.7], target: [0, 1.2, 0], polar: Math.PI / 2, fov: 60 };
}
