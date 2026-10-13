import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import oakImage from "@/assets/room-oak-chevron.jpg";
import cementImage from "@/assets/room-micro-cement.jpg";
import { WALL_FULL_HEIGHT_M, clampFloorGlare, clampWallFinishIntensity, clampWallHeight, roomWallColor, roomWallFinish, wallColorHex, wallFinishSpec, type RoomFloorFinish, type RoomWallColor, type RoomWallFinish } from "@/lib/visualiserRoomSurfaces";
import type { PlacedObject } from "./SceneObject";
import { footprintRadius } from "@/lib/visualiserPlacement";
import { parseDimensionString } from "@/lib/productDimensions";

/** Isolate UV repeats and linear data maps from the shared image cache. */
function useSurfaceMaps(url: string, repeat: number, polished: boolean, glare = 50) {
  const source = useTexture(url);
  const anisotropy = useThree((s) => Math.min(8, s.gl.capabilities.getMaxAnisotropy()));
  const maps = useMemo(() => {
    const color = source.clone();
    color.colorSpace = THREE.SRGBColorSpace;
    const bump = source.clone();
    bump.colorSpace = THREE.NoColorSpace;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    let roughness: THREE.CanvasTexture | null = null;
    const image = source.image;
    if (ctx && image instanceof HTMLImageElement) {
      ctx.drawImage(image, 0, 0, 512, 512);
      const pixels = ctx.getImageData(0, 0, 512, 512);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const light = (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 765;
        // Glare 0 = matte floor (0.75), 100 = satin semi-gloss (0.45); brighter texels stay rougher.
        const polishedBase = 0.75 - (clampFloorGlare(glare) / 100) * 0.3;
        const value = Math.round((polished ? polishedBase + (1 - light) * 0.14 : 0.88 + (1 - light) * 0.1) * 255);
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      }
      ctx.putImageData(pixels, 0, 0);
      roughness = new THREE.CanvasTexture(canvas);
      roughness.colorSpace = THREE.NoColorSpace;
    }
    for (const map of [color, bump, roughness]) {
      if (!map) continue;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(repeat, repeat);
      map.anisotropy = anisotropy;
      map.needsUpdate = true;
    }
    return { color, bump, roughness };
  }, [source, repeat, polished, glare, anisotropy]);
  useEffect(() => () => {
    maps.color.dispose(); maps.bump.dispose(); maps.roughness?.dispose();
  }, [maps]);
  return maps;
}

function Floor({ finish, glare }: { finish: Exclude<RoomFloorFinish, "none">; glare: number }) {
  const maps = useSurfaceMaps(finish === "oak-chevron" ? oakImage : cementImage, finish === "oak-chevron" ? 32 : 20, true, glare);
  // Glare 0 = 0.05 env reflection, 100 = 0.45.
  const envMapIntensity = 0.05 + (clampFloorGlare(glare) / 100) * 0.4;
  return (
    <mesh name={`room-floor-${finish}`} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial map={maps.color} roughnessMap={maps.roughness} roughness={1} bumpMap={maps.bump} bumpScale={finish === "oak-chevron" ? 0.008 : 0.003} metalness={0} envMapIntensity={envMapIntensity} />
    </mesh>
  );
}

/**
 * Curved cyclorama wall wrapping the whole scene, so orbiting the camera
 * always shows plaster behind the furniture instead of the wall's edge.
 * Centered on the middle of the arrangement, not the world origin.
 */
function PlasterWall({ objects, heightPct, color, finish, customHex, intensity = 100 }: { objects: PlacedObject[]; heightPct: number; color: RoomWallColor; finish: RoomWallFinish; customHex: string | null; intensity?: number }) {
  const maps = useSurfaceMaps(cementImage, 16, false);
  const spec = wallFinishSpec(finish);
  const { cx, cz, radius, height } = useMemo(() => {
    const xs = objects.map((o) => o.position?.[0] ?? 0);
    const zs = objects.map((o) => o.position?.[2] ?? 0);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const cz = zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 0;
    const spread = Math.max(
      4,
      ...objects.map((o) => Math.hypot((o.position?.[0] ?? 0) - cx, (o.position?.[2] ?? 0) - cz) + footprintRadius(parseDimensionString(o.dimensions), o.scale)),
    );
    return { cx, cz, radius: spread + 9, height: (WALL_FULL_HEIGHT_M * clampWallHeight(heightPct)) / 100 };
  }, [objects, heightPct]);
  return (
    <mesh name="room-rear-plaster-wall" position={[cx, height / 2, cz]} receiveShadow>
      <cylinderGeometry args={[radius, radius, height, 64, 1, true]} />
      <meshStandardMaterial color={wallColorHex(color, customHex)} roughness={spec.roughness} bumpMap={maps.bump} bumpScale={spec.bumpScale} metalness={0} envMapIntensity={spec.envMapIntensity * (clampWallFinishIntensity(intensity) / 100)} side={THREE.BackSide} />
    </mesh>
  );
}

