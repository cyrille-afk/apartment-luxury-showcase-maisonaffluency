import type { AICuratedSceneSchema, Vec3 } from "@/types/aiCuratedScene";
import { curatedDimensions } from "./curatedLayoutDimensions";

export const WALK_SPEED = 1.4;
export const WALK_MARGIN = 0.25;
export type WalkInput = { forward: number; right: number; turn: number };

export function canStand(scene: AICuratedSceneSchema, x: number, z: number): boolean {
  if (Math.abs(x) > scene.roomDimensions.width / 2 - WALK_MARGIN || Math.abs(z) > scene.roomDimensions.length / 2 - WALK_MARGIN) return false;
  return !scene.curatedAssets.some(a => {
    const d = curatedDimensions(a);
    const dx = x - a.position[0], dz = z - a.position[2], yaw = a.rotation[1];
    const localX = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
    const localZ = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
    return Math.abs(localX) < d.w * Math.abs(a.scale[0]) / 2 + WALK_MARGIN && Math.abs(localZ) < d.d * Math.abs(a.scale[2]) / 2 + WALK_MARGIN;
  });
}

export function walkPosition(scene: AICuratedSceneSchema, position: Vec3, yaw: number, input: WalkInput, delta: number): Vec3 {
  const length = Math.max(1, Math.hypot(input.forward, input.right));
  const step = WALK_SPEED * Math.min(Math.max(delta, 0), 0.05) / length;
  const dx = (-Math.sin(yaw) * input.forward + Math.cos(yaw) * input.right) * step;
  const dz = (-Math.cos(yaw) * input.forward - Math.sin(yaw) * input.right) * step;
  let [x, y, z] = position;
  if (canStand(scene, x + dx, z)) x += dx;
  if (canStand(scene, x, z + dz)) z += dz;
  return [x, y, z];
}

export function walkViewpoint(scene: AICuratedSceneSchema, view: "entrance" | "left" | "right"): Vec3 | null {
  const { width: w, length: l, height: h } = scene.roomDimensions;
  const wanted = view === "entrance" ? [0, l / 2 - 0.5] : [view === "left" ? -w / 2 + 0.5 : w / 2 - 0.5, 0];
  let best: Vec3 | null = null, distance = Infinity;
  for (let x = -w / 2 + WALK_MARGIN; x <= w / 2 - WALK_MARGIN; x += 0.2) {
    for (let z = -l / 2 + WALK_MARGIN; z <= l / 2 - WALK_MARGIN; z += 0.2) {
      const score = (x - wanted[0]) ** 2 + (z - wanted[1]) ** 2;
      if (score < distance && canStand(scene, x, z)) { distance = score; best = [x, Math.min(1.6, h - 0.2), z]; }
    }
  }
  return best;
}