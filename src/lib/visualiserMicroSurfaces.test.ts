import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addWoodRoughness, deepenArmchairWeave, isWoodSurface, woodRoughnessPixels } from "./visualiserMicroSurfaces";

describe("furniture micro-surfaces", () => {
  it("deepens armchair normals without changing colour, maps or geometry", () => {
    const m = new THREE.MeshStandardMaterial({ normalMap: new THREE.Texture() });
    m.normalScale.set(0.85, -0.85);
    const normal = m.normalMap;
    deepenArmchairWeave(m, "GUM Armchair", true);
    expect(m.normalScale.x).toBeCloseTo(1.275);
    expect(m.normalScale.y).toBeCloseTo(-1.275);
    expect(m.normalMap).toBe(normal);
  });
  it("does not deepen non-fabric or non-chair surfaces", () => {
    for (const [name, textile] of [["Coffee Table", true], ["GUM Armchair", false]] as const) {
      const m = new THREE.MeshStandardMaterial({ normalMap: new THREE.Texture() });
      deepenArmchairWeave(m, name, textile);
      expect(m.normalScale.x).toBe(1);
    }
  });
  it("provides lightweight woven normals for colour-only armchair upholstery", () => {
    const m = new THREE.MeshStandardMaterial();
    deepenArmchairWeave(m, "Frenchmen Street Armchair", true);
    expect(m.normalMap).toBeInstanceOf(THREE.DataTexture);
    expect(m.normalMap?.userData.visualiserOwnedWeave).toBe(true);
    expect(m.normalMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(m.normalScale.toArray()).toEqual([1.5, 1.5]);
  });
  it("adds subtle linear roughness aligned to wood colour UVs", () => {
    const m = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), roughness: 0.5 });
    m.map?.repeat.set(2, 3);
    addWoodRoughness(m, "WoodFinish Walnut");
    expect(m.roughnessMap).toBeInstanceOf(THREE.DataTexture);
    expect(m.roughnessMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(m.roughnessMap?.repeat.toArray()).toEqual([2, 3]);
    expect(m.roughness).toBe(0.5);
    const values = [...woodRoughnessPixels()].filter((_, i) => i % 4 === 1);
    expect(new Set(values).size).toBeGreaterThan(10);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(234);
    expect(Math.max(...values)).toBeLessThanOrEqual(255);
  });
  it("preserves supplied roughness and excludes stone, metal and lacquer", () => {
    const supplied = new THREE.Texture();
    const m = new THREE.MeshStandardMaterial({ roughnessMap: supplied });
    addWoodRoughness(m, "Natural Oak");
    expect(m.roughnessMap).toBe(supplied);
    for (const name of ["Marble", "Brass", "Oak lacquer", "Upholstery"]) expect(isWoodSurface(name)).toBe(false);
  });
});