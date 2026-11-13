import { describe, expect, it } from "vitest";
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { applyModelOrientation, fitUprightModel, rotateModelOrientation, modelOrientationFromDegrees, modelOrientationToDegrees, MODEL_UP_AXIS_PRESETS } from "./modelOrientation";

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
  it("stands the Frenchmen Side Chair upright despite two nested -90° CAD rotations", () => {
    const source = new Group(), root = new Group();
    source.add(root); root.rotation.x = -Math.PI / 2;
    const body = new Mesh(new BoxGeometry(0.533, 0.792, 0.59), new MeshBasicMaterial());
    body.position.z = 0.396; body.rotation.x = -Math.PI / 2;
    const glides = new Mesh(new BoxGeometry(0.42, 0.003, 0.49), new MeshBasicMaterial());
    glides.rotation.x = -Math.PI / 2; glides.name = "Glides";
    root.add(body, glides);
    const fitted = fitUprightModel(source);
    const bodyBox = new Box3().setFromObject(body), feet = new Box3().setFromObject(glides);
    expect(bodyBox.getCenter(new Vector3()).y).toBeGreaterThan(feet.getCenter(new Vector3()).y);
    expect(bounds(fitted).min.y).toBeCloseTo(0);
  });
  it("uses -PI/2 for positive Z-up geometry despite misleading CAD node rotations", () => {
    const source = new Group();
    const body = new Mesh(new BoxGeometry(620, 800, 590), new MeshBasicMaterial());
    body.geometry.rotateX(Math.PI);
    body.position.y = -400;
    source.add(body);
    source.rotation.x = -Math.PI / 2;
    const fitted = fitUprightModel(source, null, "cad-chair.glb", { w: 620, d: 590, h: 800 });
    const up = new Vector3(0, -1, 0).transformDirection(body.matrixWorld);
    expect(up.y).toBeCloseTo(1);
    expect(bounds(fitted).min.y).toBeCloseTo(0);
    expect(fitted.children[0].rotation.x).toBeCloseTo(-Math.PI / 2);
  });
  it("corrects a positive Z-up chair with 800mm height and 590mm depth", () => {
    const source = piece(620, 800, 590);
    source.rotation.x = Math.PI / 2;
    const fitted = bounds(fitUprightModel(source, null, "chair.glb", { w: 620, d: 590, h: 800 }));
    expect(fitted.getSize(new Vector3()).y).toBeCloseTo(0.8);
    expect(fitted.getSize(new Vector3()).z).toBeCloseTo(0.59);
    expect(fitted.min.y).toBeCloseTo(0);
    expect(source.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeCloseTo(0);
  });
  it.each([0, Math.PI / 2])("uses floor glides rather than misleading chair proportions at rotation %s", rotation => {
    const source = piece(800, 697, 739);
    const glides = new Mesh(new BoxGeometry(780, 5, 590), new MeshBasicMaterial());
    glides.name = "Glides";
    source.add(glides);
    source.rotation.x = rotation;
    const fitted = bounds(fitUprightModel(source, "620 × 590 × 800 mm"));
    expect(source.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeCloseTo(0);
    expect(fitted.min.y).toBeCloseTo(0);
  });
  it("round trips precise decimal degree corrections", () => {
    const degrees: [number, number, number] = [12.5, -23.75, 46.125];
    modelOrientationToDegrees(modelOrientationFromDegrees(degrees)).forEach((value, index) => expect(value).toBeCloseTo(degrees[index], 4));
  });
  it.each([
    ["y-up", [0, 1, 0]], ["z-up", [0, 0, 1]], ["x-up", [1, 0, 0]],
    ["negative-z-up", [0, 0, -1]], ["negative-x-up", [-1, 0, 0]], ["upside-down", [0, -1, 0]],
  ] as const)("maps %s to positive Y", (id, axis) => {
    const preset = MODEL_UP_AXIS_PRESETS.find(item => item.id === id);
    if (!preset) throw new Error(`Missing preset ${id}`);
    const result = new Vector3(...axis).applyQuaternion(new Quaternion(...modelOrientationFromDegrees(preset.degrees)));
    expect(result.distanceTo(new Vector3(0, 1, 0))).toBeCloseTo(0);
  });
  it("keeps arbitrary degree corrections on the floor without changing fitted scale", () => {
    const fitted = fitUprightModel(piece(3, 1, 2));
    const scale = fitted.children[0].scale.clone();
    const corrected = applyModelOrientation(fitted, modelOrientationFromDegrees([12.5, -23.75, 46.125]));
    expect(bounds(corrected).min.y).toBeCloseTo(0);
    expect(fitted.children[0].scale.equals(scale)).toBe(true);
  });
  it("does not emit non-finite orientation values", () => {
    expect(modelOrientationFromDegrees([NaN, 0, 0])).toEqual([0, 0, 0, 1]);
  });
  it.each(["X", "Y", "Z"] as const)("rotates %s by 90 degrees and returns after four turns", axis => {
    const first = rotateModelOrientation(undefined, axis, 1);
    expect(new Quaternion(...first).angleTo(new Quaternion())).toBeCloseTo(Math.PI / 2);
    let current = first;
    for (let i = 0; i < 3; i++) current = rotateModelOrientation(current, axis, 1);
    expect(new Quaternion(...current).angleTo(new Quaternion())).toBeCloseTo(0);
    expect(new Quaternion(...rotateModelOrientation(first, axis, -1)).angleTo(new Quaternion())).toBeCloseTo(0);
  });
  it("keeps corrected models on the floor and reset restores fitted dimensions", () => {
    const fitted = fitUprightModel(piece(3, 1, 2));
    const original = bounds(fitted).getSize(new Vector3());
    const rotated = bounds(applyModelOrientation(fitted, rotateModelOrientation(undefined, "X", 1)));
    expect(rotated.min.y).toBeCloseTo(0);
    expect(rotated.getSize(new Vector3()).y).toBeCloseTo(original.z);
    const reset = bounds(applyModelOrientation(fitUprightModel(piece(3, 1, 2))));
    expect(reset.min.y).toBeCloseTo(0);
    expect(reset.getSize(new Vector3()).distanceTo(original)).toBeCloseTo(0);
  });
  it("corrects a negative-Z vertical axis to Y with its feet down", () => {
    const source = piece(900, 750, 770);
    source.rotation.x = -Math.PI / 2;
    const fitted = bounds(fitUprightModel(source, "W 90 x D 77 x H 75 cm"));
    const size = fitted.getSize(new Vector3());
    expect(size.y).toBeCloseTo(0.75);
    expect(size.z).toBeCloseTo(0.77);
    expect(fitted.min.y).toBeCloseTo(0);
    expect(source.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeCloseTo(0);
  });
  it("uses the verified GUM positive-Z up direction rather than its inverted local Y", () => {
    const source = piece(900, 750, 770);
    source.rotation.x = Math.PI / 2;
    const fitted = bounds(fitUprightModel(source, "W 90 x D 77 x H 75 cm", "/glb-models/f72b4185-9eeb-4ec0-b862-0972abc93a9f/default.glb"));
    expect(source.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())).toBeCloseTo(0);
    expect(fitted.min.y).toBeCloseTo(0);
    expect(fitted.getSize(new Vector3()).y).toBeCloseTo(0.75);
  });
  it("leaves a correctly exported wide low table upright", () => {
    const fitted = bounds(fitUprightModel(piece(1280, 340, 830), "W 128 x D 83 x H 34 cm"));
    expect(fitted.getSize(new Vector3()).y).toBeCloseTo(0.34);
    expect(fitted.min.y).toBeCloseTo(0);
  });
  it("corrects X-up while preserving authored offsets and scale", () => {
    const source = piece(620, 800, 590);
    source.rotation.z = -Math.PI / 2;
    source.position.set(40, -50, 20);
    source.scale.setScalar(1000);
    const fitted = bounds(fitUprightModel(source, "W 62 × D 59 × H 80 cm"));
    expect(fitted.getSize(new Vector3()).y).toBeCloseTo(0.8);
    expect(fitted.min.y).toBeCloseTo(0);
    expect(fitted.getCenter(new Vector3()).x).toBeCloseTo(0);
    expect(source.scale.x).toBe(1000);
  });
  it("uses dimension-bearing asset names when dimensions are absent", () => {
    const source = piece(1280, 340, 830);
    source.rotation.x = -Math.PI / 2;
    expect(bounds(fitUprightModel(source, null, "https://example.invalid/rectangle---w-128-x-d-83-x-h-34-cm-1.glb")).getSize(new Vector3()).y).toBeCloseTo(0.34);
  });
  it("does not guess an axis for dimensionless compliant models", () => {
    expect(bounds(fitUprightModel(piece(3, 1, 2))).getSize(new Vector3()).y).toBeCloseTo(1 / 3);
  });
  it.each([1, 100, 1000])("normalizes an armchair authored at %s units per metre", units => {
    const source = piece(0.82 * units, 0.78 * units, 1.0 * units);
    source.position.set(25 * units, -3 * units, -8 * units);
    const fitted = bounds(fitUprightModel(source, "W 82 × D 100 × H 78 cm"));
    const size = fitted.getSize(new Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(1.0);
    expect(size.y).toBeCloseTo(0.78);
    expect(fitted.min.y).toBeCloseTo(0);
  });
  it("prefers structured product dimensions over stale display text", () => {
    const fitted = bounds(fitUprightModel(piece(820, 780, 900), "W 400 × D 400 × H 400 cm", "", { w: 820, d: 900, h: 780 }));
    expect(Math.max(...fitted.getSize(new Vector3()).toArray())).toBeCloseTo(0.9);
    expect(fitted.min.y).toBeCloseTo(0);
  });
});

describe("verified low-table import frames", () => {
  it("lays the DUP coffee table flat (Z-up export, no recorded dimensions)", async () => {
    const { Group: G, Mesh: M, BoxGeometry: B, MeshBasicMaterial: Mat, Box3: Bx, Vector3: V } = await import("three");
    const { fitUprightModel: fit } = await import("./modelOrientation");
    const s = new G(); s.add(new M(new B(0.64, 1.0, 0.18), new Mat()));
    const size = new Bx().setFromObject(fit(s, null, "https://x/glb-models/8960e070-49f0-46dd-a137-2209717b7dc0/default.glb")).getSize(new V());
    expect(size.y).toBeLessThan(size.x);
    expect(size.y).toBeLessThan(size.z);
  });
});
