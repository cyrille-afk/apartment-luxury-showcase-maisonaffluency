import { ARCHITECTURAL_RENDERING as R } from "@/lib/visualiserArchitecturalRendering";

/** A recessed dark return below a lifted wall, not an overlapping floor overlay. */
export default function ArchitecturalShadowGap({ width, position, rotation = 0 }: { width: number; position: [number, number, number]; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh name="architectural-shadow-gap" position={[0, R.shadowGapHeight / 2, -R.shadowGapRecess]} receiveShadow>
      <boxGeometry args={[width, R.shadowGapHeight, 0.008]} />
      <meshStandardMaterial color={R.shadowGapColor} roughness={0.95} metalness={0} />
    </mesh>
  </group>;
}