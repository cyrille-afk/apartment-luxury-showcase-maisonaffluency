import { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, PerspectiveCamera, Html } from "@react-three/drei";
import SceneObject, { type PlacedObject } from "@/components/trade/visualiser/SceneObject";

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
}

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
}: VisualiserCanvasProps) => (
  <Canvas
    shadows
    gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
    dpr={[1, 2]}
    onPointerMissed={() => onSelect(null)}
  >
    <PerspectiveCamera makeDefault fov={50} position={[0, 5, 10]} near={0.1} far={200} />
    <OrbitControls
      makeDefault
      enabled={orbitEnabled}
      enablePan
      enableDamping
      dampingFactor={0.08}
      minDistance={1.5}
      maxDistance={24}
      maxPolarAngle={Math.PI / 2.05}
      target={[0, 0.6, 0]}
    />

    <ambientLight intensity={0.5} />
    <directionalLight
      position={[5, 10, 5]}
      intensity={1.2}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-far={40}
      shadow-camera-left={-12}
      shadow-camera-right={12}
      shadow-camera-top={12}
      shadow-camera-bottom={-12}
      shadow-bias={-0.0005}
    />
    <hemisphereLight args={["#ffffff", "#d8d3cb", 0.35]} />

    {/* Local IBL: metals need reflections or they render solid black. */}
    <Environment resolution={256}>
      <Lightformer intensity={2.2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} color="#ffffff" />
      <Lightformer intensity={1.1} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[14, 6, 1]} color="#f4efe7" />
      <Lightformer intensity={0.9} position={[6, 2, -2]} rotation-y={-Math.PI / 2} scale={[14, 6, 1]} color="#e8e3da" />
      <Lightformer intensity={0.6} position={[0, -3, 0]} rotation-x={-Math.PI / 2} scale={[14, 14, 1]} color="#d8d3cb" />
    </Environment>

    {!hasBackdrop && (
      <ContactShadows
        position={[0, 0.002, 0]}
        scale={40}
        opacity={0.32}
        blur={1}
        far={12}
        resolution={1024}
        depthWrite={false}
      />
    )}
    {/* Invisible shadow-catcher floor: lets the backdrop's own flooring read through the shadows. */}
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[80, 80]} />
      <shadowMaterial transparent opacity={0.4} />
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
        />
      ))}
    </Suspense>
  </Canvas>
);

export default VisualiserCanvas;
