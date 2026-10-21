import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { WALL_THICKNESS_M, type PlanColumn, type RoomBounds } from "@/lib/activeProjectLayout";

/**
 * Compiles the 2D Layout Plan into room architecture in the same coordinate
 * space: floor sized to the room bounds (centre = plan origin) carrying the
 * uploaded blueprint with the plan's "slice" crop, rear + side walls at the
 * room height (front left open so both cameras see in), and structural
 * columns from the plan.
 */
export default function ProjectArchitecture({ bounds, floorPlanUrl, columns }: { bounds: RoomBounds; floorPlanUrl: string | null; columns: PlanColumn[] }) {
  const [plan, setPlan] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!floorPlanUrl) { setPlan(null); return; }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(floorPlanUrl, texture => {
      if (cancelled) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      setPlan(texture);
    }, undefined, () => !cancelled && setPlan(null));
    return () => { cancelled = true; };
  }, [floorPlanUrl]);
  useEffect(() => () => plan?.dispose(), [plan]);

  // Match SVG preserveAspectRatio="xMidYMid slice" so the blueprint lands where the plan shows it.
  useMemo(() => {
    const image = plan?.image as { width?: number; height?: number } | undefined;
    if (!plan || !image?.width || !image?.height) return;
    const imageAspect = image.width / image.height;
    const roomAspect = bounds.width / bounds.depth;
    const [rx, ry] = imageAspect > roomAspect ? [roomAspect / imageAspect, 1] : [1, imageAspect / roomAspect];
    plan.repeat.set(rx, ry);
    plan.offset.set((1 - rx) / 2, (1 - ry) / 2);
    plan.needsUpdate = true;
  }, [plan, bounds.width, bounds.depth]);

  const { width, depth, height } = bounds;
  const t = WALL_THICKNESS_M;
  const walls: Array<{ name: string; position: [number, number, number]; size: [number, number, number] }> = [
    { name: "Rear wall", position: [0, height / 2, -depth / 2 - t / 2], size: [width + t * 2, height, t] },
    { name: "Left wall", position: [-width / 2 - t / 2, height / 2, 0], size: [t, height, depth] },
    { name: "Right wall", position: [width / 2 + t / 2, height / 2, 0], size: [t, height, depth] },
  ];

  return (
    <group name="Project architecture">
      <mesh name="Plan floor" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial key={plan ? "plan" : "plain"} map={plan} color={plan ? "#ffffff" : "#e9e4dc"} roughness={0.85} />
      </mesh>
      {walls.map(wall => (
        <mesh key={wall.name} name={wall.name} position={wall.position} receiveShadow castShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color="#f3efe8" roughness={0.9} />
        </mesh>
      ))}
      {/* Front wall shown as a kerb so the opening still reads as a boundary. */}
      <mesh name="Front wall line" position={[0, 0.05, depth / 2 + t / 2]}>
        <boxGeometry args={[width + t * 2, 0.1, t]} />
        <meshStandardMaterial color="#d8d1c6" roughness={0.9} />
      </mesh>
      {columns.map(column => (
        <mesh key={column.id} name={`Column ${column.id}`} position={[column.x, height / 2, column.y]} castShadow receiveShadow>
          <boxGeometry args={[column.size, height, column.size]} />
          <meshStandardMaterial color="#ebe6de" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
