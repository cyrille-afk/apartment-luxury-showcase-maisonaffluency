import * as THREE from "three";

export const PATH_TRACING = {
  movingScale: 0.25,
  settledScale: 1,
  settleMs: 150,
  minSamples: 3,
  fadeMs: 200,
} as const;

export function isTraceableMesh(object: THREE.Object3D): object is THREE.Mesh {
  if (!(object as THREE.Mesh).isMesh || (object as THREE.Line).isLine || (object as THREE.Points).isPoints) return false;
  const material = (object as THREE.Mesh).material;
  const materials = Array.isArray(material) ? material : [material];
  return materials.length > 0 && materials.every((m) => Boolean(m) && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial);
}

/** Detect models/maps that finish loading after the page's placement signature. */
export function tracedSceneRevision(scene: THREE.Scene): string {
  const parts: string[] = [];
  scene.traverseVisible((object) => {
    if (!isTraceableMesh(object)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    parts.push(object.uuid, object.geometry.uuid, String(object.geometry.getAttribute("position")?.version), object.matrixWorld.elements.join(","));
    for (const material of materials) {
      const pbr = material as THREE.MeshStandardMaterial;
      parts.push(material.uuid, String(material.version), pbr.color.getHexString(), String(pbr.roughness), String(pbr.metalness));
      for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "alphaMap", "bumpMap", "emissiveMap", "displacementMap"] as const) {
        const texture = pbr[key];
        parts.push(texture ? `${texture.uuid}:${texture.version}` : "");
      }
    }
  });
  return parts.join("|");
}

export function tracedEnvironmentRevision(scene: THREE.Scene): string {
  const background = scene.background;
  return [scene.environment?.uuid, scene.environment?.version, scene.environmentIntensity,
    scene.environmentRotation.toArray().join(","),
    background instanceof THREE.Color ? background.getHexString() : background?.uuid,
    scene.backgroundIntensity, scene.backgroundBlurriness, scene.backgroundRotation.toArray().join(",")].join("|");
}