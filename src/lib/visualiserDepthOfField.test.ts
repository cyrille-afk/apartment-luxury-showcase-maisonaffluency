import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { architecturalDofSettings, foregroundFurnitureFocus, photographicBokeh, photographicFocusDistance, selectedObjectFocus } from "./visualiserDepthOfField";
import { SHOWROOM } from "./showroomRendering";

describe("selected furniture depth of field", () => {
  it("uses the requested 35 degree architectural lens with slightly stronger grounding", () => {
    expect(SHOWROOM.cameraFov).toBe(35);
    expect(SHOWROOM.contactOpacity).toBe(0.72);
    expect(SHOWROOM.aoIntensity).toBe(1.28);
  });
  it("dollies back and keeps projected verticals upright through horizontal orbit and pan", () => {
    expect(SHOWROOM.cameraPosition[2]).toBeGreaterThan(16.4);
    expect(SHOWROOM.cameraPosition[1]).toBe(SHOWROOM.cameraTarget[1]);
    expect(SHOWROOM.cameraPolarAngle).toBe(Math.PI / 2);
    const camera = new THREE.PerspectiveCamera(SHOWROOM.cameraFov, 1.6, 0.1, 200);
    const target = new THREE.Vector3(...SHOWROOM.cameraTarget);
    for (const yaw of [0, 0.6, -0.9, Math.PI]) {
      for (const panY of [0, 2, -1]) {
        camera.position.set(Math.sin(yaw) * 20, target.y + panY, Math.cos(yaw) * 20);
        camera.lookAt(target.clone().add(new THREE.Vector3(0, panY, 0)));
        camera.updateMatrixWorld();
        const bottom = new THREE.Vector3(2, 0, -4).project(camera);
        const top = new THREE.Vector3(2, 7.6, -4).project(camera);
        expect(top.x).toBeCloseTo(bottom.x, 10);
        expect(top.y).toBeGreaterThan(bottom.y);
      }
    }
  });
  it("adopts subtle DoF once and retains later explicit OFF choices", () => {
    expect(architecturalDofSettings({ depthOfField: false, dofStrength: 3 })).toEqual({ depthOfField: true, dofStrength: 1 });
    expect(architecturalDofSettings({ dofRenderVersion: 1, depthOfField: false, dofStrength: 4 })).toEqual({ depthOfField: false, dofStrength: 4 });
  });
  it("keeps foreground side table and armchair in one sharp band, excluding distant chairs", () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1, 10);
    const objects = [
      { instanceId: "chair", product_name: "GUM armchair", z: 2 },
      { instanceId: "table", product_name: "Side Table", z: 0 },
      { instanceId: "far", product_name: "GUM armchair", z: -7 },
    ];
    for (const object of objects) {
      const piece = new THREE.Group();
      piece.userData.visualiserInstanceId = object.instanceId;
      piece.position.set(0, 1, object.z);
      piece.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
      scene.add(piece);
    }
    const target = new THREE.Vector3();
    expect(foregroundFurnitureFocus(scene, camera, objects, target)).toBeCloseTo(3.8);
    expect(photographicFocusDistance(camera, target)).toBeCloseTo(9);
    expect(foregroundFurnitureFocus(new THREE.Scene(), camera, objects, target)).toBeNull();
  });
  it("focuses the actual transformed bounding-box centre, not the floor position or gizmos", () => {
    const scene = new THREE.Scene();
    const piece = new THREE.Group();
    piece.userData.visualiserInstanceId = "chair";
    piece.position.set(3, 0, -2);
    piece.scale.setScalar(2);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2));
    body.position.y = 2;
    piece.add(body);
    scene.add(piece, new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100)));
    const focus = new THREE.Vector3();
    expect(selectedObjectFocus(scene, "chair", focus)).toBe(true);
    expect(focus.toArray()).toEqual([3, 4, -2]);
    piece.position.z = -7;
    expect(selectedObjectFocus(scene, "chair", focus)).toBe(true);
    expect(focus.toArray()).toEqual([3, 4, -7]);
  });
  it("uses a safe fallback for deselection and models that have not loaded", () => {
    const scene = new THREE.Scene();
    const focus = new THREE.Vector3(0, 0.5, 0);
    expect(selectedObjectFocus(scene, null, focus)).toBe(false);
    expect(selectedObjectFocus(scene, "missing", focus)).toBe(false);
    expect(focus.toArray()).toEqual([0, 0.5, 0]);
  });
  it("measures focus depth along the camera view axis", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.z = 10;
    expect(photographicFocusDistance(camera, new THREE.Vector3(5, 2, 0))).toBe(10);
  });
  it("disables aperture blur when off and keeps default bokeh subtle", () => {
    expect(photographicBokeh(false, 3)).toBe(0);
    expect(photographicBokeh(true, 3)).toBe(6);
    expect(photographicBokeh(true, 1)).toBe(2);
    expect(photographicBokeh(true, 1.1)).toBeCloseTo(2.2);
    expect(architecturalDofSettings({ dofRenderVersion: 1, dofStrength: 1.1 })).toEqual({ depthOfField: true, dofStrength: 1.1 });
  });
});