import * as THREE from "three";

export const FEATURE_WALL = {
  panels: 3, gap: 0.012, thickness: 0.12, height: 4.4,
  minWidth: 9, rearZ: -3.5, clearance: 1.2,
  roughness: 0.88, bumpScale: 0.008, stone: "#ffffff", reveal: "#aaa69e",
} as const;

/** A single open backdrop, always behind the actual furniture envelope. */
export function featureWallLayout(bounds: THREE.Box3) {
  const valid = !bounds.isEmpty();
  const width = valid ? Math.max(FEATURE_WALL.minWidth, bounds.max.x - bounds.min.x + 2.4) : FEATURE_WALL.minWidth;
  const centerX = valid ? (bounds.min.x + bounds.max.x) / 2 : 0;
  const frontZ = valid ? Math.min(FEATURE_WALL.rearZ, bounds.min.z - FEATURE_WALL.clearance) : FEATURE_WALL.rearZ;
  const height = valid ? Math.max(FEATURE_WALL.height, bounds.max.y + 0.8) : FEATURE_WALL.height;
  const panelWidth = (width - FEATURE_WALL.gap * (FEATURE_WALL.panels - 1)) / FEATURE_WALL.panels;
  return { width, height, centerX, frontZ, panelWidth };
}