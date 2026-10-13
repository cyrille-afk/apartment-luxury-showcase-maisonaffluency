import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SHOWROOM, textileNormalPixels, toPbrMaterial, withFallbackTextureCoordinates } from "./showroomRendering";

describe("showroom rendering", () => {
  it("repairs missing UVs without modifying the cached geometry", () => {
    const source = new THREE.BoxGeometry(1, 2, 1);
    source.deleteAttribute("uv");
    const repaired = withFallbackTextureCoordinates(source);
    expect(source.getAttribute("uv")).toBeUndefined();
    const uv = repaired.getAttribute("uv");
    expect(uv.count).toBe(repaired.getAttribute("position").count);
    expect(new Set(uv.array).size).toBeGreaterThan(1);
    expect([...uv.array].every(Number.isFinite)).toBe(true);
  });
  it("preserves authored texture coordinates", () => {
    const source = new THREE.BoxGeometry();
    expect(withFallbackTextureCoordinates(source)).toBe(source);
  });
  it("keeps exposure within 1.8–2.2 and ambient at 0.4", () => {
    expect(SHOWROOM.exposure).toBeGreaterThanOrEqual(1.8);
    expect(SHOWROOM.exposure).toBeLessThanOrEqual(2.2);
    expect(SHOWROOM.ambient).toBe(0.4);
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