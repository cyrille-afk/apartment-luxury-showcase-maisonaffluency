import { describe, expect, it } from "vitest";
import { Matrix4, PerspectiveCamera, Raycaster, Plane, Vector2, Vector3 } from "three";
import { defaultPhotoCalibration, floorHomography, photoCameraProjection, photoFloorPoint, validPhotoCorners } from "./photoPerspective";
const bounds = { width: 12, depth: 8, height: 3 };
const calibration = { ...defaultPhotoCalibration(), locked: true };
describe("room-photo perspective", () => {
  it("maps all four measured floor corners to exact metre coordinates", () => {
    const expected = [[-6, -4], [6, -4], [6, 4], [-6, 4]];
    calibration.corners.forEach((point, i) => {
      const result = photoFloorPoint(point, calibration, bounds);
      expect(result?.[0]).toBeCloseTo(expected[i][0], 6);
      expect(result?.[1]).toBeCloseTo(expected[i][1], 6);
    });
  });
  it("uses a valid inverse camera so furniture drag rays hit the same floor", () => {
    const projection = photoCameraProjection(calibration, bounds);
    const camera = new PerspectiveCamera();
    camera.position.set(...projection.center);
    camera.updateMatrixWorld();
    camera.projectionMatrix.copy(new Matrix4().fromArray(projection.clip).transpose().multiply(camera.matrixWorld));
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const raycaster = new Raycaster();
    calibration.corners.forEach(point => {
      raycaster.setFromCamera(new Vector2(point[0] * 2 - 1, 1 - point[1] * 2), camera);
      const hit = raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), new Vector3());
      const expected = photoFloorPoint(point, calibration, bounds);
      expect(hit?.x).toBeCloseTo(expected?.[0] ?? Infinity, 5);
      expect(hit?.z).toBeCloseTo(expected?.[1] ?? Infinity, 5);
    });
  });
  it("renders the same metric furniture smaller toward the rear floor", () => {
    const h = floorHomography(calibration.corners, bounds);
    const widthAt = (z: number) => {
      const project = (x: number) => (h.get(0, 0) * x + h.get(0, 1) * z + h.get(0, 2)) / (h.get(2, 0) * x + h.get(2, 1) * z + 1);
      return Math.abs(project(0.5) - project(-0.5));
    };
    expect(widthAt(3)).toBeGreaterThan(widthAt(-3));
  });
  it("rejects crossed, collapsed and non-finite corners and outside-floor drops", () => {
    expect(validPhotoCorners([[0, 0], [1, 1], [1, 0], [0, 1]])).toBe(false);
    expect(validPhotoCorners([[0, 0], [0, 0], [0, 0], [0, 0]])).toBe(false);
    expect(validPhotoCorners([[NaN, 0], [1, 0], [1, 1], [0, 1]])).toBe(false);
    expect(photoFloorPoint([0.5, 0.1], calibration, bounds)).toBeNull();
  });
});