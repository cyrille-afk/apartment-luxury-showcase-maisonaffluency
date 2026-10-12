import { describe, expect, it } from "vitest";
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { fitUprightModel } from "./modelOrientation";

function piece(w: number, h: number, d: number) {
  const mesh = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial());
  mesh.position.y = h / 2;
  const scene = new Group();
  scene.add(mesh);
  return scene;
}
function bounds(model: Group) {
  model.updateWorldMatrix(true, true);
  return new Box3().setFromObject(model);
}
describe("model import frame", () => {
  it("corrects a negative-Z vertical axis to Y with its feet down", () => {
    const source = piece(900, 750, 770);
    source.rotation.x = -Math.PI / 2;
    const fitted = bounds(fitUprightModel(source, "W 90 x D 77 x H 75 cm"));
    const size = fitted.getSize(new Vector3());
    expect(size.y).toBeCloseTo(1.4 * 750 / 900);
    expect(size.z).toBeCloseTo(1.4 * 770 / 900);
    expect(fitted.min.y).toBeCloseTo(0);
    expect(source.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeCloseTo(0);
  });
  it("uses the verified GUM positive-Z up direction rather than its inverted local Y", () => {
    const source = piece(900, 750, 770);
    source.rotation.x = Math.PI / 2;
    const fitted = bounds(fitUprightModel(source, "W 90 x D 77 x H 75 cm", "/glb-models/f72b4185-9eeb-4ec0-b862-0972abc93a9f/default.glb"));
    expect(source.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeCloseTo(0);
    expect(fitted.min.y).toBeCloseTo(0);
    expect(fitted.getSize(new Vector3()).y).toBeCloseTo(1.4 * 750 / 900);
  });
  it("leaves a correctly exported wide low table upright", () => {
    const fitted = bounds(fitUprightModel(piece(1280, 340, 830), "W 128 x D 83 x H 34 cm"));
    expect(fitted.getSize(new Vector3()).y).toBeCloseTo(1.4 * 340 / 1280);
    expect(fitted.min.y).toBeCloseTo(0);
  });
  it("corrects X-up while preserving authored offsets and scale", () => {
    const source = piece(620, 800, 590);
    source.rotation.z = -Math.PI / 2;
    source.position.set(40, -50, 20);
    source.scale.setScalar(1000);
    const fitted = bounds(fitUprightModel(source, "W 62 × D 59 × H 80 cm"));
    expect(fitted.getSize(new Vector3()).y).toBeCloseTo(1.4);
    expect(fitted.min.y).toBeCloseTo(0);
    expect(fitted.getCenter(new Vector3()).x).toBeCloseTo(0);
    expect(source.scale.x).toBe(1000);
  });
  it("uses dimension-bearing asset names when dimensions are absent", () => {
    const source = piece(1280, 340, 830);
    source.rotation.x = -Math.PI / 2;
    expect(bounds(fitUprightModel(source, null, "https://example.invalid/rectangle---w-128-x-d-83-x-h-34-cm-1.glb")).getSize(new Vector3()).y).toBeCloseTo(1.4 * 340 / 1280);
  });
  it("does not guess an axis for dimensionless compliant models", () => {
    expect(bounds(fitUprightModel(piece(3, 1, 2))).getSize(new Vector3()).y).toBeCloseTo(1.4 / 3);
  });
});
