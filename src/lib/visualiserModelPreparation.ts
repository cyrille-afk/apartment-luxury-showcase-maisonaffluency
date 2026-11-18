import * as THREE from "three";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import { findProductSchema } from "./visualiserProductSchema";
import { BOND_STREET_BASE_FINISH, isBondStreetStool } from "./visualiserProductFinishes";
import { classifyMeshPart, humanizePartName, meshPartMaterial, type FinishPart } from "./visualiserFinishTargets";
import type { PartOverrides } from "./visualiserPartMapping";
import { applyModelOrientation, fitExactModelDimensions, fitUprightModel } from "./modelOrientation";
import { applyMatteTextile, applyPolishedMarble, textileNormalPixels, toPbrMaterial, withFallbackTextureCoordinates, withSmoothAssetNormals } from "./showroomRendering";
import { isCurvedFurniturePart, subdivideCurvedGeometry } from "./visualiserSubdivision";
import type { OpenSubdivModule } from "@nasedkinpv/opensubdiv-wasm";
import { applyCoffeeTableMarbleProjection, isStoneSlabFinish } from "./visualiserMarbleProjection";
import { addWoodRoughness, deepenArmchairWeave } from "./visualiserMicroSurfaces";
import { stripEmbeddedGroundPlanes } from "./visualiserEmbeddedGround";
import { FURNITURE_CONTACT_LAYER } from "./visualiserGroundLayers";
import { resolveDimensions } from "./productDimensions";
import { physicalCoffeeTableMarble } from "./visualiserMarbleSurface";
import { checkViewingRoomDimensions } from "./viewingRoomDimensionCheck";
export type LoadedMaps = {
  diffuse: THREE.Texture | null;
  normal: THREE.Texture | null;
  roughness: THREE.Texture | null;
};

const EMPTY_MAPS: LoadedMaps = { diffuse: null, normal: null, roughness: null };

const disposeMaps = (m: LoadedMaps) => { m.diffuse?.dispose(); m.normal?.dispose(); m.roughness?.dispose(); };


const STONE_RE = /\b(stone|marble|ceppo|travertin|granite|onyx|limestone|quartzite|terrazzo|basalt|slate)/i;
export const isStoneMaterial = (m: VisualiserMaterial) =>
  STONE_RE.test(`${m.name} ${m.material_type ?? ""} ${m.category ?? ""}`);
const isTextileMaterial = (m: VisualiserMaterial) =>
  /\b(fabric|textile|boucl[eé]|upholstery|linen|wool|velvet|cotton)\b/i.test(`${m.name} ${m.material_type ?? ""} ${m.category ?? ""}`);

