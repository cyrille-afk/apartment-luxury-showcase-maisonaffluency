import { Box3, Group, Mesh, Object3D, Quaternion, Vector3 } from "three";
import { parseDimensionString } from "./productDimensions";

const Y_UP = new Vector3(0, 1, 0);

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
  // glTF is Y-up by contract. Only correct when declared dimensions contradict
  // the world frame; longest-axis guesses would tip wide sofas and low tables.
  if (expected && Math.min(size.x, size.y, size.z) > 0) {
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
