import * as THREE from "three";

export const DEFAULT_ARCHITECTURAL_DOF = { enabled: true, strength: 1, focusRange: 1.2 } as const;

/** One-time adoption of the portfolio defaults; later explicit OFF/strength choices survive. */
export function architecturalDofSettings(saved: { dofRenderVersion?: number; depthOfField?: boolean; dofStrength?: number }) {
  if (saved.dofRenderVersion !== 1) return { depthOfField: true, dofStrength: 1 };
  return { depthOfField: saved.depthOfField !== false, dofStrength: saved.dofStrength ?? 1 };
}

/** Keep the nearest armchair and side table within the same sharp depth band. */
export function foregroundFurnitureFocus(scene: THREE.Scene, camera: THREE.Camera, objects: readonly { instanceId: string; product_name: string }[], target: THREE.Vector3): number | null {
  const nearest = [/arm\s*chair|tub\s*chair|lounge\s*chair/i, /side\s*table|end\s*table/i].map((pattern) => {
    let result: { bounds: THREE.Box3; depth: number } | undefined;
    for (const object of objects) {
      if (!pattern.test(object.product_name)) continue;
      const centre = new THREE.Vector3();
      if (!selectedObjectFocus(scene, object.instanceId, centre)) continue;
      const depth = photographicFocusDistance(camera, centre);
      if (result && result.depth <= depth) continue;
      let piece: THREE.Object3D | undefined;
      scene.traverse((node) => { if (node.userData.visualiserInstanceId === object.instanceId) piece = node; });
      if (piece) result = { bounds: new THREE.Box3().setFromObject(piece), depth };
    }
    return result;
  }).filter((entry) => entry !== undefined);
  if (!nearest.length) return null;
  let near = Infinity, far = 0;
  const centre = new THREE.Vector3();
  for (const entry of nearest) {
    centre.add(entry.bounds.getCenter(new THREE.Vector3()));
    for (const x of [entry.bounds.min.x, entry.bounds.max.x]) for (const y of [entry.bounds.min.y, entry.bounds.max.y]) for (const z of [entry.bounds.min.z, entry.bounds.max.z]) {
      const depth = photographicFocusDistance(camera, new THREE.Vector3(x, y, z));
      near = Math.min(near, depth); far = Math.max(far, depth);
    }
  }
  target.copy(centre.divideScalar(nearest.length));
  // Centre the focal plane along the camera axis while preserving lateral framing.
  target.addScaledVector(camera.getWorldDirection(new THREE.Vector3()), (near + far) / 2 - photographicFocusDistance(camera, target));
  return Math.max(DEFAULT_ARCHITECTURAL_DOF.focusRange, far - near + 0.8);
}

/** Only furniture meshes contribute; labels and editor gizmos are outside this group. */
export function selectedObjectFocus(scene: THREE.Scene, instanceId: string | null, target: THREE.Vector3): boolean {
  if (!instanceId) return false;
  let piece: THREE.Object3D | undefined;
  scene.traverse((object) => {
    if (object.userData.visualiserInstanceId === instanceId) piece = object;
  });
  if (!piece) return false;
  piece.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  const meshBounds = new THREE.Box3();
  piece.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) bounds.union(meshBounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld));
  });
  if (bounds.isEmpty()) return false;
  bounds.getCenter(target);
  return true;
}

export function photographicFocusDistance(camera: THREE.Camera, target: THREE.Vector3): number {
  camera.updateMatrixWorld();
  return Math.max(0.1, -target.clone().applyMatrix4(camera.matrixWorldInverse).z);
}

export const photographicBokeh = (enabled: boolean, strength: number): number =>
  enabled ? Math.min(10, Math.max(1, strength)) * 2 : 0;