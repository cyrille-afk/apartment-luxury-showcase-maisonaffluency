import { Box3, Group, Mesh, Object3D, Quaternion, Vector3 } from "three";
import { parseDimensionString } from "./productDimensions";

const Y_UP = new Vector3(0, 1, 0);
export type ModelOrientation = [number, number, number, number];
export const DEFAULT_MODEL_ORIENTATION: ModelOrientation = [0, 0, 0, 1];

/** Quarter turns in the sandbox frame, independently of placement yaw. */
export function rotateModelOrientation(current: ModelOrientation | undefined, axis: "X" | "Y" | "Z", direction: 1 | -1): ModelOrientation {
  const vector = new Vector3(axis === "X" ? 1 : 0, axis === "Y" ? 1 : 0, axis === "Z" ? 1 : 0);
  return new Quaternion().setFromAxisAngle(vector, direction * Math.PI / 2)
    .multiply(new Quaternion(...(current ?? DEFAULT_MODEL_ORIENTATION))).normalize().toArray() as ModelOrientation;
}

/** Re-seat a corrected model without changing fitted scale. */
export function applyModelOrientation(model: Group, orientation?: ModelOrientation): Group {
  const frame = new Group();
  frame.add(model);
  frame.quaternion.fromArray(orientation ?? DEFAULT_MODEL_ORIENTATION).normalize();
  frame.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(frame);
  if (!box.isEmpty()) {
    const center = box.getCenter(new Vector3());
    frame.position.set(-center.x, -box.min.y, -center.z);
  }
  frame.updateWorldMatrix(true, true);
  return frame;
}
// Verified against the authored GUM geometry: local +Y points toward its feet.
// Its exporter maps that to -Z, so the actual furniture up direction is +Z.
const VERIFIED_UP: Record<string, [number, number, number]> = {
  "f72b4185-9eeb-4ec0-b862-0972abc93a9f": [0, 0, 1],
};

/** Correct the import frame, never the cached GLTF scene or individual meshes. */
export function fitUprightModel(model: Object3D, dimensions?: string | null, url = ""): Group {
  const frame = new Group();
  frame.add(model);
  frame.updateWorldMatrix(true, true);
  const size = new Box3().setFromObject(frame).getSize(new Vector3());
  const expected = parseDimensionString(dimensions) ?? parseDimensionString(url.replace(/-/g, " "));
  const authoredUp = new Vector3();
  model.traverse(node => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const weight = mesh.geometry.getAttribute("position")?.count ?? 1;
    authoredUp.addScaledVector(Y_UP.clone().applyQuaternion(mesh.getWorldQuaternion(new Quaternion())), weight);
  });
  authoredUp.normalize();
  const verified = Object.entries(VERIFIED_UP).find(([id]) => url.includes(id))?.[1];
  // glTF is Y-up by contract. Only correct when declared dimensions contradict
  // the world frame; longest-axis guesses would tip wide sofas and low tables.
  if (verified) {
    frame.quaternion.setFromUnitVectors(new Vector3(...verified), Y_UP);
  } else if (expected && Math.min(size.x, size.y, size.z) > 0) {
    const score = (w: number, h: number, d: number) => Math.min(
      Math.abs(Math.log((w / h) / (expected.w / expected.h))) + Math.abs(Math.log((d / h) / (expected.d / expected.h))),
      Math.abs(Math.log((d / h) / (expected.w / expected.h))) + Math.abs(Math.log((w / h) / (expected.d / expected.h))),
    );
    const current = score(size.x, size.y, size.z);
    const zUp = score(size.x, size.z, size.y);
    const xUp = score(size.y, size.x, size.z);
    if (Math.min(zUp, xUp) + 0.025 < current) {
      const axis = zUp <= xUp ? new Vector3(0, 0, authoredUp.z < 0 ? -1 : 1) : new Vector3(authoredUp.x < 0 ? -1 : 1, 0, 0);
      frame.quaternion.setFromUnitVectors(axis, Y_UP);
    }
  }
  frame.updateWorldMatrix(true, true);
  const extent = new Box3().setFromObject(frame).getSize(new Vector3());
  frame.scale.setScalar(1.4 / (Math.max(extent.x, extent.y, extent.z) || 1));
  frame.updateWorldMatrix(true, true);
  const fitted = new Box3().setFromObject(frame);
  if (!fitted.isEmpty()) {
    const center = fitted.getCenter(new Vector3());
    frame.position.set(-center.x, -fitted.min.y, -center.z);
  }
  frame.updateWorldMatrix(true, true);
  const wrapper = new Group();
  wrapper.add(frame);
  return wrapper;
}
