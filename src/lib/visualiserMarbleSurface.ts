import * as THREE from "three";
import { clampMarbleSurface, isCoffeeTable, type MarbleSurfaceSettings } from "./visualiserMarbleSettings";

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