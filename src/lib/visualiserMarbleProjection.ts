import * as THREE from "three";

/** Bake one Y-axis planar projection across the entire slab for both renderers. */
export function marblePlanarGeometry(
  source: THREE.BufferGeometry,
  transform = new THREE.Matrix4(),
  slabBounds?: THREE.Box3,
): THREE.BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const positions = geometry.getAttribute("position");
  if (!positions) return geometry;
  const bounds = slabBounds?.clone() ?? new THREE.Box3();
  const point = new THREE.Vector3();
  if (!slabBounds) {
    for (let i = 0; i < positions.count; i++) bounds.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(transform));
  }
  const size = bounds.getSize(new THREE.Vector3());
  const width = Math.max(size.x, 1e-6);
  const depth = Math.max(size.z, 1e-6);
  const uv = new Float32Array(positions.count * 2);
  // Never switch axes at curved rims or restart the UV range for each triangle/mesh.
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(transform);
    uv[i * 2] = THREE.MathUtils.clamp((point.x - bounds.min.x) / width, 0, 1);
    uv[i * 2 + 1] = THREE.MathUtils.clamp((point.z - bounds.min.z) / depth, 0, 1);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  // Supplier tangents belong to the old UV layout, not the new box projection.
  geometry.deleteAttribute("tangent");
  geometry.userData.visualiserOwnedGeometry = true;
  geometry.userData.visualiserMarbleProjection = "planar-y";
  return geometry;
}

export function marbleSlabTexture(source: THREE.Texture): THREE.Texture {
  const texture = source.clone();
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  texture.center.set(0, 0);
  texture.rotation = 0;
  texture.channel = 0;
  texture.matrixAutoUpdate = true;
  texture.updateMatrix();
  texture.userData.visualiserMarbleProjection = "planar-y";
  texture.needsUpdate = true;
  return texture;
}

const MAP_KEYS = ["map", "normalMap", "roughnessMap", "bumpMap", "aoMap", "displacementMap", "alphaMap"] as const;

/** Only marble coffee-table surfaces change; shared supplier assets and bases stay intact. */
export function applyCoffeeTableMarbleProjection(root: THREE.Object3D, productName: string): void {
  if (!/coffee\s*table/i.test(productName)) return;
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  const inverse = root.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const role = mesh.userData.partRole;
    if (["base", "frame", "upholstery", "backrest"].includes(role)) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.some((m) => m.userData.visualiserPolishedMarble)) return;
    meshes.push(mesh);
    mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)));
  });
  for (const mesh of meshes) {
    const previous = mesh.geometry;
    mesh.geometry = marblePlanarGeometry(previous, new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld), bounds);
    if (previous.userData.visualiserOwnedGeometry || previous.userData.visualiserUvFallback) previous.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const entry of materials) {
      if (!(entry instanceof THREE.MeshStandardMaterial) || !entry.userData.visualiserPolishedMarble) continue;
      for (const key of MAP_KEYS) {
        const texture = entry[key];
        if (texture) entry[key] = marbleSlabTexture(texture);
      }
      entry.userData.visualiserMarbleProjection = "planar-y";
      entry.needsUpdate = true;
    }
  }
}

export function disposeMarbleSlabMaps(material: THREE.Material): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  for (const key of MAP_KEYS) {
    const texture = material[key];
    if (texture?.userData.visualiserMarbleProjection) texture.dispose();
  }
}