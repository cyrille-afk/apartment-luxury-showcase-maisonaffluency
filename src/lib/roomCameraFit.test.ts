import { describe, expect, it } from "vitest";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { fitRoomCamera } from "./roomCameraFit";

describe("room overview framing", () => {
  it("frames an individual perimeter lamp tightly instead of fitting the whole room", () => {
    const lamp = new Box3(new Vector3(-3.3, 0, -4.2), new Vector3(-2.7, 1.4, -3.6));
    const room = new Box3(new Vector3(-3.3, 0, -4.2), new Vector3(3, 3.4, 4));
    const close = fitRoomCamera(lamp, 1);
    const overview = fitRoomCamera(room, 1);
    expect(close.target.toArray()).toEqual([-3, 0.7, -3.9000000000000004]);
    expect(close.position.distanceTo(close.target)).toBeLessThan(overview.position.distanceTo(overview.target) / 3);
  });
  it("keeps every corner visible through landscape, portrait and narrow-window resizes", () => {
    const bounds = new Box3(new Vector3(-3.3, 0, -4.2), new Vector3(3, 3.4, 4));
    const camera = new PerspectiveCamera(45, 1, 0.05, 200);
    for (const [width, height] of [[1280, 720], [390, 844], [844, 390], [300, 1258], [1280, 720]]) {
      const fit = fitRoomCamera(bounds, width / height, camera.fov);
      camera.aspect = width / height;
      camera.position.copy(fit.position);
      camera.far = fit.far;
      camera.lookAt(fit.target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new Vector3(x, y, z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(1 / 1.18 + 1e-8);
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(1 / 1.18 + 1e-8);
        expect(projected.z).toBeGreaterThan(-1);
        expect(projected.z).toBeLessThan(1);
      }
    }
  });
  for (const aspect of [0.45, 0.85, 1.6, 2.5]) {
    it(`fits the entire room and perimeter floor lamp at aspect ${aspect}`, () => {
      const bounds = new Box3(new Vector3(-3, 0, -4), new Vector3(3, 3, 4));
      bounds.union(new Box3(new Vector3(-3.3, 0, -4.2), new Vector3(-2.7, 3.4, -3.6)));
      const fit = fitRoomCamera(bounds, aspect);
      const camera = new PerspectiveCamera(45, aspect, 0.05, fit.far);
      camera.position.copy(fit.position);
      camera.lookAt(fit.target);
      camera.updateMatrixWorld();
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new Vector3(x, y, z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(1 / 1.18 + 1e-8);
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(1 / 1.18 + 1e-8);
        expect(projected.z).toBeGreaterThan(-1);
        expect(projected.z).toBeLessThan(1);
      }
    });
  }
});