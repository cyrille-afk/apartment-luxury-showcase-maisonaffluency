import * as THREE from "three";

/** Normal relief changes lighting, not supplier geometry or silhouettes. */
export function deepenArmchairWeave(material: THREE.MeshStandardMaterial, product: string, textile: boolean): void {
  if (!textile || !/armchair|\bchair\b/i.test(product)) return;
  if (!material.normalMap) {
    // Generic woven micro-relief for colour-only supplier upholstery, not a fake scan.
    const size = 256, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = Math.cos(x / size * Math.PI * 2 * 32) * 0.18;
      const dy = Math.cos(y / size * Math.PI * 2 * 32) * 0.18;
      const length = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      pixels[i] = Math.round((dx / length * 0.5 + 0.5) * 255);
      pixels[i + 1] = Math.round((dy / length * 0.5 + 0.5) * 255);
      pixels[i + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
      pixels[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.repeat.set(3, 3);
    texture.userData.visualiserOwnedWeave = true;
    texture.needsUpdate = true;
    material.normalMap = texture;
    material.needsUpdate = true;
  }
  material.normalScale.multiplyScalar(1.5);
  material.userData.visualiserDeepWeave = true;
}

export function isWoodSurface(description: string): boolean {
  const name = description.replace(/[_-]/g, " ");
  return /wood|\boak\b|walnut|ash\b|teak|rosewood|mahogany|ebony|beech|elm\b/i.test(name)
    && !/lacquer|paint|upholstery|fabric|leather|marble|metal|brass/i.test(name);
}

/** Bounded green-channel modulation: at most 8% softer sheen, never glossy patches. */
export function woodRoughnessPixels(size = 256): Uint8Array {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    const grain = Math.sin(u * 19 + Math.sin(v * 2) * 0.8);
    const wear = Math.sin(u * 3 + Math.cos(v * 2)) * Math.cos(v * 3);
    const r = Math.round(255 * (0.96 + grain * 0.018 + wear * 0.022));
    const i = (y * size + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = r;
    pixels[i + 3] = 255;
  }
  return pixels;
}

/** Only fill missing roughness; authored supplier maps always win. */
export function addWoodRoughness(material: THREE.MeshStandardMaterial, description: string): void {
  if (!isWoodSurface(description) || material.roughnessMap) return;
  const texture = new THREE.DataTexture(woodRoughnessPixels(), 256, 256, THREE.RGBAFormat);
  const source = material.map;
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = source?.wrapS ?? THREE.RepeatWrapping;
  texture.wrapT = source?.wrapT ?? THREE.RepeatWrapping;
  if (source) {
    texture.repeat.copy(source.repeat);
    texture.offset.copy(source.offset);
    texture.center.copy(source.center);
    texture.rotation = source.rotation;
    texture.channel = source.channel;
    texture.flipY = source.flipY;
  }
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.userData.visualiserWoodRoughness = true;
  texture.needsUpdate = true;
  material.roughnessMap = texture;
  material.needsUpdate = true;
}

export function disposeMicroSurfaceMaps(material: THREE.Material): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  if (material.roughnessMap?.userData.visualiserWoodRoughness) material.roughnessMap.dispose();
  if (material.normalMap?.userData.visualiserOwnedWeave) material.normalMap.dispose();
}