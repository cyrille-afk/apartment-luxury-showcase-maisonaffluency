import { useMemo, useState, useEffect, useRef } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Room, PlacedProduct, Point2D } from "./types";

interface RoomScene3DProps {
  rooms: Room[];
  placedProducts: PlacedProduct[];
  wallHeight?: number;
  pixelsPerMeter?: number;
  planImageUrl: string;
  onProductClick?: (productId: string) => void;
  onFloorClick?: (position: { x: number; y: number; z: number }) => void;
}

// Convert image-space polygon to 3D world coords
function imageToWorld(p: Point2D, ppm: number, imgCenter: Point2D): [number, number] {
  return [(p.x - imgCenter.x) / ppm, (imgCenter.y - p.y) / ppm];
}

function RoomFloor({ room, ppm, imgCenter }: { room: Room; ppm: number; imgCenter: Point2D }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const [sx, sz] = imageToWorld(room.corners[0], ppm, imgCenter);
    s.moveTo(sx, sz);
    for (let i = 1; i < room.corners.length; i++) {
      const [x, z] = imageToWorld(room.corners[i], ppm, imgCenter);
      s.lineTo(x, z);
    }
    s.closePath();
    return s;
  }, [room, ppm, imgCenter]);

  const geometry = useMemo(() => new THREE.ShapeGeometry(shape), [shape]);

  // Parse room color into Three.js color
  const color = useMemo(() => {
    // Approximate HSL parsing
    const match = room.color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
    if (match) {
      const h = parseInt(match[1]) / 360;
      const s = parseInt(match[2]) / 100;
      const l = parseInt(match[3]) / 100;
      return new THREE.Color().setHSL(h, s, l);
    }
    return new THREE.Color(0xeeeeee);
  }, [room.color]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
      <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.6} />
    </mesh>
  );
}

function RoomWalls({ room, ppm, imgCenter, wallHeight }: { room: Room; ppm: number; imgCenter: Point2D; wallHeight: number }) {
  const walls = useMemo(() => {
    const segments: { start: [number, number]; end: [number, number] }[] = [];
    for (let i = 0; i < room.corners.length; i++) {
      const next = (i + 1) % room.corners.length;
      segments.push({
        start: imageToWorld(room.corners[i], ppm, imgCenter),
        end: imageToWorld(room.corners[next], ppm, imgCenter),
      });
    }
    return segments;
  }, [room, ppm, imgCenter]);

  return (
    <group>
      {walls.map((wall, i) => {
        const dx = wall.end[0] - wall.start[0];
        const dz = wall.end[1] - wall.start[1];
        const len = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx);
        const cx = (wall.start[0] + wall.end[0]) / 2;
        const cz = (wall.start[1] + wall.end[1]) / 2;

        return (
          <mesh
            key={`${room.id}-wall-${i}`}
            position={[cx, wallHeight / 2, -cz]}
            rotation={[0, angle, 0]}
            castShadow
          >
            <boxGeometry args={[len, wallHeight, 0.08]} />
            <meshStandardMaterial color="#e8e4e0" transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

function PlacedProductMesh({ product, onClick }: { product: PlacedProduct; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={[product.position.x, product.position.y, product.position.z]}>
      {/* Product billboard */}
      <mesh
        rotation={[0, product.rotation, 0]}
        scale={product.scale}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={hovered ? "#f5f0eb" : "#ffffff"} side={THREE.DoubleSide} />
      </mesh>

      {/* Label */}
      <Html position={[0, 0.7 * product.scale, 0]} center distanceFactor={8}>
        <div className="bg-background/90 border border-border rounded px-2 py-1 pointer-events-none whitespace-nowrap">
          <span className="font-body text-[10px] text-foreground">{product.productName}</span>
        </div>
      </Html>
    </group>
  );
}

function FloorPlane({ onFloorClick }: { onFloorClick?: (pos: { x: number; y: number; z: number }) => void }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        if (onFloorClick) {
          onFloorClick({ x: e.point.x, y: 0.5, z: e.point.z });
        }
      }}
    >
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#f5f0eb" side={THREE.DoubleSide} />
    </mesh>
  );
}

function Scene({ rooms, placedProducts, wallHeight, ppm, imgCenter, onProductClick, onFloorClick }: {
  rooms: Room[];
  placedProducts: PlacedProduct[];
  wallHeight: number;
  ppm: number;
  imgCenter: Point2D;
  onProductClick?: (id: string) => void;
  onFloorClick?: (pos: { x: number; y: number; z: number }) => void;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 12, 15]} fov={50} />
      <OrbitControls
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={50}
        enableDamping
        dampingFactor={0.05}
      />

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} />

      {/* Ground */}
      <FloorPlane onFloorClick={onFloorClick} />

      {/* Grid helper */}
      <gridHelper args={[40, 40, "#d4d0cc", "#e8e4e0"]} />

      {/* Rooms */}
      {rooms.map((room) => (
        <group key={room.id}>
          <RoomFloor room={room} ppm={ppm} imgCenter={imgCenter} />
          <RoomWalls room={room} ppm={ppm} imgCenter={imgCenter} wallHeight={wallHeight} />
        </group>
      ))}

      {/* Products */}
      {placedProducts.map((product) => (
        <PlacedProductMesh
          key={product.id}
          product={product}
          onClick={() => onProductClick?.(product.id)}
        />
      ))}
    </>
  );
}

const RoomScene3D = ({
  rooms,
  placedProducts,
  wallHeight = 2.8,
  pixelsPerMeter = 50,
  planImageUrl,
  onProductClick,
  onFloorClick,
}: RoomScene3DProps) => {
  // Compute image center for coordinate conversion
  const imgCenter = useMemo(() => {
    const allPoints = rooms.flatMap((r) => r.corners);
    if (allPoints.length === 0) return { x: 0, y: 0 };
    const cx = allPoints.reduce((s, p) => s + p.x, 0) / allPoints.length;
    const cy = allPoints.reduce((s, p) => s + p.y, 0) / allPoints.length;
    return { x: cx, y: cy };
  }, [rooms]);

  return (
    <div className="w-full h-full">
      <Canvas shadows gl={{ antialias: true }} style={{ background: "#faf8f6" }}>
        <Scene
          rooms={rooms}
          placedProducts={placedProducts}
          wallHeight={wallHeight}
          ppm={pixelsPerMeter}
          imgCenter={imgCenter}
          onProductClick={onProductClick}
          onFloorClick={onFloorClick}
        />
      </Canvas>
    </div>
  );
};

export default RoomScene3D;
