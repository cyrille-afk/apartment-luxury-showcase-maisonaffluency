import { ARCHITECTURE, type architecturalRoomLayout } from "@/lib/visualiserArchitecture";
import { FEATURE_WALL } from "@/lib/visualiserFeatureWall";

type Layout = ReturnType<typeof architecturalRoomLayout>;

/** Low-poly structural geometry, shared by live and physical renderers. */
export default function ArchitecturalMezzanine({ layout, width, rearZ }: { layout: Layout; width: number; rearZ: number }) {
  const balconyWidth = Math.min(width, 24);
  const balconyCenterZ = rearZ + ARCHITECTURE.balconyDepth / 2;
  const glassY = layout.balconyY + ARCHITECTURE.slabThickness / 2 + ARCHITECTURE.railingHeight / 2;
  return (
    <group name="architectural-room-structure">
      <mesh name="mezzanine-balcony-slab" position={[0, layout.balconyY, balconyCenterZ]} castShadow receiveShadow>
        <boxGeometry args={[balconyWidth, ARCHITECTURE.slabThickness, ARCHITECTURE.balconyDepth]} />
        <meshStandardMaterial color={FEATURE_WALL.stone} roughness={0.72} metalness={0} />
      </mesh>
      {/* Continuous clear glass, with discreet metal caps and panel joints. */}
      {Array.from({ length: 12 }, (_, index) => (
        <mesh key={index} name={`mezzanine-glass-panel-${index + 1}`} position={[(index - 5.5) * balconyWidth / 12, glassY, layout.balconyFrontZ]} castShadow receiveShadow>
          <boxGeometry args={[balconyWidth / 12 - 0.012, ARCHITECTURE.railingHeight, ARCHITECTURE.glassThickness]} />
          <meshPhysicalMaterial color={FEATURE_WALL.stone} roughness={0.04} metalness={0} transmission={1} thickness={ARCHITECTURE.glassThickness} ior={1.5} envMapIntensity={1} />
        </mesh>
      ))}
      <mesh name="mezzanine-railing-cap" position={[0, glassY + ARCHITECTURE.railingHeight / 2, layout.balconyFrontZ]} castShadow>
        <boxGeometry args={[balconyWidth, 0.025, 0.035]} />
        <meshStandardMaterial color={FEATURE_WALL.reveal} roughness={0.25} metalness={0.8} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} name={`mezzanine-rear-support-${side}`} position={[side * (balconyWidth / 2 - 0.4), layout.balconyY / 2, balconyCenterZ]} castShadow receiveShadow>
          <boxGeometry args={[0.5, layout.balconyY, 0.5]} />
          <meshStandardMaterial color={FEATURE_WALL.stone} roughness={0.72} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}