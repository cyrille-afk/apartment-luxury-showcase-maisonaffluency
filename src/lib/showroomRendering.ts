import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Shared scene-lighting tokens, kept separate from catalogue finishes. */
export const SHOWROOM = {
  // Architectural two-point perspective: level camera, horizontal orbit only.
  cameraFov: 35,
  cameraPosition: [0, 1.8, 20] as [number, number, number],
  cameraTarget: [0, 1.8, 0] as [number, number, number],
  cameraPolarAngle: Math.PI / 2,
  contactOpacity: 0.72,
  aoIntensity: 1.28,
  exposure: 1,
  environmentIntensity: 0.35,
  photorealEnvironmentScale: 0.5,
  ambient: 0.2,
  cove: "#fff3e0",
  textileRoughness: 0.9,
  key: "#fff7ed",
  fill: "#edf3ff",
  rim: "#ffffff",
  plaster: "#f3f2ee",
};

/** Matte mineral floors; wood retains a satin midpoint and the existing glare control. */
export function floorSurfaceRoughness(oak: boolean, glare: number): number {
  const amount = THREE.MathUtils.clamp(glare, 0, 100) / 100;
  return oak ? 0.6 - amount * 0.2 : 0.95 - amount * 0.1;
}

/** Texture green multiplies material roughness: encode variation relative to the scalar. */
export function floorRoughnessTexel(oak: boolean, glare: number, luminance: number): number {
  const base = floorSurfaceRoughness(oak, glare);
  const detail = THREE.MathUtils.clamp(luminance, 0, 1);
  const effective = oak ? Math.max(0.4, base - detail * 0.02) : Math.max(0.85, base - detail * 0.01);
  return Math.round(effective / base * 255);
}

/** Fabrics retain colour/normal detail but never inherit metallic or glossy coatings. */
export function applyMatteTextile(material: THREE.MeshStandardMaterial): void {
  material.roughness = SHOWROOM.textileRoughness;
  material.metalness = 0;
  material.metalnessMap = null;
  if (material instanceof THREE.MeshPhysicalMaterial) material.clearcoat = 0;
}

/** Polish identified marble only; keep its veining and authored surface maps. */
export function applyPolishedMarble(material: THREE.MeshStandardMaterial, finishName: string): boolean {
  if (!/\bmarble\b/i.test(finishName.replace(/[_-]/g, " "))) return false;
  material.roughness = 0.15;
  material.metalness = 0;
  material.metalnessMap = null;
  material.userData.visualiserPolishedMarble = true;
  material.needsUpdate = true;
  return true;
}

/** Preserve authored maps and transparency when upgrading legacy unlit materials. */
export function toPbrMaterial(source: THREE.Material): THREE.MeshStandardMaterial {
  if (source instanceof THREE.MeshStandardMaterial) {
    const material = source.clone();
    material.flatShading = false;
    return material;
  }
  const legacy = source as THREE.MeshBasicMaterial;
  return new THREE.MeshStandardMaterial({
    name: source.name,
    color: legacy.color?.clone() ?? new THREE.Color(1, 1, 1),
    map: legacy.map ?? null,
    alphaMap: legacy.alphaMap ?? null,
    opacity: source.opacity,
    transparent: source.transparent,
    alphaTest: source.alphaTest,
    side: source.side,
    vertexColors: legacy.vertexColors ?? false,
    roughness: 0.65,
    metalness: 0,
  });
}

/** Smooth curves across UV seams, retaining sharp joinery and cached GLTF data. */
export function withSmoothAssetNormals(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const cloned = source.clone();
  if (cloned.getAttribute("position")) cloned.computeVertexNormals();
  const geometry = cloned.getAttribute("position") ? toCreasedNormals(cloned, Math.PI / 3) : cloned;
  if (geometry !== cloned) cloned.dispose();
  geometry.userData.visualiserOwnedGeometry = true;
  return geometry;
}

/** Box-projected fallback for exports missing UVs; never replaces authored UVs. */
export function withFallbackTextureCoordinates(source: THREE.BufferGeometry): THREE.BufferGeometry {
  if (source.getAttribute("uv")) return source;
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const positions = geometry.getAttribute("position");
  if (!positions) return geometry;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) return geometry;
  const size = bounds.getSize(new THREE.Vector3());
  const unit = Math.max(size.x, size.y, size.z, 0.000001);
  const uv = new Float32Array(positions.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let i = 0; i + 2 < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i);
    b.fromBufferAttribute(positions, i + 1).sub(a);
    c.fromBufferAttribute(positions, i + 2).sub(a);
    normal.crossVectors(b, c);
    const x = Math.abs(normal.x), y = Math.abs(normal.y), z = Math.abs(normal.z);
    for (let v = i; v < i + 3; v++) {
      const px = (positions.getX(v) - bounds.min.x) / unit;
      const py = (positions.getY(v) - bounds.min.y) / unit;
      const pz = (positions.getZ(v) - bounds.min.z) / unit;
      uv[v * 2] = x >= y && x >= z ? pz : px;
      uv[v * 2 + 1] = y >= x && y >= z ? pz : py;
    }
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.userData.visualiserUvFallback = true;
  return geometry;
}

/** A photo-derived micro-normal approximation, not a measured textile scan. */
export function textileNormalPixels(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(width * height * 4);
  const luminance = (x: number, y: number) => {
    const i = (((y + height) % height) * width + ((x + width) % width)) * 4;
    return (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = (luminance(x - 1, y) - luminance(x + 1, y)) * 1.5;
    const dy = (luminance(x, y - 1) - luminance(x, y + 1)) * 1.5;
    const length = Math.hypot(dx, dy, 1);
    const i = (y * width + x) * 4;
    result[i] = (dx / length * 0.5 + 0.5) * 255;
    result[i + 1] = (dy / length * 0.5 + 0.5) * 255;
    result[i + 2] = (1 / length * 0.5 + 0.5) * 255;
    result[i + 3] = 255;
  }
  return result;
}