import * as THREE from "three";

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