import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { stripEmbeddedGroundPlanes } from "./visualiserEmbeddedGround";
import { GROUND_LAYERS, KEY_SHADOW } from "./visualiserGroundLayers";

describe("embedded asset grounds", () => {
  it.each([false, true])("removes oversized ground before normalization (Z-up %s)", zUp => {
    const root = new THREE.Group();
    const furniture = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1));
    furniture.position.y = 0.5;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5, 5));
    ground.rotation.x = -Math.PI / 2;
    root.add(furniture, ground);
    if (zUp) root.rotation.x = Math.PI / 2;
    expect(stripEmbeddedGroundPlanes(root)).toEqual([ground]);
    expect(ground.visible).toBe(false);
    expect(ground.parent).toBe(null);
    expect(root.children).toEqual([furniture]);
    expect(new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).x).toBeCloseTo(2);
  });
  it("keeps real thin tops and platforms within the furniture footprint", () => {
    const root = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1));
    body.position.y = 0.5;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2, 0.001, 1));
    top.position.y = 1;
    root.add(body, top);
    expect(stripEmbeddedGroundPlanes(root)).toEqual([]);
    expect(top.parent).toBe(root);
  });
  it("preserves cached originals when stripping an instance", () => {
    const root = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1));
    body.position.y = 0.5;
    const ground = new THREE.Mesh(new THREE.BoxGeometry(5, 0.001, 5));
    root.add(body, ground);
    expect(stripEmbeddedGroundPlanes(root.clone(true))).toHaveLength(1);
    expect(ground.visible).toBe(true);
    expect(root.children).toHaveLength(2);
  });
  it("keeps floor at zero and overlays above it with the requested key map size", () => {
    expect(GROUND_LAYERS.floor).toBe(0);
    expect(GROUND_LAYERS.contact).toBe(0.002);
    expect(GROUND_LAYERS.grid).toBe(0.003);
    expect(GROUND_LAYERS.catcher).toBe(0.003);
    expect(KEY_SHADOW.mapSize).toBe(2048);
  });
});
