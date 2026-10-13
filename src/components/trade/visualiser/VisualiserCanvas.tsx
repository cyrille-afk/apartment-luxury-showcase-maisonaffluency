import { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls, PerspectiveCamera, Html } from "@react-three/drei";
import type { FinishPart } from "@/lib/visualiserFinishTargets";
import SceneObject, { type PlacedObject } from "@/components/trade/visualiser/SceneObject";
import { footprintRadius, floorFocusPoint } from "@/lib/visualiserPlacement";
import * as THREE from "three";
import { EffectComposer, DepthOfField } from "@react-three/postprocessing";

/** Exposes a getter for the floor point at the centre of the camera view (raycast onto Y = 0). */
const FloorFocusReporter = ({ focusRef }: { focusRef: { current: (() => [number, number] | null) | null } }) => {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target?: THREE.Vector3 } | null;
  useEffect(() => {
    focusRef.current = () => {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const hit = floorFocusPoint([camera.position.x, camera.position.y, camera.position.z], [dir.x, dir.y, dir.z]);
      if (hit) return hit;
      return controls?.target ? [controls.target.x, controls.target.z] : null;
    };
    return () => { focusRef.current = null; };
  }, [camera, controls, focusRef]);
  return null;
};
import { parseDimensionString } from "@/lib/productDimensions";

const microLabel = "text-[10px] uppercase tracking-[0.15em]";

/**
 * The canvas runs on `frameloop="demand"` so it does not burn a frame every
 * 16ms while the designer is doing something else (typing to Felix, reading
 * the ledger). This helper re-renders exactly when the scene actually changes
 * or while the pointer is interacting with it.
 */
const RenderOnDemand = ({ signature }: { signature: string }) => {
  const invalidate = useThree((s) => s.invalidate);
  const domElement = useThree((s) => s.gl.domElement);

  useEffect(() => {
    // Two frames: one for the state change, one after any texture/material swap.
    invalidate();
    const id = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(id);
  }, [invalidate, signature]);

  useEffect(() => {
    const kick = () => invalidate();
    domElement.addEventListener("pointermove", kick);
    domElement.addEventListener("pointerdown", kick);
    domElement.addEventListener("wheel", kick, { passive: true });
    window.addEventListener("pointerup", kick);
    return () => {
      domElement.removeEventListener("pointermove", kick);
      domElement.removeEventListener("pointerdown", kick);
      domElement.removeEventListener("wheel", kick);
      window.removeEventListener("pointerup", kick);
    };
  }, [domElement, invalidate]);

  return null;
};

const SceneLoader = () => (
  <Html center>
    <span className={`${microLabel} text-muted-foreground`}>Loading asset…</span>
  </Html>
);

interface VisualiserCanvasProps {
  objects: PlacedObject[];
  selectedId: string | null;
  orbitEnabled: boolean;
  hasBackdrop: boolean;
  onSelect: (id: string | null) => void;
  onTransform: (instanceId: string, position: [number, number, number], rotation: [number, number, number]) => void;
  onDragStateChange: (dragging: boolean) => void;
  onTextureParts?: (instanceId: string, parts: FinishPart[]) => void;
  /** When true, dragged pieces snap to the placement grid. */
  snapToGrid?: boolean;
  /** When true, the faint design-canvas floor grid renders at Y = 0. */
  showGrid?: boolean;
  /** Filled with a getter returning the floor point the camera is looking at. */
  focusRef?: { current: (() => [number, number] | null) | null };
  /** Subtle background blur focused on the selected piece (or orbit target). */
  depthOfField?: boolean;
}

const DofPass = ({ focus }: { focus: [number, number, number] | null }) => {
  const controls = useThree((s) => s.controls) as unknown as { target?: THREE.Vector3 } | null;
  const target = focus ? new THREE.Vector3(...focus) : controls?.target?.clone() ?? new THREE.Vector3(0, 0.5, 0);
  return (
    <EffectComposer multisampling={4}>
      <DepthOfField target={target} focalLength={0.03} bokehScale={3} height={720} />
    </EffectComposer>
  );
};

/**
 * Heavy WebGL layer. Kept in its own module so React Three Fiber, drei and
 * three.js are code-split out of the main bundle and only fetched when the
 * Visualiser route actually mounts.
 */
