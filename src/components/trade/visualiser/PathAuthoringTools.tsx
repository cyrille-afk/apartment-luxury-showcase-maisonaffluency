import { useEffect, type MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import { Line, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CustomPathNode } from "@/lib/customCameraPaths";
import { vec3 } from "@/lib/customCameraPaths";

export type CameraSampler = () => CustomPathNode | null;

/** Exposes a sampler reading state.camera.position and controls.target at click time. */
export function CameraSamplerBridge({ samplerRef }: { samplerRef: MutableRefObject<CameraSampler | null> }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  useEffect(() => {
    samplerRef.current = () => {
      const target = controls?.target.clone() ?? new THREE.Vector3(0, 0.6, 0);
      return { position: vec3(camera.position.clone()), target: vec3(target) };
    };
    return () => { samplerRef.current = null; };
  }, [camera, controls, samplerRef]);
  return null;
}

/** Top-down orthographic camera + ground-plane click capture. */
export function FloorPlanDrawLayer({ width, length, onPick }: { width: number; length: number; onPick: (x: number, z: number) => void }) {
  return (
    <>
      <OrthographicCamera makeDefault position={[0, 20, 0]} up={[0, 0, -1]} zoom={Math.min(70, 520 / Math.max(width, length))} near={0.1} far={100}
        onUpdate={(c) => c.lookAt(0, 0, 0)} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}
        onPointerDown={(e) => { e.stopPropagation(); onPick(+e.point.x.toFixed(3), +e.point.z.toFixed(3)); }}>
        <planeGeometry args={[width, length]} />
        <meshBasicMaterial transparent opacity={0.06} color="#888888" />
      </mesh>
    </>
  );
}

/** Visual guide for authored nodes in either mode. */
export function PathNodesGuide({ nodes }: { nodes: CustomPathNode[] }) {
  if (!nodes.length) return null;
  return (
    <>
      {nodes.map((n, i) => (
        <mesh key={i} position={n.position}><sphereGeometry args={[0.08, 16, 16]} /><meshBasicMaterial color="#b08d57" /></mesh>
      ))}
      {nodes.length > 1 && <Line points={nodes.map((n) => n.position)} color="#b08d57" lineWidth={2} dashed dashSize={0.15} gapSize={0.1} />}
    </>
  );
}
