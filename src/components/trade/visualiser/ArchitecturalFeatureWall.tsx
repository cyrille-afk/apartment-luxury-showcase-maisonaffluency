import { useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import ProceduralWallMaterial from "./ProceduralWallMaterial";
import { FEATURE_WALL, featureWallLayout, type FeatureWallFinish } from "@/lib/visualiserFeatureWall";
import { architecturalRoomLayout } from "@/lib/visualiserArchitecture";
import ArchitecturalMezzanine from "./ArchitecturalMezzanine";

/** Rear stone perimeter with a double-height gallery and lightweight balcony. */
export default function ArchitecturalFeatureWall({ finish = "travertine" }: { finish?: FeatureWallFinish }) {
  const invalidate = useThree((s) => s.invalidate);
  const [layout, setLayout] = useState(() => featureWallLayout(new THREE.Box3()));
  const [room, setRoom] = useState(() => architecturalRoomLayout(new THREE.Box3(), FEATURE_WALL.rearZ));
  const bounds = useMemo(() => new THREE.Box3(), []);
  useFrame(({ scene }) => {
    bounds.makeEmpty();
    scene.traverse((node) => {
      if (!node.userData.visualiserInstanceId) return;
      node.updateWorldMatrix(true, true);
      bounds.union(new THREE.Box3().setFromObject(node));
    });
    const next = featureWallLayout(bounds);
    const nextRoom = architecturalRoomLayout(bounds, next.frontZ);
    if (JSON.stringify(nextRoom) !== JSON.stringify(room)) { setRoom(nextRoom); invalidate(); }
    if (Object.keys(next).some((key) => Math.abs(next[key as keyof typeof next] - layout[key as keyof typeof layout]) > 0.001)) {
      setLayout(next);
      invalidate();
    }
  }, -0.5);
  return (
    <group name="architectural-interior">
    <ArchitecturalMezzanine layout={room} width={layout.width} rearZ={layout.frontZ} />
    <group name="architectural-feature-wall" position={[layout.centerX, 0, layout.frontZ]}>
      {/* Recessed mineral backing leaves two narrow, genuinely inset joints. */}
      <mesh name="feature-wall-recess" position={[0, room.height / 2, -FEATURE_WALL.thickness - 0.018]} receiveShadow>
        <boxGeometry args={[layout.width, room.height, 0.02]} />
        <meshStandardMaterial color={FEATURE_WALL.reveal} roughness={1} metalness={0} />
      </mesh>
      {Array.from({ length: FEATURE_WALL.panels }, (_, i) => (
        <mesh key={i} name={`feature-wall-slab-${finish}-${i + 1}`} position={[(i - 1) * (layout.panelWidth + FEATURE_WALL.gap), room.height / 2, -FEATURE_WALL.thickness / 2]} castShadow receiveShadow>
          <boxGeometry args={[layout.panelWidth, room.height, FEATURE_WALL.thickness]} />
          <ProceduralWallMaterial finish={finish} width={layout.panelWidth} height={room.height} />
        </mesh>
      ))}
    </group>
    </group>
  );
}
