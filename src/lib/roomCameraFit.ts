import { Box3, MathUtils, Vector3 } from "three";

/** Fit every world-space corner against both canvas FOV axes. */
export function fitRoomCamera(bounds: Box3, aspect: number, fov = 45) {
  const target = bounds.getCenter(new Vector3());
  const direction = new Vector3(0.7, 0.9, 1).normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const tanV = Math.tan(MathUtils.degToRad(fov / 2)) / 1.18;
  const tanH = tanV * Math.max(aspect, 0.01);
  let distance = 1;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const relative = new Vector3(x, y, z).sub(target);
        const depth = relative.dot(direction);
        distance = Math.max(distance, depth + Math.abs(relative.dot(right)) / tanH,
          depth + Math.abs(relative.dot(up)) / tanV);
      }
    }
  }
  return { target, position: target.clone().addScaledVector(direction, distance),
    far: Math.max(200, distance + bounds.getSize(new Vector3()).length() * 2) };
}