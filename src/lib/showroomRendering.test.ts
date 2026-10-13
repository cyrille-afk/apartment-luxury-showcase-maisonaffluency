import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SHOWROOM, textileNormalPixels, toPbrMaterial } from "./showroomRendering";

describe("showroom rendering", () => {
  it("keeps exposure within 1.0–1.2 and ambient at 0.15", () => {
    expect(SHOWROOM.exposure).toBeGreaterThanOrEqual(1);
    expect(SHOWROOM.exposure).toBeLessThanOrEqual(1.2);
    expect(SHOWROOM.ambient).toBe(0.15);
  });
  it("upgrades unlit assets without losing their colour map or transparency", () => {
    const map = new THREE.Texture();
    const source = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.4 });
    const material = toPbrMaterial(source);
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.map).toBe(map);
    expect(material.opacity).toBe(0.4);
    expect(material.transparent).toBe(true);
  });
  it("preserves authored PBR normal and roughness maps", () => {
    const source = new THREE.MeshPhysicalMaterial({ normalMap: new THREE.Texture(), roughnessMap: new THREE.Texture(), roughness: 0.83 });
    const material = toPbrMaterial(source);
    expect(material.normalMap).toBe(source.normalMap);
    expect(material.roughnessMap).toBe(source.roughnessMap);
    expect(material.roughness).toBe(0.83);
  });
  it("creates directional textile normals rather than flat colour", () => {
    const pixels = new Uint8ClampedArray([0,0,0,255, 128,128,128,255, 255,255,255,255]);
    const normals = textileNormalPixels(pixels, 3, 1);
    expect(normals[4]).not.toBe(128);
    expect(normals[6]).toBeGreaterThan(128);
    expect(normals[7]).toBe(255);
  });
});