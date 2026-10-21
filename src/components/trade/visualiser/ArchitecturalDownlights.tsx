import type { ThreeElements } from "@react-three/fiber";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/** Warm 2700K recessed downlights hidden in the ceiling plane, tight cones onto the floor. */
export const DOWNLIGHT = {
  y: 7.3, cols: 4, rows: 3, spanX: 9, spanZ: 7, centerZ: -0.5,
  color: "#ffc98f", intensity: 18, angle: 0.32, penumbra: 0.45, distance: 11, decay: 2,
} as const;

const Downlight = ({ x, z, scale }: { x: number; z: number; scale: number }) => {
  const light = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    target.position.set(x, 0, z);
    target.updateMatrixWorld();
    if (light.current) light.current.target = target;
  }, [target, x, z]);
  return (
    <group>
      <primitive object={target} />
      <spotLight ref={light} position={[x, DOWNLIGHT.y, z]} color={DOWNLIGHT.color} intensity={DOWNLIGHT.intensity * scale} angle={DOWNLIGHT.angle} penumbra={DOWNLIGHT.penumbra} distance={DOWNLIGHT.distance} decay={DOWNLIGHT.decay} />
      {/* Tiny recessed trim so the source reads as a fitting, not a floating light. */}
      <mesh position={[x, DOWNLIGHT.y + 0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.06, 20]} />
        <meshBasicMaterial color={DOWNLIGHT.color} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const ArchitecturalDownlights = ({ lightScale = 1 }: { lightScale?: number }) => {
  const points = useMemo(() => {
    const out: [number, number][] = [];
    for (let c = 0; c < DOWNLIGHT.cols; c++) for (let r = 0; r < DOWNLIGHT.rows; r++) {
      out.push([
        -DOWNLIGHT.spanX / 2 + (DOWNLIGHT.spanX * c) / (DOWNLIGHT.cols - 1),
        DOWNLIGHT.centerZ - DOWNLIGHT.spanZ / 2 + (DOWNLIGHT.spanZ * r) / (DOWNLIGHT.rows - 1),
      ]);
    }
    return out;
  }, []);
  return <group name="architectural-downlights">{points.map(([x, z]) => <Downlight key={`${x}:${z}`} x={x} z={z} scale={lightScale} />)}</group>;
};

export default ArchitecturalDownlights;