/** Procedural cream wool: warm off-white albedo + tight loop-pile normal map. */
function useWoolMaps() {
  const anisotropy = useThree((s) => Math.min(8, s.gl.capabilities.getMaxAnisotropy()));
  const maps = useMemo(() => {
    const size = 512;
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = colorCanvas.height = size;
    const cctx = colorCanvas.getContext("2d");
    const normalCanvas = document.createElement("canvas");
    normalCanvas.width = normalCanvas.height = size;
    const nctx = normalCanvas.getContext("2d");
    let color: THREE.CanvasTexture | null = null;
    let normal: THREE.CanvasTexture | null = null;
    if (cctx && nctx) {
      const cimg = cctx.createImageData(size, size);
      const nimg = nctx.createImageData(size, size);
      // Tight loop pile: small rounded bumps on a grid with slight jitter.
      const cell = 6;
      const height = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
          // Deterministic pseudo-random jitter per loop.
          const seed = Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453;
          const jx = (seed - Math.floor(seed) - 0.5) * 2;
          const jy = (Math.sin(seed) - 0.5) * 2;
          const dx = (x % cell) - cell / 2 - jx;
          const dy = (y % cell) - cell / 2 - jy;
          const d = Math.sqrt(dx * dx + dy * dy) / (cell / 2);
          const h = Math.max(0, 1 - d * d);
          height[y * size + x] = h;
          const shade = 232 + h * 18 + (Math.sin(seed * 7) * 4);
          const i = (y * size + x) * 4;
          cimg.data[i] = shade; cimg.data[i + 1] = shade - 6; cimg.data[i + 2] = shade - 18; cimg.data[i + 3] = 255;
        }
      }
      // Normal map from heightfield (tangent-space, Y-up green).
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const l = height[y * size + ((x - 1 + size) % size)];
          const r = height[y * size + ((x + 1) % size)];
          const u = height[((y - 1 + size) % size) * size + x];
          const d = height[((y + 1) % size) * size + x];
          const nx = (l - r) * 2, ny = (d - u) * 2, nz = 1;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const i = (y * size + x) * 4;
          nimg.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
          nimg.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
          nimg.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
          nimg.data[i + 3] = 255;
        }
      }
      cctx.putImageData(cimg, 0, 0);
      nctx.putImageData(nimg, 0, 0);
      color = new THREE.CanvasTexture(colorCanvas);
      color.colorSpace = THREE.SRGBColorSpace;
      normal = new THREE.CanvasTexture(normalCanvas);
      normal.colorSpace = THREE.NoColorSpace;
      for (const map of [color, normal]) {
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.repeat.set(6, 5);
        map.anisotropy = anisotropy;
        map.needsUpdate = true;
      }
    }
    return { color, normal };
  }, [anisotropy]);
  useEffect(() => () => { maps.color?.dispose(); maps.normal?.dispose(); }, [maps]);
  return maps;
}

/**
 * Large minimalist wool area rug anchoring the seating cluster.
 * Centered on the arrangement; at least 4.5 × 3.5 m, growing so every
 * piece's footprint sits comfortably inside its boundaries.
 */
function Rug({ objects }: { objects: PlacedObject[] }) {
  const maps = useWoolMaps();
  const { cx, cz, width, depth } = useMemo(() => {
    const xs = objects.map((o) => o.position?.[0] ?? 0);
    const zs = objects.map((o) => o.position?.[2] ?? 0);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const cz = zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 0;
    let halfW = 2.25, halfD = 1.75; // 4.5 × 3.5 m minimum
    for (const o of objects) {
      const r = footprintRadius(parseDimensionString(o.dimensions), o.scale) + 0.5;
      halfW = Math.max(halfW, Math.abs((o.position?.[0] ?? 0) - cx) + r);
      halfD = Math.max(halfD, Math.abs((o.position?.[2] ?? 0) - cz) + r);
    }
    return { cx, cz, width: halfW * 2, depth: halfD * 2 };
  }, [objects]);
  if (!maps.color || !maps.normal) return null;
  return (
    <mesh name="room-area-rug" position={[cx, 0.005, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={maps.color} normalMap={maps.normal} normalScale={new THREE.Vector2(0.8, 0.8)} roughness={0.92} metalness={0} envMapIntensity={0.05} />
    </mesh>
  );
}

export default function RoomSurfaces({ floor, rearWall, objects, glare = 50, wallHeight = 100, wallColor = "warm-white", wallFinish = "matte", wallCustomHex = null, wallFinishIntensity = 100 }: { floor: RoomFloorFinish; rearWall: boolean; objects: PlacedObject[]; glare?: number; wallHeight?: number; wallColor?: RoomWallColor; wallFinish?: RoomWallFinish; wallCustomHex?: string | null; wallFinishIntensity?: number }) {
  return <group name="architectural-room-surfaces">
    {floor !== "none" && <Floor key={floor} finish={floor} glare={glare} />}
    {rearWall && <PlasterWall objects={objects} heightPct={wallHeight} color={roomWallColor(wallColor)} finish={roomWallFinish(wallFinish)} customHex={wallCustomHex} intensity={wallFinishIntensity} />}
  </group>;
}