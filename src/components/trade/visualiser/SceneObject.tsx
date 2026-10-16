import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { applyMarbleSurface, physicalCoffeeTableMarble } from "@/lib/visualiserMarbleSurface";
import type { MarbleSurfaceSettings } from "@/lib/visualiserMarbleSettings";
import { Html, useGLTF, useTexture, TransformControls } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import { findProductSchema } from "@/lib/visualiserProductSchema";
import { BOND_STREET_BASE_FINISH, isBondStreetStool } from "@/lib/visualiserProductFinishes";
import { classifyMeshPart, humanizePartName, meshPartMaterial, type FinishPart } from "@/lib/visualiserFinishTargets";
import { meshKey, registerModelMeshes, usePartOverrides, type ModelMesh, type PartOverrides } from "@/lib/visualiserPartMapping";
import { applyModelOrientation, fitUprightModel, type ModelOrientation } from "@/lib/modelOrientation";
import { snapCoordinate, resolveDragPosition, DEFAULT_FOOTPRINT_RADIUS, type FootprintObstacle } from "@/lib/visualiserPlacement";
import { applyMatteTextile, applyPolishedMarble, textileNormalPixels, toPbrMaterial, withFallbackTextureCoordinates, withSmoothAssetNormals } from "@/lib/showroomRendering";
import { isCurvedFurniturePart, loadSubdivisionEngine, subdivideCurvedGeometry } from "@/lib/visualiserSubdivision";
import type { OpenSubdivModule } from "@nasedkinpv/opensubdiv-wasm";
import { applyCoffeeTableMarbleProjection, disposeMarbleSlabMaps, isStoneSlabFinish } from "@/lib/visualiserMarbleProjection";
import { withCachedModelLoader } from "@/lib/visualiserModelCache";
import { addWoodRoughness, deepenArmchairWeave, disposeMicroSurfaceMaps } from "@/lib/visualiserMicroSurfaces";

export type PlacedObject = {
  instanceId: string;
  /** Bumped by "Restore piece" to remount the mesh and rebuild its materials. */
  restoreKey?: number;
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  dimensions: string | null;
  width_mm?: number | null;
  depth_mm?: number | null;
  height_mm?: number | null;
  size_variants?: Array<{ label?: string | null; base?: string | null; top?: string | null }> | null;
  glb_url: string | null;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  modelOrientation?: ModelOrientation;
  material?: VisualiserMaterial | null;
  topMaterial?: VisualiserMaterial | null;
  baseMaterial?: VisualiserMaterial | null;
  upholsteryMaterial?: VisualiserMaterial | null;
  /** Finishes for parts beyond top/base/upholstery (frame, drawer, part:<group> …). */
  partMaterials?: Record<string, VisualiserMaterial | null>;
  marbleSurface?: MarbleSurfaceSettings;
  /** When true, swatch clicks, Clear, and preset restores leave this piece's finishes untouched. */
  finishesLocked?: boolean;
  /** Spatial lock only; never prevents applying finishes. */
  positionLocked?: boolean;
};

type Props = {
  object: PlacedObject;
  selected: boolean;
  onSelect: (instanceId: string) => void;
  onTransform: (instanceId: string, position: [number, number, number], rotation: [number, number, number]) => void;
  onDragStateChange: (dragging: boolean) => void;
  /** When true, dragged positions snap to the placement grid. */
  snapToGrid?: boolean;
  /** Other pieces' footprints; dragged positions are pushed out of these. */
  obstacles?: FootprintObstacle[];
  /** This piece's own footprint radius in metres (defaults to a generic estimate). */
  selfRadius?: number;
  /** When false the piece is display-only: no drag, no gizmos. Defaults to true. */
  isEditable?: boolean;
  /** Optional non-uniform scale; overrides `object.scale` when provided. */
  scaleVector?: [number, number, number];
  /** Name-only annotation for generated room pieces; never includes pricing. */
  label?: string;
  /** Reports which texturable parts (top/base/upholstery) the GLB contains. */
  onTextureParts?: (instanceId: string, parts: FinishPart[]) => void;
  /** When false, floating name labels and lock badges unmount for a clean canvas. */
  showLabels?: boolean;
};

