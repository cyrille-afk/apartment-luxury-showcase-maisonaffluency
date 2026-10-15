import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyMarbleSurface, physicalCoffeeTableMarble } from "./visualiserMarbleSurface";
import { clampMarbleSurface } from "./visualiserMarbleSettings";

describe("coffee table marble controls", () => {
  it("changes physical reflectivity and roughness without changing maps, geometry or placement", () => {
    const source = new THREE.MeshStandardMaterial({ roughness: 0.15, map: new THREE.Texture(), roughnessMap: new THREE.Texture() });
    source.userData.visualiserPolishedMarble = true;
    source.userData.visualiserClone = true;
    const material = physicalCoffeeTableMarble(source, "Praia da Granja Coffee Table", "top");
    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    mesh.userData.partRole = "top";
    mesh.position.set(2, 0, 3);
    const geometry = mesh.geometry;
    applyMarbleSurface(mesh, "Praia da Granja Coffee Table", { reflectivity: 0.8, roughness: 0.35 });
    if (!(material instanceof THREE.MeshPhysicalMaterial)) throw new Error("Not physical");
    expect(material.reflectivity).toBeCloseTo(0.8);
    expect(material.roughness).toBe(0.35);
    expect(material.metalness).toBe(0);
    expect(material.ior).toBeCloseTo(1.32 / 0.68);
    expect(material.map).toBe(source.map);
    expect(material.roughnessMap).toBe(source.roughnessMap);
    expect(material.userData.visualiserClone).toBe(true);
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.position.toArray()).toEqual([2, 0, 3]);
    applyMarbleSurface(mesh, "Praia da Granja Coffee Table");
    expect(material.reflectivity).toBeCloseTo(0.5);
    expect(material.roughness).toBe(0.15);
  });

  it("never alters bases, non-marble finishes or other furniture", () => {
    for (const [name, role, marble] of [["Coffee Table", "base", true], ["Coffee Table", "top", false], ["Dining Table", "top", true]] as const) {
      const material = new THREE.MeshPhysicalMaterial({ roughness: 0.6 });
      material.userData.visualiserPolishedMarble = marble;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
      mesh.userData.partRole = role;
      expect(physicalCoffeeTableMarble(material, name, role)).toBe(material);
      applyMarbleSurface(mesh, name, { roughness: 0, reflectivity: 1 });
      expect(material.roughness).toBe(0.6);
      expect(material.reflectivity).toBeCloseTo(0.5);
    }
  });

  it("validates legacy and invalid saved values", () => {
    expect(clampMarbleSurface()).toEqual({ roughness: 0.15, reflectivity: 0.5 });
    expect(clampMarbleSurface({ roughness: -2, reflectivity: 3 })).toEqual({ roughness: 0, reflectivity: 1 });
    expect(clampMarbleSurface({ roughness: NaN, reflectivity: Infinity })).toEqual({ roughness: 0.15, reflectivity: 0.5 });
  });
});