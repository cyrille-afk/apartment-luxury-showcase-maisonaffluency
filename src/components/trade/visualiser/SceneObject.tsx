import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { applyMarbleSurface } from "@/lib/visualiserMarbleSurface";
import type { MarbleSurfaceSettings } from "@/lib/visualiserMarbleSettings";
import { Html, useGLTF, useTexture, TransformControls } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import { type FinishPart } from "@/lib/visualiserFinishTargets";
import { registerModelMeshes, usePartOverrides, type ModelMesh } from "@/lib/visualiserPartMapping";
import { type ModelOrientation } from "@/lib/modelOrientation";
import { clampToRoom, type RoomBounds } from "@/lib/activeProjectLayout";
import { snapCoordinate, resolveDragPosition, DEFAULT_FOOTPRINT_RADIUS, type FootprintObstacle } from "@/lib/visualiserPlacement";
import { withCachedModelLoader } from "@/lib/visualiserModelCache";
import { resolveDimensions } from "@/lib/productDimensions";
import { prepareVisualiserModel } from "@/lib/visualiserPreparationClient";

export { isStoneMaterial } from "@/lib/visualiserModelPreparation";

export type PlacedObject = {
  instanceId: string;
  /** Configured Project Assets entry that spawned this placement. */
  inventoryInstanceId?: string;
  /** Bumped by "Restore piece" to remount the mesh and rebuild its materials. */
  restoreKey?: number;
  id: string;
  source_pick_id?: string | null;
  category?: string | null;
  subcategory?: string | null;
  /** Exact unlocked Project Studio / Specsheet board row, when this placement came from one. */
  specItemId?: string | null;
  /** Live EUR RRP snapshot; catalogue hydration replaces it whenever fresher pricing arrives. */
  retailEurCents?: number | null;
  product_name: string;
  productType?: string;
  selectedUpholstery?: string | null;
  selectedFrameFinish?: string | null;
  variantLabel?: string | null;
  finishes?: string[];
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
  /** Opt-in exact catalogue fit for Curated Room Layout; Sandbox keeps authored ratios. */
  exactDimensionsM?: { w: number; d: number; h: number };
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
  /** Designated first-load anchor for sequential room assembly. */
  isAnchor?: boolean;
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
  /** Room walls: drags stay inside these bounds (centre origin). */
  roomLimits?: RoomBounds;
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

/** Geometry and finish work completes in the worker before admitting this piece. */
function useFittedModel(object: PlacedObject): THREE.Object3D | null {
  const { scene } = useGLTF(object.glb_url ?? "", "/draco/", undefined, withCachedModelLoader);
  const { gl, invalidate } = useThree();
  const overrides = usePartOverrides(object.id);
  const configuration = JSON.stringify({ id: object.id, product_name: object.product_name, glb_url: object.glb_url, dimensions: object.dimensions, width_mm: object.width_mm, depth_mm: object.depth_mm, height_mm: object.height_mm, size_variants: object.size_variants, exactDimensionsM: object.exactDimensionsM, modelOrientation: object.modelOrientation, material: object.material, topMaterial: object.topMaterial, baseMaterial: object.baseMaterial, upholsteryMaterial: object.upholsteryMaterial, partMaterials: object.partMaterials });
  const [prepared, setPrepared] = useState<{ configuration: string; model: THREE.Object3D } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let owned: THREE.Object3D | null = null;
    setError(null);
    void prepareVisualiserModel(scene, JSON.parse(configuration), overrides, gl.capabilities.getMaxAnisotropy(), controller.signal).then(model => {
      if (controller.signal.aborted) { disposePreparedModel(model); return; }
      owned = model;
      setPrepared({ configuration, model });
      invalidate();
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error("The furniture could not be prepared.")); });
    return () => { controller.abort(); const previous = owned; if (previous) queueMicrotask(() => disposePreparedModel(previous)); };
  }, [scene, configuration, overrides, gl, invalidate]);
  if (error) throw error;
  return prepared && prepared.configuration === configuration ? prepared.model : null;
}

function disposePreparedModel(model: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  model.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      material.dispose();
    }
  });
  for (const texture of textures) { if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) texture.image.close(); texture.dispose(); }
}

const ModelBody = ({ object, label, showLabels = true, onSelect, onTextureParts }: { object: PlacedObject; label?: string; showLabels?: boolean; onSelect: (id: string) => void; onTextureParts?: Props["onTextureParts"] }) => {
  const model = useFittedModel(object);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    if (!model) return;
    applyMarbleSurface(model, object.product_name, object.marbleSurface);
    invalidate();
  }, [model, object.product_name, object.marbleSurface, invalidate]);
  useEffect(() => {
    if (!model) return;
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
    if (!model) return [0, 0, 0];
    const bounds = new THREE.Box3().setFromObject(model);
    const centre = bounds.getCenter(new THREE.Vector3());
    return [centre.x, bounds.max.y + 0.18, centre.z];
  }, [model]);
  // Lock badge floats above the room label (or the piece itself) while finishes are protected.
  const lockPosition = useMemo<[number, number, number]>(() => {
    if (!model) return [0, 0, 0];
    const bounds = new THREE.Box3().setFromObject(model);
    const centre = bounds.getCenter(new THREE.Vector3());
    return [centre.x, bounds.max.y + (label ? 0.55 : 0.18), centre.z];
  }, [model, label]);
  if (!model) return <group userData={{ visualiserInitialReady: false, visualiserPreparationPending: true }} />;
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

const FLOOR_Y = 0;

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

/** Clip only editor handles, never product geometry or its materials. */
const clipFloorGizmo = (controls: THREE.Object3D | null) => {
  controls?.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(material => { material.clippingPlanes = [FLOOR_PLANE]; material.needsUpdate = true; });
  });
};

const SceneObject = ({ object, selected, onSelect, onTransform, onDragStateChange, isEditable = true, scaleVector, label, showLabels = true, onTextureParts, snapToGrid = false, obstacles, selfRadius, roomLimits }: Props) => {
  // Refs so the window-level drag handlers always read the latest obstacles
  // without changing dragMove's identity mid-drag (listener removal depends on it).
  const obstaclesRef = useRef<FootprintObstacle[]>(obstacles ?? []);
  obstaclesRef.current = obstacles ?? [];
  const selfRadiusRef = useRef(selfRadius ?? DEFAULT_FOOTPRINT_RADIUS);
  selfRadiusRef.current = selfRadius ?? DEFAULT_FOOTPRINT_RADIUS;
  const roomLimitsRef = useRef<RoomBounds | undefined>(roomLimits);
  roomLimitsRef.current = roomLimits;
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
  const invalidateFrame = useThree((state) => state.invalidate);
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
    if (roomLimitsRef.current) [x, z] = clampToRoom(x, z, roomLimitsRef.current, selfRadiusRef.current);
    // Floor lock: X/Z translation only, y stays on its depth layer.
    group.position.set(x, floorYRef.current, z);
    // Demand frameloop: redraw so cast and contact shadows move with the piece mid-drag.
    invalidateFrame();
  }, [gl, raycaster, camera, snapToGrid, invalidateFrame]);

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
    invalidateFrame();
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
            ref={clipFloorGizmo}
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
              invalidateFrame();
            }}
          />}
          {/* Outer ring: free 360° yaw so the piece can be aligned to the backdrop perspective. */}
          <TransformControls
            ref={clipFloorGizmo}
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
              invalidateFrame();
            }}
          />
        </>
      )}
    </>
  );
};

export default SceneObject;
