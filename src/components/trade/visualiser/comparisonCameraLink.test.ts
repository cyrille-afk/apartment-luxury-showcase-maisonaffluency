import { describe, expect, it, vi } from "vitest";
import { PerspectiveCamera } from "three";
import { OrbitControls } from "three-stdlib";
import { bindComparisonCamera, type ComparisonCameraState } from "./comparisonCameraLink";

function room() {
  const camera = new PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 2, 6);
  const controls = new OrbitControls(camera, document.createElement("canvas"));
  controls.update();
  return { camera, controls, invalidate: vi.fn() };
}
function expectSame(a: ReturnType<typeof room>, b: ReturnType<typeof room>) {
  expect(a.camera.position.distanceTo(b.camera.position)).toBeLessThan(1e-9);
  expect(a.controls.target.distanceTo(b.controls.target)).toBeLessThan(1e-9);
  expect(a.camera.quaternion.angleTo(b.camera.quaternion)).toBeLessThan(1e-7);
  expect(a.camera.fov).toBe(b.camera.fov);
  expect(a.camera.zoom).toBe(b.camera.zoom);
}
describe("finish preview cameras", () => {
  it("synchronizes orbit, pan and zoom immediately from either side without echo", () => {
    const shared = { current: null as ComparisonCameraState | null };
    const a = room(), b = room();
    const stopA = bindComparisonCamera({ id: "A", shared }, a.camera, a.controls, a.invalidate);
    const stopB = bindComparisonCamera({ id: "B", shared }, b.camera, b.controls, b.invalidate);
    for (const [source, follower] of [[a, b], [b, a]]) {
      const previous = shared.current?.version ?? 0;
      source.camera.position.set(3, 2, 4);
      source.controls.target.set(0.8, 1, -0.5);
      source.camera.fov = 35;
      source.camera.zoom = 1.5;
      source.controls.update();
      expectSame(source, follower);
      expect(shared.current?.version).toBe(previous + 1);
      expect(follower.invalidate).toHaveBeenCalled();
      source.camera.position.set(-2, 3, 8);
      source.controls.update();
      expectSame(source, follower);
    }
    stopA(); stopB(); a.controls.dispose(); b.controls.dispose();
  });
  it("a late or retried preview adopts the current camera without overwriting it", () => {
    const shared = { current: null as ComparisonCameraState | null };
    const a = room(), b = room();
    const stopA = bindComparisonCamera({ id: "A", shared }, a.camera, a.controls, a.invalidate);
    a.camera.position.set(-4, 2, 5);
    a.controls.update();
    const version = shared.current?.version;
    const stopB = bindComparisonCamera({ id: "B", shared }, b.camera, b.controls, b.invalidate);
    expectSame(a, b);
    expect(shared.current?.version).toBe(version);
    stopB();
    b.invalidate.mockClear();
    a.camera.position.set(1, 2, 4); a.controls.update();
    expect(b.invalidate).not.toHaveBeenCalled();
    const retry = bindComparisonCamera({ id: "B", shared }, b.camera, b.controls, b.invalidate);
    expectSame(a, b);
    stopA(); retry(); a.controls.dispose(); b.controls.dispose();
  });
});