import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SHOWROOM } from "@/lib/showroomRendering";
import { CEILING, recessedCeilingGeometry } from "@/lib/recessedCeiling";

/** Area lights approximate ceiling bounce; emissive strips alone cannot light WebGL geometry. */
export default function RecessedCeiling({ radius, height }: { radius: number; height: number }) {
  const geometry = useMemo(() => recessedCeilingGeometry(radius), [radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const inner = radius - CEILING.ledge;
  const lipY = height - CEILING.recess;
  return <group name="architectural-recessed-ceiling">
    <mesh name="dropped-ceiling-frame" position={[0, lipY, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={SHOWROOM.plaster} roughness={CEILING.roughness} metalness={0} />
    </mesh>
    <mesh name="recessed-ceiling-pocket" position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[inner * 2 + 0.4, inner * 2 + 0.4]} />
      <meshStandardMaterial color={SHOWROOM.plaster} roughness={CEILING.roughness} metalness={0} side={THREE.DoubleSide} />
    </mesh>
    {[0, 1, 2, 3].map((side) => <group key={side} rotation={[0, side * Math.PI / 2, 0]}>
      {/* Above the solid ledge, facing up: the dropped frame hides the source. */}
      <mesh name={`concealed-ceiling-strip-${side}`} position={[0, lipY + 0.055, inner + 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[inner * 2, 0.035]} />
        <meshStandardMaterial color={CEILING.glow} emissive={CEILING.glow} emissiveIntensity={4} roughness={0.9} metalness={0} />
      </mesh>
      <rectAreaLight name={`recess-upwash-${side}`} position={[0, lipY + 0.06, inner + 0.04]} rotation={[Math.PI / 2, 0, 0]} width={inner * 2} height={0.12} intensity={5} color={CEILING.glow} />
      {/* Broad return light represents diffuse plaster bounce, not a direct beam. */}
      <rectAreaLight name={`recess-bounce-${side}`} position={[0, height - 0.015, inner - 0.3]} rotation={[-Math.PI / 2, 0, 0]} width={inner * 2} height={0.6} intensity={0.35} color={CEILING.glow} />
    </group>)}
  </group>;
}