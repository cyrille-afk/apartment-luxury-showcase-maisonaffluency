import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyCoffeeTableMarbleProjection, marbleBoxGeometry, marbleSlabTexture } from "./visualiserMarbleProjection";
import { applyPolishedMarble } from "./showroomRendering";

describe("marble slab box projection", () => {
  it("replaces tiled UV islands with one continuous non-repeating tabletop projection", () => {
    const source = new THREE.BoxGeometry(4, 0.2, 2, 4, 1, 4).toNonIndexed();
    const original = source.getAttribute("uv").array.slice();
    const geometry = marbleBoxGeometry(source);
    const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal"), uv = geometry.getAttribute("uv");
    for (let i = 0; i < p.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
      expect(uv.getX(i)).toBeLessThanOrEqual(1);
      if (n.getY(i) > 0.99) {
        expect(uv.getX(i)).toBeCloseTo(0.5 + p.getX(i) / 4);
        expect(uv.getY(i)).toBeCloseTo(0.5 + p.getZ(i) / 4);
      }
    }
    expect(source.getAttribute("uv").array).toEqual(original);
    expect(geometry.getAttribute("position").array).toEqual(source.getAttribute("position").array);
    expect(geometry.getAttribute("normal").array).toEqual(source.getAttribute("normal").array);
  });
  it("removes every repeat/offset/rotation without editing shared maps", () => {
    const source = new THREE.Texture();
    source.repeat.set(6, 6); source.offset.set(0.3, 0.2); source.rotation = 1;
    source.wrapS = source.wrapT = THREE.RepeatWrapping;
    const slab = marbleSlabTexture(source);
    expect(slab.repeat.toArray()).toEqual([1, 1]);
    expect(slab.offset.toArray()).toEqual([0, 0]);
    expect(slab.rotation).toBe(0);
    expect(slab.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(slab.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(source.repeat.toArray()).toEqual([6, 6]);
  });
  it("changes only the marble coffee tabletop, retaining polish and the base", () => {
    const root = new THREE.Group();
    const marble = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), roughnessMap: new THREE.Texture() });
    applyPolishedMarble(marble, "Nero Marquina Marble");
    const top = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 2), marble);
    top.userData.partRole = "top";
    const base = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: new THREE.Texture() }));
    base.userData.partRole = "base";
    root.add(top, base);
    const baseGeometry = base.geometry, baseMap = base.material.map, oldMap = marble.map;
    applyCoffeeTableMarbleProjection(root, "Praia da Granja Coffee Table");
    expect(top.geometry.userData.visualiserMarbleProjection).toBe("box");
    expect(marble.map).not.toBe(oldMap);
    expect(marble.roughnessMap?.repeat.toArray()).toEqual([1, 1]);
    expect(marble.roughness).toBe(0.15);
    expect(marble.metalness).toBe(0);
    expect(base.geometry).toBe(baseGeometry);
    expect(base.material.map).toBe(baseMap);
  });
  it("leaves non-coffee furniture unchanged", () => {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial();
    applyPolishedMarble(material, "Marble");
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    root.add(mesh);
    const source = mesh.geometry;
    applyCoffeeTableMarbleProjection(root, "Dining Table");
    expect(mesh.geometry).toBe(source);
  });
});