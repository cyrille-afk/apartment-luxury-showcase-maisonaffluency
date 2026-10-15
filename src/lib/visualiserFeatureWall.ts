import * as THREE from "three";

export type FeatureWallFinish = "travertine" | "microcement" | "raw-concrete";

export const FEATURE_WALL_FINISHES: Record<FeatureWallFinish, { label: string; roughness: number; bumpScale: number; tint: string }> = {
  travertine: { label: "Travertine", roughness: 0.88, bumpScale: 0.008, tint: "#ffffff" },
  microcement: { label: "Microcement", roughness: 0.92, bumpScale: 0.005, tint: "#ffffff" },
  "raw-concrete": { label: "Raw Concrete", roughness: 0.95, bumpScale: 0.011, tint: "#f6f6f4" },
};

const FINISH_IDS = Object.keys(FEATURE_WALL_FINISHES) as FeatureWallFinish[];

/** Normalise any stored value; unknown finishes fall back to travertine. */
export function featureWallFinish(value: unknown): FeatureWallFinish {
  return FINISH_IDS.includes(value as FeatureWallFinish) ? (value as FeatureWallFinish) : "travertine";
}

export const FEATURE_WALL = {
  panels: 3, gap: 0.012, thickness: 0.12, height: 4.4,
  minWidth: 80, rearZ: -8, clearance: 3,
  roughness: 0.88, bumpScale: 0.008, stone: "#ffffff", reveal: "#aaa69e",
} as const;

/** Rear perimeter wall at the back of the room, always behind the whole furniture layout. */
export function featureWallLayout(bounds: THREE.Box3) {
  const valid = !bounds.isEmpty();
  // Perimeter wall: spans the full 80 m floor, centred on it, so the floor runs straight into its base.
  const width = valid ? Math.max(FEATURE_WALL.minWidth, bounds.max.x - bounds.min.x + 6) : FEATURE_WALL.minWidth;
  const centerX = 0;
  const frontZ = valid ? Math.min(FEATURE_WALL.rearZ, bounds.min.z - FEATURE_WALL.clearance) : FEATURE_WALL.rearZ;
  const height = valid ? Math.max(FEATURE_WALL.height, bounds.max.y + 0.8) : FEATURE_WALL.height;
  const panelWidth = (width - FEATURE_WALL.gap * (FEATURE_WALL.panels - 1)) / FEATURE_WALL.panels;
  return { width, height, centerX, frontZ, panelWidth };
}