const VisualiserCanvas = ({
  objects,
  selectedId,
  orbitEnabled,
  hasBackdrop,
  onSelect,
  onTransform,
  onDragStateChange,
  onTextureParts,
  snapToGrid = false,
  showGrid = true,
  focusRef,
  depthOfField = false,
}: VisualiserCanvasProps) => (
  <Canvas
    shadows={{ type: THREE.PCFSoftShadowMap }}
    frameloop="demand"
    gl={{
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.05,
      outputColorSpace: THREE.SRGBColorSpace,
    }}
    dpr={[1, 1.5]}
    onPointerMissed={() => onSelect(null)}
  >
    <RenderOnDemand
      signature={`${selectedId ?? ""}|${hasBackdrop}|${orbitEnabled}|${showGrid}|${depthOfField}|${objects
        .map(
          (o) =>
            `${o.instanceId}:${o.position?.join(",")}:${o.rotation?.join(",")}:${o.scale}:${o.modelOrientation?.join(",")}` +
            `:${o.material?.id ?? ""}:${o.topMaterial?.id ?? ""}:${o.baseMaterial?.id ?? ""}:${o.upholsteryMaterial?.id ?? ""}:${JSON.stringify(o.partMaterials ?? {})}:${o.positionLocked ?? false}`,
        )
        .join("|")}`}
    />
    {focusRef && <FloorFocusReporter focusRef={focusRef} />}
    <PerspectiveCamera makeDefault fov={45} position={[0, 3.4, 9.5]} near={0.1} far={200} />
    <OrbitControls
      makeDefault
      enabled={orbitEnabled}
      enablePan
      enableDamping={false}
      minDistance={1.5}
      maxDistance={24}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI / 2.2}
      target={[0, 0.5, 0]}
    />

    {/* Weak ambient keeps crevices dark; three-point rig does the shaping. */}
    <ambientLight intensity={0.2} />
    {/* Key: soft window light, front-left, casts the shadows. */}
    <directionalLight
      position={[-6, 9, 6]}
      intensity={1.6}
      color="#fff6ea"
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-far={40}
      shadow-camera-left={-12}
      shadow-camera-right={12}
      shadow-camera-top={12}
      shadow-camera-bottom={-12}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    />
    {/* Fill: opposite side, low and cool. */}
    <directionalLight position={[7, 4, 4]} intensity={0.35} color="#e6ecf5" />
    {/* Rim: behind the pieces to lift silhouettes. */}
    <directionalLight position={[0, 6, -9]} intensity={0.7} color="#ffffff" />
    <hemisphereLight args={["#ffffff", "#d8d3cb", 0.2]} />

    {/* Local IBL: metals need reflections or they render solid black. */}
    <Environment resolution={512}>
      <Lightformer intensity={2.2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} color="#ffffff" />
      <Lightformer intensity={1.1} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[14, 6, 1]} color="#f4efe7" />
      <Lightformer intensity={0.9} position={[6, 2, -2]} rotation-y={-Math.PI / 2} scale={[14, 6, 1]} color="#e8e3da" />
      <Lightformer intensity={0.6} position={[0, -3, 0]} rotation-x={-Math.PI / 2} scale={[14, 14, 1]} color="#d8d3cb" />
    </Environment>

    {!hasBackdrop && (
      <ContactShadows
        position={[0, 0.002, 0]}
        scale={40}
        opacity={0.45}
        blur={2.6}
        far={4}
        resolution={1024}
        depthWrite={false}
      />
    )}
    {/* Faint floor grid at Y = 0 — the design-canvas ground reference. Hideable for room-photo backdrops. */}
    {showGrid && (
      <Grid
        position={[0, 0.001, 0]}
        infiniteGrid
        cellSize={0.25}
        cellThickness={0.5}
        cellColor="#E5E7EB"
        sectionSize={1}
        sectionThickness={0.8}
        sectionColor="#D1D5DB"
        fadeDistance={30}
        fadeStrength={1.5}
        followCamera={false}
      />
    )}
    {/* Invisible shadow-catcher floor: lets the backdrop's own flooring read through the shadows. */}
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[80, 80]} />
      <shadowMaterial transparent opacity={0.28} />
    </mesh>

    <Suspense fallback={<SceneLoader />}>
      {objects.map((object) => (
        <SceneObject
          key={object.instanceId}
          object={object}
          selected={object.instanceId === selectedId}
          onSelect={onSelect}
          onTransform={onTransform}
          onDragStateChange={onDragStateChange}
          onTextureParts={onTextureParts}
          snapToGrid={snapToGrid}
          selfRadius={footprintRadius(parseDimensionString(object.dimensions), object.scale)}
          obstacles={objects
            .filter((other) => other.instanceId !== object.instanceId)
            .map((other) => ({
              position: other.position,
              radius: footprintRadius(parseDimensionString(other.dimensions), other.scale),
            }))}
        />
      ))}
    </Suspense>
    {depthOfField && (
      <DofPass
        focus={(() => {
          const sel = objects.find((o) => o.instanceId === selectedId);
          return sel?.position ? [sel.position[0], 0.4, sel.position[2]] : null;
        })()}
      />
    )}
  </Canvas>
);

export default VisualiserCanvas;
