import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SHOWROOM } from "@/lib/showroomRendering";
import { CEILING, recessedCeilingGeometry } from "@/lib/recessedCeiling";
import { clampCeilingHeight, clampCeilingOpening, clampCeilingThickness, type CeilingSettings } from "@/lib/visualiserCeilingSettings";

/** Area lights approximate ceiling bounce; emissive strips alone cannot light WebGL geometry. */
export default function RecessedCeiling({ radius, height, ceilingHeight, ceilingThickness, ceilingOpening }: { radius: number; height: number } & CeilingSettings) {
  const thickness = clampCeilingThickness(ceilingThickness);
  const opening = clampCeilingOpening(ceilingOpening);
  const geometry = useMemo(() => recessedCeilingGeometry(radius, thickness, opening), [radius, thickness, opening]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const inner = radius * opening / 100;
  const lipY = clampCeilingHeight(ceilingHeight) ?? height - CEILING.recess;
  const pocketY = lipY + CEILING.recess;
  return <group name="architectural-recessed-ceiling">
    <mesh name="dropped-ceiling-frame" position={[0, lipY, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={geometry} receiveShadow>
      <meshStandardMaterial color={SHOWROOM.plaster} roughness={CEILING.roughness} metalness={0} />
    </mesh>
    <mesh name="recessed-ceiling-pocket" position={[0, pocketY, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[inner * 2 + 0.4, inner * 2 + 0.4]} />
      <meshStandardMaterial color={SHOWROOM.plaster} roughness={CEILING.roughness} metalness={0} side={THREE.DoubleSide} />
    </mesh>
    <rectAreaLight name="diffuse-ceiling-return" position={[0, lipY - 0.4, 0]} rotation={[Math.PI / 2, 0, 0]} width={radius * 2} height={radius * 2} intensity={0.65} color={CEILING.glow} />
    {[0, 1, 2, 3].map((side) => <group key={side} rotation={[0, side * Math.PI / 2, 0]}>
      {/* Above the solid ledge, facing up: the dropped frame hides the source. */}
      <mesh name={`concealed-ceiling-strip-${side}`} position={[0, lipY + 0.055, inner + 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[inner * 2, 0.035]} />
        <meshStandardMaterial color={CEILING.glow} emissive={CEILING.glow} emissiveIntensity={4} roughness={0.9} metalness={0} />
      </mesh>
      <rectAreaLight name={`recess-upwash-${side}`} position={[0, lipY + 0.06, inner + 0.04]} rotation={[Math.PI / 2, 0, 0]} width={inner * 2} height={0.12} intensity={5} color={CEILING.glow} />
      {/* Broad return light represents diffuse plaster bounce, not a direct beam. */}
      <rectAreaLight name={`recess-bounce-${side}`} position={[0, pocketY - 0.015, inner - 0.3]} rotation={[-Math.PI / 2, 0, 0]} width={inner * 2} height={0.6} intensity={0.35} color={CEILING.glow} />
    </group>)}
  </group>;
}