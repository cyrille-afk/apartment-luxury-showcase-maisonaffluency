import * as THREE from "three";
import OpenSubdiv, { type OpenSubdivModule } from "@nasedkinpv/opensubdiv-wasm";

let engine: Promise<OpenSubdivModule> | undefined;
export function loadSubdivisionEngine(): Promise<OpenSubdivModule> {
  engine ??= OpenSubdiv({ locateFile: () => new URL("../../node_modules/@nasedkinpv/opensubdiv-wasm/dist/opensubdiv.wasm", import.meta.url).href });
  return engine;
}

/** Conservative product/part allowlist; never round joinery or flat furniture. */
export function isCurvedFurniturePart(product: string, part: string | null, meshName: string): boolean {
  const name = meshName.replace(/[_-]/g, " ");
  if (/\b(legs?|glides?|feet|foot|frame|structure|socket|bulb|cable|plate)\b/i.test(name)) return false;
  const chair = /\b(GUM|BOB|Frenchmen Street|tub chair|barrel chair)\b/i.test(product);
  if (chair) return part === "upholstery" || part === "backrest";
  return /\b(Cinnamon Gardens|organic floor lamp)\b/i.test(product)
    && /\b(shade|stem|body|organic|curved)\b/i.test(name);
}

const cache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** True Catmull-Clark on welded position topology, with separate face-varying UVs. */
export function subdivideCurvedGeometry(source: THREE.BufferGeometry, module: OpenSubdivModule): THREE.BufferGeometry {
  const cached = cache.get(source);
  if (cached) return cached.clone();
  const position = source.getAttribute("position"), uv = source.getAttribute("uv");
  const count = source.index?.count ?? position?.count ?? 0;
  // Avoid unsupported animated/coloured assets, mixed material boundaries and unbounded expansion.
  if (!position || count === 0 || count % 3 || count / 3 > 150000 || source.groups.length > 1
    || source.getAttribute("skinIndex") || source.getAttribute("color") || Object.keys(source.morphAttributes).length
    || source.userData.visualiserSubdivisionLevel) return source;
  const positions: number[] = [], welded = new Map<string, number>();
  const indices = new Int32Array(count), uvIndices = new Int32Array(count);
  const uvValues = uv ? new Float32Array(position.count * 2) : null;
  for (let i = 0; i < position.count; i++) {
    if (uvValues && uv) { uvValues[i * 2] = uv.getX(i); uvValues[i * 2 + 1] = uv.getY(i); }
  }
  for (let i = 0; i < count; i++) {
    const v = source.index?.getX(i) ?? i;
    const x = position.getX(v), y = position.getY(v), z = position.getZ(v);
    if (![x, y, z].every(Number.isFinite)) return source;
    const key = `${x},${y},${z}`;
    let index = welded.get(key);
    if (index === undefined) { index = positions.length / 3; welded.set(key, index); positions.push(x, y, z); }
    indices[i] = index; uvIndices[i] = v;
  }
  const sizes = new Int32Array(count / 3).fill(3);
  const mesh = new module.SubdivisionMesh();
  try {
    const ok = uvValues
      ? mesh.initFromPolygonsWithUVs(new Float32Array(positions), indices, sizes, 1, module.BOUNDARY_EDGE_ONLY, uvValues, uvIndices, position.count)
      : mesh.initFromPolygons(new Float32Array(positions), indices, sizes, 1, module.BOUNDARY_EDGE_ONLY);
    if (!ok) return source;
    // Copy WASM arrays before another allocation or delete invalidates their views.
    const p = mesh.getPositions().slice(), triangles = mesh.getIndices().slice();
    const outUv = uvValues ? mesh.getUVs().slice() : null;
    const outUvIndices = uvValues ? mesh.getUVIndices().slice() : null;
    const output = new THREE.BufferGeometry();
    const expanded = new Float32Array(triangles.length * 3);
    const expandedUv = outUv ? new Float32Array(triangles.length * 2) : null;
    for (let i = 0; i < triangles.length; i++) {
      expanded.set(p.subarray(triangles[i] * 3, triangles[i] * 3 + 3), i * 3);
      if (expandedUv && outUv && outUvIndices) expandedUv.set(outUv.subarray(outUvIndices[i] * 2, outUvIndices[i] * 2 + 2), i * 2);
    }
    output.setAttribute("position", new THREE.BufferAttribute(expanded, 3));
    if (expandedUv) output.setAttribute("uv", new THREE.BufferAttribute(expandedUv, 2));
    // Smooth normals from the welded subdivided topology, then expand across UV seams.
    const indexed = new THREE.BufferGeometry();
    indexed.setAttribute("position", new THREE.BufferAttribute(p, 3));
    indexed.setIndex(new THREE.BufferAttribute(triangles, 1));
    indexed.computeVertexNormals();
    const n = indexed.getAttribute("normal"), normals = new Float32Array(expanded.length);
    for (let i = 0; i < triangles.length; i++) normals.set([n.getX(triangles[i]), n.getY(triangles[i]), n.getZ(triangles[i])], i * 3);
    output.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    indexed.dispose();
    if (source.groups[0]) output.addGroup(0, triangles.length, source.groups[0].materialIndex);
    output.userData = { ...source.userData, visualiserSubdivisionLevel: 1, visualiserOwnedGeometry: true };
    output.computeBoundingBox(); output.computeBoundingSphere();
    cache.set(source, output);
    return output.clone();
  } catch {
    return source; // A supplier topology failure must not take down the scene.
  } finally { mesh.delete(); }
}