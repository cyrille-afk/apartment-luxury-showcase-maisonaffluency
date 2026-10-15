import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { photographicBokeh, photographicFocusDistance, selectedObjectFocus } from "./visualiserDepthOfField";

describe("selected furniture depth of field", () => {
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
  });
});