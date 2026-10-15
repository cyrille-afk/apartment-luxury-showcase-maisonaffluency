import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyCoffeeTableMarbleProjection, isStoneSlabFinish, marblePlanarGeometry, marbleSlabTexture } from "./visualiserMarbleProjection";
import { applyPolishedMarble } from "./showroomRendering";

describe("marble slab Y-axis planar projection", () => {
  it("replaces tiled UV islands with one continuous non-repeating tabletop projection", () => {
    const source = new THREE.BoxGeometry(4, 0.2, 2, 4, 1, 4).toNonIndexed();
    const original = source.getAttribute("uv").array.slice();
    const geometry = marblePlanarGeometry(source);
    const p = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
    for (let i = 0; i < p.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
      expect(uv.getX(i)).toBeLessThanOrEqual(1);
      expect(uv.getX(i)).toBeCloseTo(0.5 + p.getX(i) / 4);
      expect(uv.getY(i)).toBeCloseTo(0.5 + p.getZ(i) / 2);
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
    expect(top.geometry.userData.visualiserMarbleProjection).toBe("planar-y");
    expect(marble.map).not.toBe(oldMap);
    expect(marble.roughnessMap?.repeat.toArray()).toEqual([1, 1]);
    expect(marble.roughness).toBe(0.15);
    expect(marble.metalness).toBe(0);
    expect(base.geometry).toBe(baseGeometry);
    expect(base.material.map).toBe(baseMap);
  });
  it("maps mirrored mesh quadrants into one shared 0–1 slab without restarting at the centre", () => {
    const root = new THREE.Group();
    root.position.set(9, 0, -4);
    root.rotation.y = 0.7;
    const meshes: THREE.Mesh[] = [];
    for (const x of [-1, 1]) for (const z of [-0.5, 0.5]) {
      const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
      applyPolishedMarble(material, "Marble");
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 1), material);
      mesh.position.set(x, 1, z);
      mesh.scale.x = x < 0 ? -1 : 1;
      mesh.scale.z = z < 0 ? -1 : 1;
      mesh.userData.partRole = "top";
      root.add(mesh);
      meshes.push(mesh);
    }
    applyCoffeeTableMarbleProjection(root, "Oval Coffee Table");
    const inverse = root.matrixWorld.clone().invert();
    const point = new THREE.Vector3();
    for (const mesh of meshes) {
      const transform = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
      const p = mesh.geometry.getAttribute("position"), uv = mesh.geometry.getAttribute("uv");
      for (let i = 0; i < p.count; i++) {
        point.fromBufferAttribute(p, i).applyMatrix4(transform);
        expect(uv.getX(i)).toBeCloseTo((point.x + 2) / 4);
        expect(uv.getY(i)).toBeCloseTo((point.z + 1) / 2);
      }
    }
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
  it("projects Pall Stone without changing its authored roughness or polishing other finishes", () => {
    expect(isStoneSlabFinish("Pall Stone")).toBe(true);
    expect(isStoneSlabFinish("Natural Walnut")).toBe(false);
    const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), roughness: 1 });
    material.map?.repeat.set(2, 2);
    material.userData.visualiserStoneSlab = isStoneSlabFinish("Pall Stone");
    const top = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 2), material);
    top.userData.partRole = "top";
    const root = new THREE.Group(); root.add(top);
    applyCoffeeTableMarbleProjection(root, "Praia da Granja Coffee Table");
    expect(top.geometry.userData.visualiserMarbleProjection).toBe("planar-y");
    expect(material.map?.repeat.toArray()).toEqual([1, 1]);
    expect(material.map?.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(material.roughness).toBe(1);
  });
});