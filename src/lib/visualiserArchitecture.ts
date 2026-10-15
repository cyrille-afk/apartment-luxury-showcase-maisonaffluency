import * as THREE from "three";

export const ARCHITECTURE = {
  height: 7.6, balconyY: 3.5, balconyDepth: 2.2, slabThickness: 0.24,
  railingHeight: 1.1, glassThickness: 0.025, columnSize: 0.85,
  columnClearance: 1.2, stoneTileWidth: 4, stoneTileHeight: 3.8,
} as const;

/** Architectural positions stay outside furniture bounds; no furniture transforms are changed. */
export function architecturalRoomLayout(bounds: THREE.Box3, rearZ: number) {
  const valid = !bounds.isEmpty();
  const rightX = Math.max(3.6, valid ? bounds.max.x + ARCHITECTURE.columnClearance : 3.6);
  const nearZ = Math.max(1.4, valid ? bounds.max.z + 0.6 : 1.4);
  return {
    height: Math.max(ARCHITECTURE.height, valid ? bounds.max.y + 4 : ARCHITECTURE.height),
    balconyFrontZ: rearZ + ARCHITECTURE.balconyDepth,
    columns: [[rightX, nearZ], [rightX + 0.55, Math.min(-2.6, nearZ - 4)]] as [number, number][],
  };
}