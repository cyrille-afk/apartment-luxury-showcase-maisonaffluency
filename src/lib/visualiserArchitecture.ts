import * as THREE from "three";

export const ARCHITECTURE = {
  height: 7.6, balconyY: 3.5, balconyDepth: 2.2, slabThickness: 0.24,
  railingHeight: 1.1, glassThickness: 0.025, columnSize: 0.85,
  columnClearance: 1.2, stoneTileWidth: 4, stoneTileHeight: 3.8,
} as const;

/** Architectural positions stay outside furniture bounds; no furniture transforms are changed. */
export function architecturalRoomLayout(bounds: THREE.Box3, rearZ: number) {
  const valid = !bounds.isEmpty();
  const height = Math.max(ARCHITECTURE.height, valid ? bounds.max.y + 4 : ARCHITECTURE.height);
  return {
    height,
    balconyY: height - ARCHITECTURE.slabThickness / 2,
    balconyFrontZ: rearZ + ARCHITECTURE.balconyDepth,
    // Foreground columns remain absent after resets and reloads.
    columns: [] as [number, number][],
  };
}