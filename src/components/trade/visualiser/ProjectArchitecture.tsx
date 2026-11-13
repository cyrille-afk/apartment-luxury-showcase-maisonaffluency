import { CAMERA_FRONT_RETREAT_M } from "./sandboxCameraBounds";
import ProceduralWallMaterial from "./ProceduralWallMaterial";
import ArchitecturalShadowGap from "./ArchitecturalShadowGap";
import { ARCHITECTURAL_RENDERING as R } from "@/lib/visualiserArchitecturalRendering";
import type { FeatureWallFinish } from "@/lib/visualiserFeatureWall";
import { Suspense } from "react";
import { Floor } from "./RoomSurfaces";
import type { RoomFloorFinish } from "@/lib/visualiserRoomSurfaces";
import { WALL_THICKNESS_M, type PlanColumn, type RoomBounds } from "@/lib/activeProjectLayout";

/**
 * Compiles the 2D Layout Plan into room architecture in the same coordinate
 * space: floor sized to the room bounds (centre = plan origin), rear + side walls at the
 * room height (front left open so both cameras see in), and structural
 * columns from the plan.
 */
export default function ProjectArchitecture({ bounds, columns, wallFinish = "travertine", floorFinish = "oak-chevron", floorGlare = 50, floorExtension = CAMERA_FRONT_RETREAT_M, floorPatternScale = 100 }: { bounds: RoomBounds; columns: PlanColumn[]; wallFinish?: FeatureWallFinish; floorFinish?: RoomFloorFinish; floorGlare?: number; floorExtension?: number; floorPatternScale?: number }) {
  const { width, depth, height } = bounds;
  const t = WALL_THICKNESS_M;
  const walls: Array<{ name: string; position: [number, number, number]; size: [number, number, number] }> = [
    { name: "Rear wall", position: [0, (height + R.shadowGapHeight) / 2, -depth / 2 - t / 2], size: [width + t * 2, height - R.shadowGapHeight, t] },
    { name: "Left wall", position: [-width / 2 - t / 2, (height + R.shadowGapHeight) / 2, 0], size: [t, height - R.shadowGapHeight, depth] },
    { name: "Right wall", position: [width / 2 + t / 2, (height + R.shadowGapHeight) / 2, 0], size: [t, height - R.shadowGapHeight, depth] },
  ];

  return (
    <group name="Project architecture">
      {floorFinish === "none" ? (
        <mesh name="Plan floor" position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#e9e4dc" roughness={0.85} />
        </mesh>
      ) : (
        <Suspense fallback={null}>
          {/* Floor continues out of the open front so stepping back never shows a floating slab. */}
          <group position={[0, 0, floorExtension / 2]}>
            <Floor finish={floorFinish} glare={floorGlare} size={[width + t * 2, depth + floorExtension]} patternScale={floorPatternScale} />
          </group>
        </Suspense>
      )}
      {walls.map(wall => (
        <mesh key={wall.name} name={wall.name} position={wall.position} receiveShadow castShadow>
          <boxGeometry args={wall.size} />
          <ProceduralWallMaterial finish={wallFinish} width={wall.name === "Rear wall" ? width : depth} height={height} />
        </mesh>
      ))}
      <ArchitecturalShadowGap width={width} position={[0, 0, -depth / 2]} />
      <ArchitecturalShadowGap width={depth} position={[-width / 2, 0, 0]} rotation={Math.PI / 2} />
      <ArchitecturalShadowGap width={depth} position={[width / 2, 0, 0]} rotation={-Math.PI / 2} />
      {/* Front wall shown as a kerb so the opening still reads as a boundary. */}
      <mesh name="Front wall line" position={[0, 0.05, depth / 2 + t / 2]}>
        <boxGeometry args={[width + t * 2, 0.1, t]} />
        <meshStandardMaterial color="#d8d1c6" roughness={0.9} />
      </mesh>
      {columns.map(column => (
        <mesh key={column.id} name={`Column ${column.id}`} position={[column.x, height / 2, column.y]} castShadow receiveShadow>
          <boxGeometry args={[column.size, height, column.size]} />
          <ProceduralWallMaterial finish={wallFinish} width={column.size} height={height} />
        </mesh>
      ))}
    </group>
  );
}

