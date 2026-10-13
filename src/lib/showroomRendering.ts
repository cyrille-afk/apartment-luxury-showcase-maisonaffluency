import * as THREE from "three";

/** Shared scene-lighting tokens, kept separate from catalogue finishes. */
export const SHOWROOM = {
  exposure: 1.1,
  ambient: 0.15,
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