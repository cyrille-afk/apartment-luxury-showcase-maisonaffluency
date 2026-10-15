import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import travertine from "@/assets/architectural-travertine.jpg";
import { FEATURE_WALL, featureWallLayout } from "@/lib/visualiserFeatureWall";

/** Three lightweight physical slabs; no enclosing side walls or ceiling. */
export default function ArchitecturalFeatureWall() {
  const source = useTexture(travertine);
  const invalidate = useThree((s) => s.invalidate);
  const [layout, setLayout] = useState(() => featureWallLayout(new THREE.Box3()));
  const bounds = useMemo(() => new THREE.Box3(), []);
  useFrame(({ scene }) => {
    bounds.makeEmpty();
    scene.traverse((node) => {
      if (!node.userData.visualiserInstanceId) return;
      node.updateWorldMatrix(true, true);
      bounds.union(new THREE.Box3().setFromObject(node));
    });
    const next = featureWallLayout(bounds);
    if (Object.keys(next).some((key) => Math.abs(next[key as keyof typeof next] - layout[key as keyof typeof layout]) > 0.001)) {
      setLayout(next);
      invalidate();
    }
  }, -0.5);
  const maps = useMemo(() => Array.from({ length: FEATURE_WALL.panels }, (_, i) => {
    const map = source.clone();
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    map.repeat.set(1 / FEATURE_WALL.panels, 1);
    map.offset.set(i / FEATURE_WALL.panels, 0);
    map.anisotropy = 4;
    map.needsUpdate = true;
    const bump = map.clone();
    bump.colorSpace = THREE.NoColorSpace;
    bump.needsUpdate = true;
    return { map, bump };
  }), [source]);
  useEffect(() => { invalidate(); return () => maps.forEach(({ map, bump }) => { map.dispose(); bump.dispose(); }); }, [maps, invalidate]);
  return (
    <group name="architectural-feature-wall" position={[layout.centerX, 0, layout.frontZ]}>
      {/* Recessed mineral backing leaves two narrow, genuinely inset joints. */}
      <mesh name="feature-wall-recess" position={[0, layout.height / 2, -FEATURE_WALL.thickness - 0.018]} receiveShadow>
        <boxGeometry args={[layout.width, layout.height, 0.02]} />
        <meshStandardMaterial color={FEATURE_WALL.reveal} roughness={1} metalness={0} />
      </mesh>
      {maps.map(({ map, bump }, i) => (
        <mesh key={i} name={`travertine-slab-${i + 1}`} position={[(i - 1) * (layout.panelWidth + FEATURE_WALL.gap), layout.height / 2, -FEATURE_WALL.thickness / 2]} castShadow receiveShadow>
          <boxGeometry args={[layout.panelWidth, layout.height, FEATURE_WALL.thickness]} />
          <meshStandardMaterial color={FEATURE_WALL.stone} map={map} bumpMap={bump} bumpScale={FEATURE_WALL.bumpScale} roughness={FEATURE_WALL.roughness} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}