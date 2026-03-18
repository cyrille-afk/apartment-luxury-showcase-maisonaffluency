import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Room, PlacedProduct, Point2D } from "./types";

interface RoomScene3DProps {
  rooms: Room[];
  placedProducts: PlacedProduct[];
  wallHeight?: number;
  pixelsPerMeter?: number;
  planImageUrl: string;
  onProductUpdate?: (id: string, updates: Partial<PlacedProduct>) => void;
  onProductDelete?: (id: string) => void;
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

  const color = useMemo(() => {
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

function ProductTexturePlane({ url, hovered }: { url: string; hovered: boolean }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
        if (tex.image) {
          setAspect(tex.image.width / tex.image.height);
        }
      },
      undefined,
      () => setTexture(null),
    );
    return () => { texture?.dispose(); };
  }, [url]);

  const width = aspect >= 1 ? 1 : aspect;
  const height = aspect >= 1 ? 1 / aspect : 1;

  if (!texture) {
    return (
      <mesh>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={hovered ? "#f5f0eb" : "#ffffff"} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture}
        side={THREE.DoubleSide}
        transparent
        opacity={hovered ? 0.85 : 1}
        emissive={hovered ? new THREE.Color("#ffffff") : undefined}
        emissiveIntensity={hovered ? 0.15 : 0}
      />
    </mesh>
  );
}

/** Draggable + rotatable product in the 3D scene */
function PlacedProductMesh({
  product,
  onUpdate,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  product: PlacedProduct;
  onUpdate?: (updates: Partial<PlacedProduct>) => void;
  onDelete?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const { camera, gl, raycaster } = useThree();
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -product.position.y), [product.position.y]);

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation();
    setDragging(true);
    onDragStart?.();
    gl.domElement.style.cursor = "grabbing";
  }, [gl, onDragStart]);

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const intersection = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(floorPlane, intersection)) {
        onUpdate?.({
          position: { x: intersection.x, y: product.position.y, z: intersection.z },
        });
      }
    };

    const handlePointerUp = () => {
      setDragging(false);
      onDragEnd?.();
      gl.domElement.style.cursor = "auto";
    };

    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("pointerup", handlePointerUp);
    return () => {
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging, camera, gl, raycaster, floorPlane, product.position.y, onUpdate, onDragEnd]);

  // Scroll to rotate when hovered
  useEffect(() => {
    if (!hovered || dragging) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.15 : -0.15;
      onUpdate?.({ rotation: product.rotation + delta });
    };
    gl.domElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => gl.domElement.removeEventListener("wheel", handleWheel);
  }, [hovered, dragging, gl, product.rotation, onUpdate]);

  return (
    <group
      ref={groupRef}
      position={[product.position.x, product.position.y, product.position.z]}
    >
      {/* Draggable product visual */}
      <group
        rotation={[0, product.rotation, 0]}
        scale={product.scale}
        onPointerDown={onPointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          if (!dragging) gl.domElement.style.cursor = "grab";
        }}
        onPointerOut={() => {
          setHovered(false);
          if (!dragging) gl.domElement.style.cursor = "auto";
        }}
      >
        {product.imageUrl ? (
          <ProductTexturePlane url={product.imageUrl} hovered={hovered} />
        ) : (
          <mesh>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial color={hovered ? "#f5f0eb" : "#ffffff"} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>

      {/* Ground shadow/indicator ring */}
      {(hovered || dragging) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -product.position.y + 0.02, 0]}>
          <ringGeometry args={[0.4 * product.scale, 0.5 * product.scale, 32]} />
          <meshBasicMaterial color={dragging ? "#4a90d9" : "#999999"} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Rotation indicator arrow */}
      {hovered && !dragging && (
        <mesh rotation={[-Math.PI / 2, product.rotation, 0]} position={[0, -product.position.y + 0.03, 0]}>
          <circleGeometry args={[0.55 * product.scale, 32, 0, Math.PI * 0.15]} />
          <meshBasicMaterial color="#4a90d9" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Label + controls */}
      <Html position={[0, 0.7 * product.scale, 0]} center distanceFactor={8}>
        <div className="flex items-center gap-1 pointer-events-none">
          <div className="bg-background/90 border border-border rounded px-2 py-1 whitespace-nowrap">
            <span className="font-body text-[10px] text-foreground">{product.productName}</span>
          </div>
          {hovered && (
            <button
              className="pointer-events-auto bg-destructive/90 text-destructive-foreground rounded px-1.5 py-0.5 font-body text-[10px] hover:bg-destructive transition-colors"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            >
              ✕
            </button>
          )}
        </div>
        {hovered && !dragging && (
          <div className="text-center mt-1 pointer-events-none">
            <span className="font-body text-[8px] text-muted-foreground bg-background/80 rounded px-1.5 py-0.5">
              drag to move · scroll to rotate
            </span>
          </div>
        )}
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

function Scene({ rooms, placedProducts, wallHeight, ppm, imgCenter, onProductUpdate, onProductDelete, onFloorClick }: {
  rooms: Room[];
  placedProducts: PlacedProduct[];
  wallHeight: number;
  ppm: number;
  imgCenter: Point2D;
  onProductUpdate?: (id: string, updates: Partial<PlacedProduct>) => void;
  onProductDelete?: (id: string) => void;
  onFloorClick?: (pos: { x: number; y: number; z: number }) => void;
}) {
  const controlsRef = useRef<any>(null);
  const [isDraggingProduct, setIsDraggingProduct] = useState(false);

  // Disable orbit controls while dragging a product
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !isDraggingProduct;
    }
  }, [isDraggingProduct]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 12, 15]} fov={50} />
      <OrbitControls
        ref={controlsRef}
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
          onUpdate={(updates) => onProductUpdate?.(product.id, updates)}
          onDelete={() => onProductDelete?.(product.id)}
          onDragStart={() => setIsDraggingProduct(true)}
          onDragEnd={() => setIsDraggingProduct(false)}
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
  onProductUpdate,
  onProductDelete,
  onFloorClick,
}: RoomScene3DProps) => {
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
          onProductUpdate={onProductUpdate}
          onProductDelete={onProductDelete}
          onFloorClick={onFloorClick}
        />
      </Canvas>
    </div>
  );
};

export default RoomScene3D;
