import * as THREE from "three";

/** Bake box projection into UVs so raster and GPU path tracing sample the same slab. */
export function marbleBoxGeometry(
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
  const unit = Math.max(size.x, size.y, size.z, 1e-6);
  const center = bounds.getCenter(new THREE.Vector3());
  const uv = new Float32Array(positions.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let i = 0; i + 2 < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i).applyMatrix4(transform);
    b.fromBufferAttribute(positions, i + 1).applyMatrix4(transform).sub(a);
    c.fromBufferAttribute(positions, i + 2).applyMatrix4(transform).sub(a);
    normal.crossVectors(b, c);
    const x = Math.abs(normal.x), y = Math.abs(normal.y), z = Math.abs(normal.z);
    for (let v = i; v < i + 3; v++) {
      point.fromBufferAttribute(positions, v).applyMatrix4(transform).sub(center).divideScalar(unit);
      uv[v * 2] = 0.5 + (x >= y && x >= z ? point.z : point.x);
      uv[v * 2 + 1] = 0.5 + (y >= x && y >= z ? point.z : point.y);
    }
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  // Supplier tangents belong to the old UV layout, not the new box projection.
  geometry.deleteAttribute("tangent");
  geometry.userData.visualiserOwnedGeometry = true;
  geometry.userData.visualiserMarbleProjection = "box";
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
  texture.userData.visualiserMarbleProjection = "box";
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
    mesh.geometry = marbleBoxGeometry(previous, new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld), bounds);
    if (previous.userData.visualiserOwnedGeometry || previous.userData.visualiserUvFallback) previous.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const entry of materials) {
      if (!(entry instanceof THREE.MeshStandardMaterial) || !entry.userData.visualiserPolishedMarble) continue;
      for (const key of MAP_KEYS) {
        const texture = entry[key];
        if (texture) entry[key] = marbleSlabTexture(texture);
      }
      entry.userData.visualiserMarbleProjection = "box";
      entry.needsUpdate = true;
    }
  }
}

export function disposeMarbleSlabMaps(material: THREE.Material): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  for (const key of MAP_KEYS) {
    const texture = material[key];
    if (texture?.userData.visualiserMarbleProjection === "box") texture.dispose();
  }
}