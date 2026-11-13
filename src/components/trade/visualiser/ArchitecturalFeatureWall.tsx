import { useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import ProceduralWallMaterial from "./ProceduralWallMaterial";
import ArchitecturalShadowGap from "./ArchitecturalShadowGap";
import { ARCHITECTURAL_RENDERING as R } from "@/lib/visualiserArchitecturalRendering";
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
      <ArchitecturalShadowGap width={layout.width} position={[0, 0, 0]} />
      <mesh name={`feature-wall-continuous-${finish}`} position={[0, (room.height + R.shadowGapHeight) / 2, -FEATURE_WALL.thickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[layout.width, room.height - R.shadowGapHeight, FEATURE_WALL.thickness]} />
        <ProceduralWallMaterial finish={finish} width={layout.width} height={room.height} />
      </mesh>
    </group>
    </group>
  );
}
