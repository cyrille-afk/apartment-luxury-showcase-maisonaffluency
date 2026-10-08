import { describe, expect, it } from "vitest";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { fitRoomCamera } from "./roomCameraFit";

describe("room overview framing", () => {
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