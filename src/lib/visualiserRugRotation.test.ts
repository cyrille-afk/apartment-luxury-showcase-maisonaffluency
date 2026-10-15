import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { clampRugRotation, rugYaw } from "./visualiserRugRotation";
import { roundedRugGeometry, RUG_TOP_Y } from "./visualiserRug";

describe("rug rotation", () => {
  it("rotates around the floor normal without lifting, resizing or translating the centre", () => {
    const parent = new THREE.Group();
    parent.position.set(2, RUG_TOP_Y, -1);
    parent.rotation.y = rugYaw(90);
    const rug = new THREE.Mesh(roundedRugGeometry(4.5, 3.8));
    rug.rotation.x = -Math.PI / 2;
    parent.add(rug);
    parent.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(rug);
    expect(bounds.getSize(new THREE.Vector3()).x).toBeCloseTo(3.8);
    expect(bounds.getSize(new THREE.Vector3()).z).toBeCloseTo(4.5);
    expect(bounds.min.y).toBeCloseTo(RUG_TOP_Y);
    expect(bounds.max.y).toBeCloseTo(RUG_TOP_Y);
    expect(bounds.getCenter(new THREE.Vector3()).toArray()).toEqual([2, RUG_TOP_Y, -1]);
  });
  it("keeps old scenes at zero and clamps invalid saved angles", () => {
    expect(clampRugRotation()).toBe(0);
    expect(clampRugRotation(NaN)).toBe(0);
    expect(clampRugRotation(-1)).toBe(0);
    expect(clampRugRotation(400)).toBe(360);
    expect(rugYaw(45)).toBe(Math.PI / 4);
  });
});