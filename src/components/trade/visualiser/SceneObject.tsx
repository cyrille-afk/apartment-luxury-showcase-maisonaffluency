import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html, useGLTF, useTexture, TransformControls } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import { BOND_STREET_BASE_FINISH, isBondStreetStool } from "@/lib/visualiserProductFinishes";
import { classifyMeshPart, getPartMaterial, type FinishPart } from "@/lib/visualiserFinishTargets";
import { meshKey, registerModelMeshes, usePartOverrides, type ModelMesh, type PartOverrides } from "@/lib/visualiserPartMapping";
import { applyModelOrientation, fitUprightModel, type ModelOrientation } from "@/lib/modelOrientation";
import { snapCoordinate } from "@/lib/visualiserPlacement";

export type PlacedObject = {
  instanceId: string;
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  dimensions: string | null;
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
  /** When true, swatch clicks, Clear, and preset restores leave this piece's finishes untouched. */
  finishesLocked?: boolean;
};

type Props = {
  object: PlacedObject;
  selected: boolean;
  onSelect: (instanceId: string) => void;
  onTransform: (instanceId: string, position: [number, number, number], rotation: [number, number, number]) => void;
  onDragStateChange: (dragging: boolean) => void;
  /** When true, dragged positions snap to the placement grid. */
  snapToGrid?: boolean;
  /** When false the piece is display-only: no drag, no gizmos. Defaults to true. */
  isEditable?: boolean;
  /** Optional non-uniform scale; overrides `object.scale` when provided. */
  scaleVector?: [number, number, number];
  /** Name-only annotation for generated room pieces; never includes pricing. */
  label?: string;
  /** Reports which texturable parts (top/base/upholstery) the GLB contains. */
  onTextureParts?: (instanceId: string, parts: FinishPart[]) => void;
};

type LoadedMaps = {
  diffuse: THREE.Texture | null;
  normal: THREE.Texture | null;
  roughness: THREE.Texture | null;
};

const EMPTY_MAPS: LoadedMaps = { diffuse: null, normal: null, roughness: null };

const disposeMaps = (m: LoadedMaps) => { m.diffuse?.dispose(); m.normal?.dispose(); m.roughness?.dispose(); };

async function loadMaterialMaps(material: VisualiserMaterial, maxAnisotropy: number): Promise<LoadedMaps> {
  const loader = new THREE.TextureLoader();
  const load = (url?: string | null) => url ? loader.loadAsync(url) : Promise.resolve(null);
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
    loadDiffuse(material.diffuse_url ?? material.image_url),
    load(material.normal_url),
    load(material.roughness_url),
  ]);
  // Furniture-scale tiling: a swatch tiled 6x on a side table reads as grey noise.
  const repeat = material.repeat ?? 2;
  for (const texture of [diffuse, normal, roughness]) {
    if (!texture) continue;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.anisotropy = maxAnisotropy;
    texture.needsUpdate = true;
  }
  if (diffuse) diffuse.colorSpace = THREE.SRGBColorSpace;
  if (normal) normal.colorSpace = THREE.NoColorSpace;
  if (roughness) roughness.colorSpace = THREE.NoColorSpace;
  return { diffuse, normal, roughness };
}

/**
 * Clone a GLB material and re-key it to the chosen finish.
 * Metals are given an envMapIntensity so they still read under IBL instead of
 * rendering solid black when no reflection source contributes.
 */
function clonePbrMaterial(source: THREE.Material, finish: VisualiserMaterial | null, maps: LoadedMaps, neutralFabric = false) {
  const original = source as THREE.MeshStandardMaterial;
  const material = original.clone();
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
    material.normalMap = maps.normal ?? original.normalMap;
    material.roughnessMap = maps.roughness ?? original.roughnessMap;
  }
  material.metalnessMap = isMetal ? null : original.metalnessMap;
  material.color.set(neutralFabric ? "#d8d4cc" : finish?.color ?? (maps.diffuse ? "#ffffff" : "#ffffff"));
  material.roughness = neutralFabric ? 0.96 : finish?.roughness ?? (isMetal ? 0.25 : 0.7);
  material.metalness = THREE.MathUtils.clamp(metalness, 0, 0.92);
  material.envMapIntensity = isMetal ? 1.8 : metalness > 0.2 ? 1.5 : 1;
  material.normalScale.set(0.22, 0.22);
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