function deriveTextileNormal(diffuse: THREE.Texture | null): THREE.Texture | null {
  const source = diffuse?.image as HTMLCanvasElement | HTMLImageElement | undefined;
  if (!source?.width) return null;
  const canvas = new OffscreenCanvas(1, 1);
  const ratio = Math.min(1, 1024 / Math.max(source.width, source.height));
  canvas.width = Math.max(1, Math.round(source.width * ratio));
  canvas.height = Math.max(1, Math.round(source.height * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  image.data.set(textileNormalPixels(image.data, canvas.width, canvas.height));
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.userData.derivedTextile = true;
  return texture;
}

function applyFurnitureMicroSurfaces(material: THREE.MeshStandardMaterial, product: string, textile: boolean, description: string) {
  if (textile && /armchair|\bchair\b/i.test(product) && !material.normalMap && material.map) {
    // Legacy GLBs sometimes have only fabric colour; keep this approximation owned.
    try {
      const normal = deriveTextileNormal(material.map);
      if (normal) {
        const source = material.map;
        normal.colorSpace = THREE.NoColorSpace;
        normal.wrapS = source.wrapS; normal.wrapT = source.wrapT;
        normal.repeat.copy(source.repeat); normal.offset.copy(source.offset);
        normal.center.copy(source.center); normal.rotation = source.rotation;
        normal.flipY = source.flipY; normal.channel = source.channel;
        normal.anisotropy = source.anisotropy;
        normal.userData.visualiserOwnedWeave = true;
        normal.needsUpdate = true;
        material.normalMap = normal;
      }
    } catch { /* Unreadable colour textures retain the supplier material. */ }
  }
  deepenArmchairWeave(material, product, textile);
  if (!textile && /table|chair/i.test(product)) addWoodRoughness(material, description);
}

/**
 * Stone swatches rarely ship a roughness map. Derive a high-res one from the
 * diffuse luminance so polished vs. matte segments (clasts, veins, cement)
 * reflect light unevenly instead of reading as one uniform sheen.
 */
function deriveStoneRoughness(diffuse: THREE.Texture | null): THREE.Texture | null {
  const src = diffuse?.image as HTMLCanvasElement | HTMLImageElement | undefined;
  if (!src || !src.width) return null;
  const size = Math.min(2048, Math.max(src.width, src.height));
  const c = new OffscreenCanvas(1, 1);
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    // Light clasts polish brighter (lower roughness); dark matrix stays matte.
    const r = Math.round((0.75 - lum * 0.5) * 255);
    d[i] = d[i + 1] = d[i + 2] = r;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

export async function loadMaterialMaps(material: VisualiserMaterial, maxAnisotropy: number): Promise<LoadedMaps> {
  const loader = new THREE.ImageBitmapLoader();
  const load = (url?: string | null): Promise<THREE.Texture | null> => url ? loader.loadAsync(url).then(image => {
    const texture = new THREE.Texture(image); texture.needsUpdate = true; return texture;
  }).catch(() => null) : Promise.resolve(null);
  // Swatch photos are circular thumbnails on a white background. Tiled raw,
  // the white corners produce a checkered pattern on the model — crop to the
  // circle's inscribed square (center ~70%) before using one as a texture.
  const loadDiffuse = async (url?: string | null): Promise<THREE.Texture | null> => {
    const source = await load(url);
    const img = source?.image as ImageBitmap | undefined;
    if (!img?.width) return source;
    const side = Math.floor(Math.min(img.width, img.height) / Math.SQRT2);
    const canvas = new OffscreenCanvas(side, side);
    const ctx = canvas.getContext("2d");
    if (!ctx || side < 2) return source;
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, side, side);
    return new THREE.CanvasTexture(canvas);
  };
  const [diffuse, normal, roughness] = await Promise.all([
    material.diffuse_url ? load(material.diffuse_url) : loadDiffuse(material.image_url),
    load(material.normal_url),
    load(material.roughness_url),
  ]);
  const finalRoughness = roughness ?? (isStoneMaterial(material) ? deriveStoneRoughness(diffuse) : null);
  const finalNormal = normal ?? (isTextileMaterial(material) ? deriveTextileNormal(diffuse) : null);
  // Furniture-scale tiling: a swatch tiled 6x on a side table reads as grey noise.
  const repeat = material.repeat ?? 2;
  for (const texture of [diffuse, finalNormal, finalRoughness]) {
    if (!texture) continue;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.anisotropy = maxAnisotropy;
    texture.needsUpdate = true;
  }
  if (diffuse) diffuse.colorSpace = THREE.SRGBColorSpace;
  if (finalNormal) finalNormal.colorSpace = THREE.NoColorSpace;
  if (finalRoughness) finalRoughness.colorSpace = THREE.NoColorSpace;
  return { diffuse, normal: finalNormal, roughness: finalRoughness };
}

/**
 * Clone a GLB material and re-key it to the chosen finish.
 * Metals are given an envMapIntensity so they still read under IBL instead of
 * rendering solid black when no reflection source contributes.
 */
function clonePbrMaterial(source: THREE.Material, finish: VisualiserMaterial | null, maps: LoadedMaps, neutralFabric = false) {
  const material = toPbrMaterial(source);
  const original = material;
  const metalness = neutralFabric ? 0 : finish?.metalness ?? 0;
  // Polished metals read from reflections, not a tiled swatch photo — a swatch
  // stretched over brass or chrome is exactly what produced the grey noise.
  const isMetal = metalness > 0.45;
  if (neutralFabric) {
    material.map = null;
    material.normalMap = null;
    material.roughnessMap = null;
  } else {
    // Keep the GLB's own authored maps whenever the finish does not supply one.
    material.map = isMetal ? null : maps.diffuse ?? original.map;
    material.normalMap = maps.normal?.userData.derivedTextile ? original.normalMap ?? maps.normal : maps.normal ?? original.normalMap;
    material.roughnessMap = maps.roughness ?? original.roughnessMap;
  }
  material.metalnessMap = isMetal ? null : original.metalnessMap;
  // Baked vertex colours multiply over the swatch texture and flatten it into a
  // solid tint — a finish texture must own the surface colour.
  if (!neutralFabric && material.map) material.vertexColors = false;
  // A loaded swatch texture carries the true colour; tinting it again with the
  // finish's flat colour is what made fabrics read as solid paint.
  material.color.set(neutralFabric ? "#d8d4cc" : maps.diffuse && !isMetal ? "#ffffff" : finish?.color ?? "#ffffff");
  const baseRoughness = neutralFabric ? 0.65 : finish?.roughness ?? (isMetal ? 0.25 : finish && isTextileMaterial(finish) ? 0.65 : maps.roughness ? 1 : 0.7);
  // Matte textiles retain their colour and normal maps, never metal response.
  const isFabric = neutralFabric || (!!finish && isTextileMaterial(finish));
  material.roughness = baseRoughness;
  material.metalness = THREE.MathUtils.clamp(metalness, 0, 0.92);
  if (isFabric) applyMatteTextile(material);
  // Non-metals get a touch more IBL so stone/wood edges catch thin speculars.
  material.envMapIntensity = isMetal ? 1.8 : metalness > 0.2 ? 1.5 : 1.15;
  // Fabrics (high roughness) need deeper normals so bouclé reads under grazing key light.
  const n = finish && isTextileMaterial(finish) ? 0.85 : 0.35;
  material.normalScale.set(n, n);
  if (!isFabric && finish) applyPolishedMarble(material, `${finish.name} ${finish.material_type ?? ""} ${finish.category ?? ""}`);
  material.userData.visualiserStoneSlab = !isFabric && !!finish && isStoneSlabFinish(`${finish.name} ${finish.material_type ?? ""} ${finish.category ?? ""}`);
  material.transparent = original.transparent;
  material.side = original.side;
  material.userData.visualiserClone = true;
  material.needsUpdate = true;
  return material;
}

function assignParts(root: THREE.Object3D, overrides: PartOverrides, materialRoles: Record<string, FinishPart> = {}) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((c) => { if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh); });
  const matName = (m: THREE.Mesh) => {
    const src = Array.isArray(m.material) ? m.material[0] : m.material;
    return src?.name || src?.uuid || "";
  };
  const distinct = new Set(meshes.map(matName)).size;
  const groupLabels = new Map<string, string>();
  const usedLabels = new Map<string, number>();
  const uniqueLabel = (base: string) => {
    const n = (usedLabels.get(base) ?? 0) + 1;
    usedLabels.set(base, n);
    return n === 1 ? base : `${base} ${n}`;
  };
  meshes.forEach((mesh, index) => {
    const nodeName = `${mesh.name} ${mesh.parent?.name ?? ""}`;
    const key = `${index}:${mesh.name || mesh.parent?.name || ""}`;
    // Unnamed meshes are still classifiable by their material name
    // (e.g. Man of Parts "WoodFinish" → frame, "Glides" → base).
    // Declared material roles beat name guessing for coded models (e.g. "VIFS01").
    const named = materialRoles[matName(mesh)] ?? classifyMeshPart(nodeName, matName(mesh));
    // Unnamed parts that carry their own GLB material are independently finishable.
    let auto: FinishPart | null = named;
    if (!auto && distinct > 1) {
      const g = `part:${matName(mesh)}`;
      if (!groupLabels.has(g)) {
        // Name the tab after what it textures ("Wood Finish"), never "Part 3".
        const readable = humanizePartName(mesh.name || mesh.parent?.name || matName(mesh));
        groupLabels.set(g, readable ? uniqueLabel(readable) : `Part ${groupLabels.size + 1}`);
      }
      auto = g as FinishPart;
    }
    const o = overrides[key];
    mesh.userData.partKey = key;
    mesh.userData.partAuto = auto;
    mesh.userData.partLabel = mesh.name || mesh.parent?.name || "";
    mesh.userData.partRole = o === "none" ? null : o ?? auto;
  });
  return groupLabels;
}