type LoadedMaps = {
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
  const canvas = document.createElement("canvas");
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
  const c = document.createElement("canvas");
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

async function loadMaterialMaps(material: VisualiserMaterial, maxAnisotropy: number): Promise<LoadedMaps> {
  const loader = new THREE.TextureLoader();
  const load = (url?: string | null) => url ? loader.loadAsync(url).catch(() => null) : Promise.resolve(null);
  // Swatch photos are circular thumbnails on a white background. Tiled raw,
  // the white corners produce a checkered pattern on the model — crop to the
  // circle's inscribed square (center ~70%) before using one as a texture.
  const loadDiffuse = (url?: string | null) => new Promise<THREE.Texture | null>((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const side = Math.floor(Math.min(img.width, img.height) / Math.SQRT2);
      const canvas = document.createElement("canvas");
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext("2d");
      if (!ctx || side < 2) { resolve(new THREE.Texture(img)); return; }
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, side, side);
      resolve(new THREE.CanvasTexture(canvas));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
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

/** Loads maps for every distinct finish on a piece (one entry per material id). */
function useMaterialMapsMany(materials: (VisualiserMaterial | null | undefined)[], maxAnisotropy: number) {
  const list = useMemo(() => {
    const byId = new Map<string, VisualiserMaterial>();
    for (const m of materials) if (m) byId.set(m.id, m);
    return [...byId.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials.map((m) => m ? `${m.id}|${m.diffuse_url ?? m.image_url ?? ""}|${m.normal_url ?? ""}|${m.roughness_url ?? ""}|${m.repeat ?? ""}` : "").join(",")]);
  const [maps, setMaps] = useState<Map<string, LoadedMaps>>(new Map());
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let cancelled = false;
    let owned: LoadedMaps[] = [];
    void Promise.all(list.map((m) => loadMaterialMaps(m, maxAnisotropy).catch(() => EMPTY_MAPS))).then((loaded) => {
      if (cancelled) { loaded.forEach(disposeMaps); return; }
      owned = loaded;
      setMaps(new Map(list.map((m, i) => [m.id, loaded[i]])));
      invalidate();
    });
    return () => { cancelled = true; const o = owned; queueMicrotask(() => o.forEach(disposeMaps)); };
  }, [list, maxAnisotropy, invalidate]);
  return maps;
}

/** Resolves every mesh to a finishable part: manual mapping → declared material role → node name → own material group. */
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
    const key = meshKey(index, mesh.name || mesh.parent?.name || "");
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

/** Normalises any GLB to roughly 1.4m tall and seats it on the floor plane. */
function useFittedModel(object: PlacedObject) {
  const productId = object.id;
  const url = object.glb_url ?? "";
  // Self-hosted Draco decoder: compressed GLBs stream in a fraction of the
  // bytes, uncompressed ones are unaffected (decoder is fetched on demand).
  const { scene } = useGLTF(url, "/draco/", undefined, withCachedModelLoader);
  const { gl } = useThree();
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
  const holder = useMemo(() => ({
    ...object,
    baseMaterial: object.baseMaterial ?? (isBondStreetStool(productId) ? BOND_STREET_BASE_FINISH : null),
  }), [object.material, object.topMaterial, object.baseMaterial, object.upholsteryMaterial, object.partMaterials, productId]);
  const maps = useMaterialMapsMany([
    holder.material, holder.topMaterial, holder.baseMaterial, holder.upholsteryMaterial,
    ...Object.values(holder.partMaterials ?? {}),
  ], maxAnisotropy);
  const partOverrides = usePartOverrides(productId);
  const [subdivision, setSubdivision] = useState<OpenSubdivModule | null>(null);
  useEffect(() => {
    let active = true;
    void loadSubdivisionEngine().then((module) => { if (active) setSubdivision(module); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return useMemo(() => {
    const clone = scene.clone(true);
    const groupLabels = assignParts(clone, partOverrides, findProductSchema(object.product_name)?.materialRoles ?? {});
    clone.userData.groupLabels = Object.fromEntries(groupLabels);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
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
    const model = groundModel(applyModelOrientation(fitUprightModel(clone, object.dimensions, url), object.modelOrientation));
    // Project only after import-axis correction: this frame is actually Y-up.
    applyCoffeeTableMarbleProjection(model, object.product_name);
    return model;
  }, [scene, partOverrides, holder, maps, productId, object.product_name, object.dimensions, url, object.modelOrientation, subdivision]);
}

/** Pieces always rest on the floor plane (Y = 0). */
const FLOOR_Y = 0;

/** Wraps the model so its lowest bounding-box point sits exactly on Y = 0. */
function groundModel(model: THREE.Object3D): THREE.Object3D {
  const holder = new THREE.Group();
  holder.add(model);
  holder.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  if (Number.isFinite(bounds.min.y)) model.position.y -= bounds.min.y;
  holder.userData = model.userData;
  return holder;
}

const ModelBody = ({ object, label, showLabels = true, onSelect, onTextureParts }: { object: PlacedObject; label?: string; showLabels?: boolean; onSelect: (id: string) => void; onTextureParts?: Props["onTextureParts"] }) => {
  const model = useFittedModel(object);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    applyMarbleSurface(model, object.product_name, object.marbleSurface);
    invalidate();
  }, [model, object.product_name, object.marbleSurface, invalidate]);
  useEffect(() => {
    const parts = new Set<FinishPart>();
    const list: ModelMesh[] = [];
    const groupLabels = (model.userData.groupLabels ?? {}) as Record<string, string>;
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      list.push({ key: String(mesh.userData.partKey ?? ""), label: String(mesh.userData.partLabel ?? ""), auto: mesh.userData.partAuto ?? null });
      if (mesh.userData.partRole) parts.add(mesh.userData.partRole);
    });
    registerModelMeshes(object.id, list, groupLabels);
    onTextureParts?.(object.instanceId, [...parts]);
  }, [model, object.id, object.instanceId, onTextureParts]);
  const labelPosition = useMemo<[number, number, number]>(() => {
    const bounds = new THREE.Box3().setFromObject(model);
    const centre = bounds.getCenter(new THREE.Vector3());
    return [centre.x, bounds.max.y + 0.18, centre.z];
  }, [model]);
  // Lock badge floats above the room label (or the piece itself) while finishes are protected.
  const lockPosition = useMemo<[number, number, number]>(() => {
    const bounds = new THREE.Box3().setFromObject(model);
    const centre = bounds.getCenter(new THREE.Vector3());
    return [centre.x, bounds.max.y + (label ? 0.55 : 0.18), centre.z];
  }, [model, label]);
  useEffect(() => () => {
    // Only dispose materials we cloned — the cached GLTF originals are shared
    // across every instance and disposing them renders later clones black.
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (mesh.geometry.userData.visualiserOwnedGeometry || mesh.geometry.userData.visualiserUvFallback) mesh.geometry.dispose();
      materials.forEach((entry) => {
        if (entry?.userData?.visualiserClone) {
          disposeMarbleSlabMaps(entry);
          disposeMicroSurfaceMaps(entry);
          entry.dispose();
        }
      });
    });
  }, [model]);
  return <>
    <primitive object={model} />
    {showLabels && label && <Html position={labelPosition} center zIndexRange={[5, 0]}>
      <Button variant="outline" aria-label={`Select ${label}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect(object.instanceId); }} data-room-piece-label={object.instanceId} className="h-auto w-36 whitespace-normal bg-background/95 px-2 py-1.5 text-center text-[11px] leading-snug text-foreground shadow-sm break-words select-none">
        {label}
      </Button>
    </Html>}
    {showLabels && (object.positionLocked || object.finishesLocked) && (
      <Html position={lockPosition} center zIndexRange={[6, 1]}>
        <LockBadge instanceId={object.instanceId} />
      </Html>
    )}
  </>;
};

/** Small non-interactive pill shown above a piece whose finishes are locked. */
const LockBadge = ({ instanceId }: { instanceId: string }) => (
  <span
    data-lock-badge={instanceId}
    className="pointer-events-none flex select-none items-center gap-1 rounded-full border border-border bg-background/95 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-foreground shadow-sm"
  >
    <Lock className="h-3 w-3 text-primary" aria-hidden />
    Locked
  </span>
);

const ImageBody = ({ url, name, locked, showLabels = true, instanceId }: { url: string; name: string; locked: boolean; showLabels?: boolean; instanceId: string }) => {
  const texture = useTexture(url);
  const image = texture.image as { width?: number; height?: number } | undefined;
  const aspect = image?.width && image?.height ? image.width / image.height : 1;
  const height = 1.2;
  return (
    <>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]} name={name}>
        <planeGeometry args={[height * aspect, height]} />
        <meshStandardMaterial map={texture} transparent alphaTest={0.4} side={THREE.DoubleSide} />
      </mesh>
      {locked && showLabels && (
        <Html position={[0, height + 0.25, 0]} center zIndexRange={[6, 1]}>
          <LockBadge instanceId={instanceId} />
        </Html>
      )}
    </>
  );
};

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const SceneObject = ({ object, selected, onSelect, onTransform, onDragStateChange, isEditable = true, scaleVector, label, showLabels = true, onTextureParts, snapToGrid = false, obstacles, selfRadius }: Props) => {
  // Refs so the window-level drag handlers always read the latest obstacles
  // without changing dragMove's identity mid-drag (listener removal depends on it).
  const obstaclesRef = useRef<FootprintObstacle[]>(obstacles ?? []);
  obstaclesRef.current = obstacles ?? [];
  const selfRadiusRef = useRef(selfRadius ?? DEFAULT_FOOTPRINT_RADIUS);
  selfRadiusRef.current = selfRadius ?? DEFAULT_FOOTPRINT_RADIUS;
  const groupRef = useRef<THREE.Group | null>(null);
  const [groupNode, setGroupNode] = useState<THREE.Group | null>(null);
  const { raycaster, gl, camera } = useThree();
  const draggingRef = useRef(false);
  const offsetRef = useRef(new THREE.Vector3());
  const hitRef = useRef(new THREE.Vector3());
  const pointerRef = useRef(new THREE.Vector2());
  // Latest floor height for the piece, readable from window-level drag listeners.
  const floorYRef = useRef(FLOOR_Y);
  floorYRef.current = FLOOR_Y;

  // Keep the group in sync when position changes from outside (e.g. reset/restore).
  useEffect(() => {
    if (groupRef.current && !draggingRef.current) {
      groupRef.current.position.set(object.position[0], FLOOR_Y, object.position[2]);
    }
  }, [object.position]);


  const body = object.glb_url
    ? <ModelBody object={object} label={label} showLabels={showLabels} onSelect={onSelect} onTextureParts={onTextureParts} />
    : object.image_url
      ? <ImageBody url={object.image_url} name={object.product_name} locked={Boolean(object.positionLocked || object.finishesLocked)} showLabels={showLabels} instanceId={object.instanceId} />
      : null;

  /** Raycast the pointer onto the y = 0 floor plane. */
  const floorHit = useCallback(() => {
    const point = hitRef.current;
    return raycaster.ray.intersectPlane(FLOOR_PLANE, point) ? point : null;
  }, [raycaster]);

  /**
   * Window-level drag tracking: once a drag starts, pointermove/up are read
   * from the window and raycast manually, so the piece keeps following the
   * cursor even when it moves faster than the model or leaves the mesh.
   */
  const dragMove = useCallback((event: PointerEvent) => {
    const group = groupRef.current;
    if (!draggingRef.current || !group) return;
    const rect = gl.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerRef.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointerRef.current, camera);
    const hit = raycaster.ray.intersectPlane(FLOOR_PLANE, hitRef.current);
    if (!hit) return;
    let x = hit.x + offsetRef.current.x;
    let z = hit.z + offsetRef.current.z;
    if (snapToGrid) {
      x = snapCoordinate(x);
      z = snapCoordinate(z);
    }
    // Collision-aware: never let the piece settle inside another footprint.
    [x, z] = resolveDragPosition(x, z, selfRadiusRef.current, obstaclesRef.current);
    // Floor lock: X/Z translation only, y stays on its depth layer.
    group.position.set(x, floorYRef.current, z);
  }, [gl, raycaster, camera, snapToGrid]);

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    window.removeEventListener("pointermove", dragMove);
    onDragStateChange(false);
    gl.domElement.style.cursor = "auto";
    const group = groupRef.current;
    if (group) {
      onTransform(object.instanceId, [group.position.x, floorYRef.current, group.position.z], object.rotation);
    }
  }, [dragMove, gl, onDragStateChange, onTransform, object.instanceId, object.rotation]);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onSelect(object.instanceId);
    if (!isEditable || object.positionLocked) return;
    const hit = floorHit();
    if (!hit || !groupRef.current) return;
    offsetRef.current.set(
      groupRef.current.position.x - hit.x,
      0,
      groupRef.current.position.z - hit.z,
    );
    draggingRef.current = true;
    onDragStateChange(true);
    window.addEventListener("pointermove", dragMove);
    window.addEventListener("pointerup", endDrag, { once: true });
    window.addEventListener("pointercancel", endDrag, { once: true });
    gl.domElement.style.cursor = "grabbing";
  };

  // Safety: never leave window drag listeners behind if the piece unmounts
  // mid-drag. Mount-only via refs: depending on [dragMove, endDrag] would
  // remove the live listeners whenever a parent re-render (e.g. selection)
  // changes their identity, silently killing the drag.
  const dragMoveRef = useRef(dragMove);
  dragMoveRef.current = dragMove;
  const endDragRef = useRef(endDrag);
  endDragRef.current = endDrag;
  useEffect(() => () => {
    window.removeEventListener("pointermove", dragMoveRef.current);
    window.removeEventListener("pointerup", endDragRef.current);
    window.removeEventListener("pointercancel", endDragRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Persist the gizmo result back into React state (floor-locked, upright). */
  const commit = () => {
    const group = groupRef.current;
    if (!group) return;
    group.position.y = FLOOR_Y;
    group.rotation.x = 0;
    group.rotation.z = 0;
    onTransform(
      object.instanceId,
      [group.position.x, FLOOR_Y, group.position.z],
      [0, group.rotation.y, 0],
    );
  };

  const content = (
    <group
      ref={(node) => {
        groupRef.current = node;
        setGroupNode(node);
      }}
      position={[object.position[0], FLOOR_Y, object.position[2]]}
      userData={{ visualiserInstanceId: object.instanceId }}
      rotation={object.rotation}
      scale={scaleVector ?? object.scale}
      onPointerDown={handlePointerDown}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (isEditable && !object.positionLocked && !draggingRef.current) gl.domElement.style.cursor = "grab";
      }}
      onPointerOut={() => {
        if (!draggingRef.current) gl.domElement.style.cursor = "auto";
      }}
    >
      {body}
    </group>
  );

  return (
    <>
      {content}
      {isEditable && selected && groupNode && (
        <>
          {/* Floor-plane arrows: X / Z translation only. */}
          {!object.positionLocked && <TransformControls
            object={groupNode}
            mode="translate"
            showY={false}
            size={0.85}
            onMouseDown={() => onDragStateChange(true)}
            onMouseUp={() => {
              onDragStateChange(false);
              commit();
            }}
            onObjectChange={() => {
              const group = groupRef.current;
              if (group) group.position.y = FLOOR_Y;
            }}
          />}
          {/* Outer ring: free 360° yaw so the piece can be aligned to the backdrop perspective. */}
          <TransformControls
            object={groupNode}
            mode="rotate"
            showX={false}
            showZ={false}
            size={1.15}
            onMouseDown={() => onDragStateChange(true)}
            onMouseUp={() => {
              onDragStateChange(false);
              commit();
            }}
            onObjectChange={() => {
              const group = groupRef.current;
              if (group) {
                // Yaw only — keep the piece upright on the floor plane.
                group.rotation.x = 0;
                group.rotation.z = 0;
              }
            }}
          />
        </>
      )}
    </>
  );
};

export default SceneObject;
