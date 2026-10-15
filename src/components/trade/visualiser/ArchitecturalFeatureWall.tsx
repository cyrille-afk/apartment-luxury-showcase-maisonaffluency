import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import travertine from "@/assets/architectural-travertine.jpg";
import microcement from "@/assets/feature-wall-microcement.jpg";
import rawConcrete from "@/assets/feature-wall-raw-concrete.jpg";
import { FEATURE_WALL, FEATURE_WALL_FINISHES, featureWallLayout, type FeatureWallFinish } from "@/lib/visualiserFeatureWall";
import { ARCHITECTURE, architecturalRoomLayout } from "@/lib/visualiserArchitecture";
import ArchitecturalMezzanine from "./ArchitecturalMezzanine";

const FINISH_TEXTURES = { travertine, microcement, "raw-concrete": rawConcrete } as const;

/** Rear stone perimeter with a double-height gallery and lightweight balcony. */
export default function ArchitecturalFeatureWall({ finish = "travertine" }: { finish?: FeatureWallFinish }) {
  const source = useTexture(FINISH_TEXTURES[finish]);
  const invalidate = useThree((s) => s.invalidate);
  const surface = FEATURE_WALL_FINISHES[finish];
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
  const maps = useMemo(() => Array.from({ length: FEATURE_WALL.panels }, (_, i) => {
    const map = source.clone();
    map.colorSpace = THREE.SRGBColorSpace;
    // Metre-scale horizontal vein cut, rather than stretching one image over 80m.
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(layout.panelWidth / ARCHITECTURE.stoneTileWidth, room.height / ARCHITECTURE.stoneTileHeight);
    map.offset.set(i * layout.panelWidth / ARCHITECTURE.stoneTileWidth, 0);
    map.anisotropy = 4;
    map.needsUpdate = true;
    const bump = map.clone();
    bump.colorSpace = THREE.NoColorSpace;
    bump.needsUpdate = true;
    return { map, bump };
  }), [source, layout.panelWidth, room.height]);
  useEffect(() => { invalidate(); return () => maps.forEach(({ map, bump }) => { map.dispose(); bump.dispose(); }); }, [maps, invalidate]);
  return (
    <group name="architectural-interior">
    <ArchitecturalMezzanine layout={room} width={layout.width} rearZ={layout.frontZ} />
    <group name="architectural-feature-wall" position={[layout.centerX, 0, layout.frontZ]}>
      {/* Recessed mineral backing leaves two narrow, genuinely inset joints. */}
      <mesh name="feature-wall-recess" position={[0, room.height / 2, -FEATURE_WALL.thickness - 0.018]} receiveShadow>
        <boxGeometry args={[layout.width, room.height, 0.02]} />
        <meshStandardMaterial color={FEATURE_WALL.reveal} roughness={1} metalness={0} />
      </mesh>
      {maps.map(({ map, bump }, i) => (
        <mesh key={i} name={`feature-wall-slab-${finish}-${i + 1}`} position={[(i - 1) * (layout.panelWidth + FEATURE_WALL.gap), room.height / 2, -FEATURE_WALL.thickness / 2]} castShadow receiveShadow>
          <boxGeometry args={[layout.panelWidth, room.height, FEATURE_WALL.thickness]} />
          <meshStandardMaterial color={surface.tint} map={map} bumpMap={bump} bumpScale={surface.bumpScale} roughness={surface.roughness} metalness={0} />
        </mesh>
      ))}
    </group>
    </group>
  );
}