function groundModel(model: THREE.Object3D): THREE.Object3D {
  const holder = new THREE.Group();
  holder.add(model);
  holder.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  if (Number.isFinite(bounds.min.y)) model.position.y -= bounds.min.y;
  holder.updateMatrixWorld(true);
  holder.userData = model.userData;
  return holder;
}

export function prepareModel(scene: THREE.Object3D, object: PlacedObject, partOverrides: PartOverrides, maps: Map<string, LoadedMaps>, subdivision: OpenSubdivModule | null): THREE.Object3D {
  const productId = object.id, url = object.glb_url ?? "";
  const holder = { ...object, baseMaterial: object.baseMaterial ?? (isBondStreetStool(productId) ? BOND_STREET_BASE_FINISH : null) };
    const clone = scene.clone(true);
    stripEmbeddedGroundPlanes(clone);
    const groupLabels = assignParts(clone, partOverrides, findProductSchema(object.product_name)?.materialRoles ?? {});
    clone.userData.groupLabels = Object.fromEntries(groupLabels);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.layers.enable(FURNITURE_CONTACT_LAYER);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const role = mesh.userData.partRole as FinishPart | null;
      const subdivided = subdivision && isCurvedFurniturePart(object.product_name, role, `${mesh.name} ${mesh.parent?.name ?? ""}`)
        ? subdivideCurvedGeometry(mesh.geometry, subdivision) : mesh.geometry;
      const smoothGeometry = subdivided !== mesh.geometry ? subdivided : withSmoothAssetNormals(mesh.geometry);
      mesh.geometry = withFallbackTextureCoordinates(smoothGeometry);
      if (mesh.geometry !== smoothGeometry) smoothGeometry.dispose();
      // Upholstery never inherits the whole-piece finish; other parts fall back to it.
      const finish = meshPartMaterial(holder, role);
      const neutralFabric = isBondStreetStool(productId) && role === "upholstery" && !finish;
      if (!finish && !neutralFabric) {
        const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const next = source.map((entry) => {
          const material = toPbrMaterial(entry);
          material.userData.visualiserClone = true;
          if (role === "upholstery" || role === "backrest") applyMatteTextile(material);
          if ((role === "upholstery" || role === "backrest") && material.normalMap) material.normalScale.multiplyScalar(1.2);
          if (role !== "upholstery" && role !== "backrest") applyPolishedMarble(material, `${entry.name} ${mesh.name}`);
          applyFurnitureMicroSurfaces(material, object.product_name, role === "upholstery" || role === "backrest", `${entry.name} ${mesh.name}`);
          return physicalCoffeeTableMarble(material, object.product_name, role);
        });
        mesh.material = Array.isArray(mesh.material) ? next : next[0];
        return;
      }
      const m = (finish && maps.get(finish.id)) || EMPTY_MAPS;
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = source.map((entry) => {
        const material = clonePbrMaterial(entry, finish, m, neutralFabric);
        applyFurnitureMicroSurfaces(material, object.product_name, !neutralFabric && !!finish && isTextileMaterial(finish), finish ? `${finish.name} ${finish.material_type ?? ""} ${finish.category ?? ""}` : `${entry.name} ${mesh.name}`);
        return physicalCoffeeTableMarble(material, object.product_name, role);
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
    const upright = applyModelOrientation(fitUprightModel(clone, object.dimensions, url, resolveDimensions(object)), object.modelOrientation);
    const model = groundModel(object.exactDimensionsM ? fitExactModelDimensions(upright, object.exactDimensionsM) : upright);
    const measured = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const recorded = resolveDimensions(object);
    model.userData.viewingRoomDimensionCheck = checkViewingRoomDimensions(
      { w: measured.x, d: measured.z, h: measured.y },
      object.exactDimensionsM ?? (recorded ? { w: recorded.w / 1000, d: recorded.d / 1000, h: recorded.h / 1000 } : null),
    );
    // Project only after import-axis correction: this frame is actually Y-up.
    applyCoffeeTableMarbleProjection(model, object.product_name);
    model.userData.visualiserInitialReady = [holder.material, holder.topMaterial, holder.baseMaterial, holder.upholsteryMaterial, ...Object.values(holder.partMaterials ?? {})].every((finish) => !finish || maps.has(finish.id));
    model.userData.visualiserInitialReady = true;
    return model;
}