/** Resolves every mesh to a finishable part: manual mapping → node name → own material group. */
function assignParts(root: THREE.Object3D, overrides: PartOverrides) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((c) => { if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh); });
  const matName = (m: THREE.Mesh) => {
    const src = Array.isArray(m.material) ? m.material[0] : m.material;
    return src?.name || src?.uuid || "";
  };
  const distinct = new Set(meshes.map(matName)).size;
  const groupLabels = new Map<string, string>();
  meshes.forEach((mesh, index) => {
    const nodeName = `${mesh.name} ${mesh.parent?.name ?? ""}`;
    const key = meshKey(index, mesh.name || mesh.parent?.name || "");
    // Unnamed meshes are still classifiable by their material name
    // (e.g. Man of Parts "WoodFinish" → frame, "Glides" → base).
    const named = classifyMeshPart(nodeName, matName(mesh));
    // Unnamed parts that carry their own GLB material are independently finishable.
    let auto: FinishPart | null = named;
    if (!auto && distinct > 1) {
      const g = `part:${matName(mesh)}`;
      if (!groupLabels.has(g)) groupLabels.set(g, `Part ${groupLabels.size + 1}`);
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
  const { scene } = useGLTF(url, "/draco/");
  const { gl } = useThree();
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
  const holder = useMemo(() => ({
    ...object,
    baseMaterial: object.baseMaterial ?? (isBondStreetStool(productId) ? BOND_STREET_BASE_FINISH : null),
  }), [object, productId]);
  const maps = useMaterialMapsMany([
    holder.material, holder.topMaterial, holder.baseMaterial, holder.upholsteryMaterial,
    ...Object.values(holder.partMaterials ?? {}),
  ], maxAnisotropy);
  const partOverrides = usePartOverrides(productId);
  return useMemo(() => {
    const clone = scene.clone(true);
    const groupLabels = assignParts(clone, partOverrides);
    clone.userData.groupLabels = Object.fromEntries(groupLabels);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const role = mesh.userData.partRole as FinishPart | null;
      // Upholstery never inherits the whole-piece finish; other parts fall back to it.
      const own = role ? getPartMaterial(holder, role) : null;
      const finish = role === "upholstery" ? own : own ?? holder.material ?? null;
      const neutralFabric = isBondStreetStool(productId) && role === "upholstery" && !own;
      if (!finish && !neutralFabric) return;
      const m = (finish && maps.get(finish.id)) || EMPTY_MAPS;
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = source.map((entry) => clonePbrMaterial(entry, finish, m, neutralFabric));
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
    return applyModelOrientation(fitUprightModel(clone, object.dimensions, url), object.modelOrientation);
  }, [scene, partOverrides, holder, maps, productId, object.dimensions, url, object.modelOrientation]);
}

const ModelBody = ({ object, label, onSelect, onTextureParts }: { object: PlacedObject; label?: string; onSelect: (id: string) => void; onTextureParts?: Props["onTextureParts"] }) => {
  const model = useFittedModel(object);
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
      materials.forEach((entry) => {
        if (entry?.userData?.visualiserClone) entry.dispose();
      });
    });
  }, [model]);
  return <>
    <primitive object={model} />
    {label && <Html position={labelPosition} center zIndexRange={[5, 0]}>
      <Button variant="outline" aria-label={`Select ${label}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect(object.instanceId); }} data-room-piece-label={object.instanceId} className="h-auto w-36 whitespace-normal bg-background/95 px-2 py-1.5 text-center text-[11px] leading-snug text-foreground shadow-sm break-words select-none">
        {label}
      </Button>
    </Html>}
    {object.finishesLocked && (
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

const ImageBody = ({ url, name, locked, instanceId }: { url: string; name: string; locked: boolean; instanceId: string }) => {
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
      {locked && (
        <Html position={[0, height + 0.25, 0]} center zIndexRange={[6, 1]}>
          <LockBadge instanceId={instanceId} />
        </Html>
      )}
    </>
  );
};

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const SceneObject = ({ object, selected, onSelect, onTransform, onDragStateChange, isEditable = true, scaleVector, label, onTextureParts, snapToGrid = false }: Props) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const [groupNode, setGroupNode] = useState<THREE.Group | null>(null);
  const { raycaster, gl, camera } = useThree();
  const draggingRef = useRef(false);
  const offsetRef = useRef(new THREE.Vector3());
  const hitRef = useRef(new THREE.Vector3());
  const pointerRef = useRef(new THREE.Vector2());
  // Latest floor height for the piece, readable from window-level drag listeners.
  const floorYRef = useRef(object.position[1] ?? 0);
  floorYRef.current = object.position[1] ?? 0;

  // Keep the group in sync when position changes from outside (e.g. reset/restore).
  useEffect(() => {
    if (groupRef.current && !draggingRef.current) {
      groupRef.current.position.set(object.position[0], object.position[1] ?? 0, object.position[2]);
    }
  }, [object.position]);


  const body = object.glb_url
    ? <ModelBody object={object} label={label} onSelect={onSelect} onTextureParts={onTextureParts} />
    : object.image_url
      ? <ImageBody url={object.image_url} name={object.product_name} locked={Boolean(object.finishesLocked)} instanceId={object.instanceId} />
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
    if (!isEditable) return;
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

  // Safety: never leave window drag listeners behind if the piece unmounts mid-drag.
  useEffect(() => () => {
    window.removeEventListener("pointermove", dragMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }, [dragMove, endDrag]);

  /** Persist the gizmo result back into React state (floor-locked, upright). */
  const commit = () => {
    const group = groupRef.current;
    if (!group) return;
    group.position.y = object.position[1] ?? 0;
    group.rotation.x = 0;
    group.rotation.z = 0;
    onTransform(
      object.instanceId,
      [group.position.x, object.position[1] ?? 0, group.position.z],
      [0, group.rotation.y, 0],
    );
  };

  const content = (
    <group
      ref={(node) => {
        groupRef.current = node;
        setGroupNode(node);
      }}
      position={[object.position[0], object.position[1] ?? 0, object.position[2]]}
      rotation={object.rotation}
      scale={scaleVector ?? object.scale}
      onPointerDown={handlePointerDown}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (isEditable && !draggingRef.current) gl.domElement.style.cursor = "grab";
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
          <TransformControls
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
              if (group) group.position.y = object.position[1] ?? 0;
            }}
          />
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
