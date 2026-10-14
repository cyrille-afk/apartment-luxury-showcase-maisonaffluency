import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SHOWROOM, applyMatteTextile, floorSurfaceRoughness, textileNormalPixels, toPbrMaterial, withFallbackTextureCoordinates, withSmoothAssetNormals } from "./showroomRendering";

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
  it("uses the requested 1.3 exposure", () => {
    expect(SHOWROOM.exposure).toBe(1.3);
  });
  it("keeps ambient at 0.2 for architectural accents", () => {
    expect(SHOWROOM.ambient).toBe(0.2);
  });
  it("uses warm-white cove light", () => {
    expect(SHOWROOM.cove).toBe("#fff3e0");
  });
  it("keeps wood satin at 0.5 with midpoint glare", () => {
    expect(floorSurfaceRoughness(true, 50)).toBeCloseTo(0.5);
    expect(floorSurfaceRoughness(true, 0)).toBeGreaterThan(floorSurfaceRoughness(true, 100));
  });
  it("keeps cement matte within 0.85–0.95", () => {
    expect(floorSurfaceRoughness(false, 0)).toBe(0.95);
    expect(floorSurfaceRoughness(false, 100)).toBeCloseTo(0.85);
  });
  it("makes textiles matte and nonmetallic without losing colour or normal detail", () => {
    const material = new THREE.MeshPhysicalMaterial({ roughness: 0.2, metalness: 1, roughnessMap: new THREE.Texture(), metalnessMap: new THREE.Texture(), clearcoat: 1, map: new THREE.Texture(), normalMap: new THREE.Texture() });
    const map = material.map, normalMap = material.normalMap, roughnessMap = material.roughnessMap;
    applyMatteTextile(material);
    expect(material.roughness).toBe(0.9);
    expect(material.metalness).toBe(0);
    expect(material.metalnessMap).toBeNull();
    expect(material.roughnessMap).toBe(roughnessMap);
    expect(material.clearcoat).toBe(0);
    expect(material.map).toBe(map);
    expect(material.normalMap).toBe(normalMap);
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
  it("disables flat shading while preserving physical materials and roughness maps", () => {
    const source = new THREE.MeshPhysicalMaterial({ flatShading: true, roughnessMap: new THREE.Texture(), clearcoat: 0.3 });
    const material = toPbrMaterial(source);
    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(material.flatShading).toBe(false);
    expect(material.roughnessMap).toBe(source.roughnessMap);
    expect(source.flatShading).toBe(true);
  });
  it("smooths curved nonindexed faces across seams without editing cached geometry", () => {
    const source = new THREE.CylinderGeometry(1, 1, 2, 32, 1, true).toNonIndexed();
    source.computeVertexNormals();
    const before = [...source.getAttribute("normal").array];
    const geometry = withSmoothAssetNormals(source);
    const normals = geometry.getAttribute("normal");
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const radial = new THREE.Vector3(positions.getX(i), 0, positions.getZ(i)).normalize();
      const normal = new THREE.Vector3().fromBufferAttribute(normals, i);
      expect(normal.dot(radial)).toBeGreaterThan(0.99);
    }
    expect([...source.getAttribute("normal").array]).toEqual(before);
    expect(geometry.getAttribute("uv").array).toEqual(source.getAttribute("uv").array);
    expect(geometry).not.toBe(source);
  });
  it("retains sharp ninety-degree corners", () => {
    const geometry = withSmoothAssetNormals(new THREE.BoxGeometry());
    const normals = geometry.getAttribute("normal");
    for (let i = 0; i < normals.count; i++) {
      expect(Math.max(Math.abs(normals.getX(i)), Math.abs(normals.getY(i)), Math.abs(normals.getZ(i)))).toBeCloseTo(1);
    }
  });
  it("creates directional textile normals rather than flat colour", () => {
    const pixels = new Uint8ClampedArray([0,0,0,255, 128,128,128,255, 255,255,255,255]);
    const normals = textileNormalPixels(pixels, 3, 1);
    expect(normals[4]).not.toBe(128);
    expect(normals[6]).toBeGreaterThan(128);
    expect(normals[7]).toBe(255);
  });
});