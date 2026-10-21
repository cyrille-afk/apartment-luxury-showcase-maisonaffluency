import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo } from "react";
import * as THREE from "three";
import { SHOWROOM } from "@/lib/showroomRendering";
import { CEILING, recessedCeilingGeometry, safeCeilingDimensions } from "@/lib/recessedCeiling";
import { clampCeilingHeight, clampCeilingOpening, clampCeilingThickness, type CeilingSettings } from "@/lib/visualiserCeilingSettings";

class CeilingErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Recessed ceiling disabled after a geometry error", error, info);
  }
  override render() { return this.state.failed ? null : this.props.children; }
}

/** Area lights approximate ceiling bounce; emissive strips alone cannot light WebGL geometry. */
function RecessedCeilingGeometry({ radius, height, ceilingHeight, ceilingThickness, ceilingOpening }: { radius: number; height: number } & CeilingSettings) {
  const thickness = clampCeilingThickness(ceilingThickness);
  const opening = clampCeilingOpening(ceilingOpening);
  const dimensions = safeCeilingDimensions(radius, thickness, opening);
  const geometry = useMemo(() => dimensions ? recessedCeilingGeometry(dimensions.radius, dimensions.thickness, opening) : null, [dimensions?.radius, dimensions?.thickness, opening]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry || !dimensions || !Number.isFinite(height)) return null;
  const { inner } = dimensions;
  // Never lower than 2.6 m so the frame can't slice through seating.
  const lipY = Math.max(2.6, clampCeilingHeight(ceilingHeight) ?? height - CEILING.recess);
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

/** Ceiling failures stay isolated; floor, rug and furniture remain mounted. */
export default function RecessedCeiling(props: { radius: number; height: number } & CeilingSettings) {
  return <CeilingErrorBoundary><RecessedCeilingGeometry {...props} /></CeilingErrorBoundary>;
}