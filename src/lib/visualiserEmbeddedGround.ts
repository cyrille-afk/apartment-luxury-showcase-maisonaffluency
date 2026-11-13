import * as THREE from "three";

/** Detach only oversized ground sheets before fitting; Box3 includes hidden meshes.
 * Test the exporter-space thin axis to support both Y-up and Z-up imports.
 */
export function stripEmbeddedGroundPlanes(root: THREE.Object3D): THREE.Mesh[] {
  root.updateMatrixWorld(true);
  const entries: Array<{ mesh: THREE.Mesh; bounds: THREE.Box3; size: THREE.Vector3 }> = [];
  root.traverseVisible(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.computeBoundingBox();
    const local = child.geometry.boundingBox;
    if (!local || local.isEmpty()) return;
    const bounds = local.clone().applyMatrix4(child.matrixWorld);
    entries.push({ mesh: child, bounds, size: bounds.getSize(new THREE.Vector3()) });
  });
  const removed: THREE.Mesh[] = [];
  for (const entry of entries) {
    const sizes = entry.size.toArray();
    const thinAxis = sizes.indexOf(Math.min(...sizes));
    const wideAxes = [0, 1, 2].filter(axis => axis !== thinAxis);
    if (sizes[thinAxis] > Math.min(...wideAxes.map(axis => sizes[axis])) * 0.005) continue;
    const furniture = new THREE.Box3();
    for (const other of entries) {
      const otherSize = other.size.toArray();
      if (otherSize[thinAxis] > Math.max(...otherSize) * 0.01) furniture.union(other.bounds);
    }
    if (furniture.isEmpty()) continue;
    const furnitureSize = furniture.getSize(new THREE.Vector3()).toArray();
    if (!wideAxes.every(axis => sizes[axis] > furnitureSize[axis] * 1.1)) continue;
    if (Math.abs(entry.bounds.max.toArray()[thinAxis] - furniture.min.toArray()[thinAxis]) > furnitureSize[thinAxis] * 0.04) continue;
    entry.mesh.visible = false;
    entry.mesh.castShadow = false;
    entry.mesh.receiveShadow = false;
    entry.mesh.removeFromParent();
    removed.push(entry.mesh);
  }
  return removed;
}
