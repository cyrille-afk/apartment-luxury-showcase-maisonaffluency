import * as THREE from "three";

/** Shared scene-lighting tokens, kept separate from catalogue finishes. */
export const SHOWROOM = {
  exposure: 2.0,
  ambient: 0.4,
  key: "#fff7ed",
  fill: "#edf3ff",
  rim: "#ffffff",
};

/** Preserve authored maps and transparency when upgrading legacy unlit materials. */
export function toPbrMaterial(source: THREE.Material): THREE.MeshStandardMaterial {
  if (source instanceof THREE.MeshStandardMaterial) return source.clone();
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