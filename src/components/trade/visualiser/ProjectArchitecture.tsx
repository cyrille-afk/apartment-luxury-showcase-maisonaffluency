import { WALL_THICKNESS_M, type PlanColumn, type RoomBounds } from "@/lib/activeProjectLayout";

/**
 * Compiles the 2D Layout Plan into room architecture in the same coordinate
 * space: floor sized to the room bounds (centre = plan origin), rear + side walls at the
 * room height (front left open so both cameras see in), and structural
 * columns from the plan.
 */
export default function ProjectArchitecture({ bounds, columns }: { bounds: RoomBounds; columns: PlanColumn[] }) {
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
        <meshStandardMaterial color="#e9e4dc" roughness={0.85} />
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
