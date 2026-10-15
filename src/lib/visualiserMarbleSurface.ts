import * as THREE from "three";

export type MarbleSurfaceSettings = { reflectivity: number; roughness: number };
export const DEFAULT_MARBLE_SURFACE: MarbleSurfaceSettings = { reflectivity: 0.5, roughness: 0.15 };
export const isCoffeeTable = (name: string) => /coffee\s*table/i.test(name);

export function clampMarbleSurface(value?: Partial<MarbleSurfaceSettings> | null): MarbleSurfaceSettings {
  const clamp = (v: number | undefined, fallback: number) => typeof v === "number" && Number.isFinite(v) ? THREE.MathUtils.clamp(v, 0, 1) : fallback;
  return { reflectivity: clamp(value?.reflectivity, DEFAULT_MARBLE_SURFACE.reflectivity), roughness: clamp(value?.roughness, DEFAULT_MARBLE_SURFACE.roughness) };
}

/** Upgrade owned marble clones, preserving every authored map and the dielectric response. */
export function physicalCoffeeTableMarble(source: THREE.Material, productName: string, role: unknown): THREE.Material {
  if (!isCoffeeTable(productName) || ["base", "frame", "upholstery", "backrest"].includes(String(role)) || !source.userData.visualiserPolishedMarble || !(source instanceof THREE.MeshStandardMaterial)) return source;
  if (source instanceof THREE.MeshPhysicalMaterial) return source;
  const material = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(material, source);
  material.defines = { STANDARD: "", PHYSICAL: "" };
  source.dispose();
  return material;
}

/** Material-only updates avoid refitting or rebuilding the furniture while a slider moves. */
export function applyMarbleSurface(root: THREE.Object3D, productName: string, settings?: Partial<MarbleSurfaceSettings>): void {
  if (!isCoffeeTable(productName)) return;
  const values = clampMarbleSurface(settings);
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || ["base", "frame", "upholstery", "backrest"].includes(String(child.userData.partRole))) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshPhysicalMaterial) || !material.userData.visualiserPolishedMarble) continue;
      material.reflectivity = values.reflectivity;
      material.roughness = values.roughness;
      material.metalness = 0;
      material.metalnessMap = null;
      material.needsUpdate = true;
    }
  });
}