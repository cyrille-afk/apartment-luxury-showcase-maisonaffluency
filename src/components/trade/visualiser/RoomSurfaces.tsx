import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import oakImage from "@/assets/room-oak-chevron.jpg";
import cementImage from "@/assets/room-micro-cement.jpg";
import woolImage from "@/assets/cream-wool-rug.jpg";
import { roundedRugGeometry, RUG_TOP_Y } from "@/lib/visualiserRug";
import { rugYaw } from "@/lib/visualiserRugRotation";
export { RUG_TOP_Y } from "@/lib/visualiserRug";
import { WALL_FULL_HEIGHT_M, clampFloorGlare, clampWallFinishIntensity, clampWallHeight, roomWallColor, roomWallFinish, wallColorHex, wallFinishSpec, clampRugPile, clampRugSize, clampRugOffset, clampRugBorderThicknessMm, clampRugBorderTwistMm, clampRugBorderRoughness, rugColorHex, rugWeave, type RugColor, type RugBorderColor, type RugWeave, type RoomFloorFinish, type RoomWallColor, type RoomWallFinish } from "@/lib/visualiserRoomSurfaces";
import type { PlacedObject } from "./SceneObject";
import { footprintRadius } from "@/lib/visualiserPlacement";
import { parseDimensionString } from "@/lib/productDimensions";
import { SHOWROOM, floorSurfaceRoughness, floorRoughnessTexel } from "@/lib/showroomRendering";
import RecessedCeiling from "./RecessedCeiling";
import type { CeilingSettings } from "@/lib/visualiserCeilingSettings";

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
        const value = floorRoughnessTexel(polished, glare, light);
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
  const maps = useSurfaceMaps(finish === "oak-chevron" ? oakImage : cementImage, finish === "oak-chevron" ? 32 : 20, finish === "oak-chevron", glare);
  // Glare 0 = 0.05 env reflection, 100 = 0.45.
  const envMapIntensity = 0.05 + (clampFloorGlare(glare) / 100) * 0.4;
  return (
    <mesh name={`room-floor-${finish}`} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial map={maps.color} roughnessMap={maps.roughness} roughness={floorSurfaceRoughness(finish === "oak-chevron", glare)} bumpMap={maps.bump} bumpScale={finish === "oak-chevron" ? 0.008 : 0.003} metalness={0} envMapIntensity={envMapIntensity} />
    </mesh>
  );
}

/**
 * Curved cyclorama wall wrapping the whole scene, so orbiting the camera
 * always shows plaster behind the furniture instead of the wall's edge.
 * Centered on the middle of the arrangement, not the world origin.
 */
function PlasterWall({ objects, heightPct, color, finish, customHex, intensity = 100, ceilingHeight, ceilingThickness, ceilingOpening }: CeilingSettings & { objects: PlacedObject[]; heightPct: number; color: RoomWallColor; finish: RoomWallFinish; customHex: string | null; intensity?: number }) {
  const maps = useSurfaceMaps(cementImage, 16, false);
  const spec = wallFinishSpec(finish);
  const { cx, cz, radius, backZ, height } = useMemo(() => {
    const xs = objects.map((o) => o.position?.[0] ?? 0);
    const zs = objects.map((o) => o.position?.[2] ?? 0);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const cz = zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 0;
    const spread = Math.max(
      4,
      ...objects.map((o) => Math.hypot((o.position?.[0] ?? 0) - cx, (o.position?.[2] ?? 0) - cz) + footprintRadius(parseDimensionString(o.dimensions), o.scale)),
    );
    // Flat rear wall sits well behind the furthest piece (at least Z = -8).
    const backZ = Math.min(-8, ...objects.map((o) => (o.position?.[2] ?? 0) - footprintRadius(parseDimensionString(o.dimensions), o.scale) - 3));
    return { cx, cz, radius: spread + 9, backZ, height: (WALL_FULL_HEIGHT_M * clampWallHeight(heightPct)) / 100 };
  }, [objects, heightPct]);
  return (
    <group>
    <mesh name="room-rear-plaster-wall" position={[cx, height / 2, backZ]} receiveShadow>
      <planeGeometry args={[80, height]} />
      <meshStandardMaterial color={wallColorHex(color, customHex)} roughness={spec.roughness} bumpMap={maps.bump} bumpScale={spec.bumpScale} metalness={0} envMapIntensity={spec.envMapIntensity * (clampWallFinishIntensity(intensity) / 100)} side={THREE.FrontSide} />
    </mesh>
    <ArchitecturalCoves cx={cx} cz={cz} radius={radius} height={height} color={wallColorHex(color, customHex)} ceilingHeight={ceilingHeight} ceilingThickness={ceilingThickness} ceilingOpening={ceilingOpening} />
    </group>
  );
}

/** Concealed perimeter coves: broad emitters face plaster, never the conversation group.
 * Rect-area lights approximate bounced illumination (WebGL does not simulate GI). */
function ArchitecturalCoves({ cx, cz, radius, height, color, ceilingHeight, ceilingThickness, ceilingOpening }: CeilingSettings & { cx: number; cz: number; radius: number; height: number; color: string }) {
  const strips = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const angle = i * Math.PI / 4;
    const x = Math.sin(angle), z = Math.cos(angle);
    const position = new THREE.Vector3(x * (radius - 0.65), height - 0.22, z * (radius - 0.65));
    const target = new THREE.Vector3(x * radius, height - 0.05, z * radius);
    const rotation = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0)));
    return { position, rotation };
  }), [radius, height]);
  return <group name="concealed-architectural-coves" position={[cx, 0, cz]}>
    <RecessedCeiling radius={radius} height={height} ceilingHeight={ceilingHeight} ceilingThickness={ceilingThickness} ceilingOpening={ceilingOpening} />
    {strips.map((strip, i) => <group key={i}>
      <rectAreaLight name={`wall-wash-${i}`} position={strip.position} rotation={strip.rotation} width={radius * 0.68} height={0.12} intensity={4} color={SHOWROOM.cove} />
    </group>)}
  </group>;
}

/** Procedural cream wool: warm off-white albedo + tight loop-pile normal map. */
function useWoolMaps(weave: RugWeave, pile: number, repeat: [number, number] = [6, 5]) {
  const source = useTexture(woolImage);
  const anisotropy = useThree((s) => Math.min(16, s.gl.capabilities.getMaxAnisotropy()));
  const maps = useMemo(() => {
    const size = 1536;
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
      const height = new Float32Array(size * size);
      const contrast = 0.4 + (pile / 100) * 0.9;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let h = 0;
          if (weave === "loop") {
            // Tight loop pile: rounded bumps with per-loop jitter; deeper pile = bigger loops.
            const cell = pile > 66 ? 8 : pile > 33 ? 6 : 4;
            const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
            const seed = Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453;
            const jx = (seed - Math.floor(seed) - 0.5) * 2;
            const jy = (Math.sin(seed) - 0.5) * 2;
            const dx = (x % cell) - cell / 2 - jx;
            const dy = (y % cell) - cell / 2 - jy;
            const d = Math.sqrt(dx * dx + dy * dy) / (cell / 2);
            h = Math.max(0, 1 - d * d);
          } else if (weave === "flatweave") {
            // Basket weave: alternating 8px blocks of warp / weft threads.
            const block = (Math.floor(x / 8) + Math.floor(y / 8)) % 2;
            h = block ? Math.abs(Math.sin((Math.PI * (y % 4)) / 4)) : Math.abs(Math.sin((Math.PI * (x % 4)) / 4));
          } else if (weave === "herringbone") {
            // Zig-zag berber ribs alternating direction every 16px column band.
            const dir = Math.floor(x / 16) % 2 ? 1 : -1;
            const t = (((y + dir * x) % 8) + 8) % 8;
            h = Math.sin((Math.PI * t) / 8);
          } else {
            // Ribbed cord: parallel raised ribs with fine fibre noise.
            h = Math.pow(Math.sin((Math.PI * (y % 10)) / 10), 2) * 0.85 + (Math.sin(x * 12.9898 + y * 78.233) * 0.5 + 0.5) * 0.15;
          }
          height[y * size + x] = h;
          // Neutral fibre shading; material colour tints it.
          const shade = Math.min(255, 205 + h * 50 * contrast);
          const i = (y * size + x) * 4;
          cimg.data[i] = cimg.data[i + 1] = cimg.data[i + 2] = shade; cimg.data[i + 3] = 255;
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
      // Authentic-looking high-resolution yarn detail; the procedural weave
      // remains the adjustable micro-relief, never a strong painted shadow.
      const image = source.image;
      if (image instanceof HTMLImageElement) cctx.drawImage(image, 0, 0, size, size);
      const fibers = cctx.getImageData(0, 0, size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const l = (y * size + ((x - 1 + size) % size)) * 4;
        const r = (y * size + ((x + 1) % size)) * 4;
        const u = (((y - 1 + size) % size) * size + x) * 4;
        const d = (((y + 1) % size) * size + x) * 4;
        const nx = (fibers.data[l] - fibers.data[r]) / 255 + (nimg.data[i] / 255 - 0.5) * 0.15;
        const ny = (fibers.data[d] - fibers.data[u]) / 255 + (nimg.data[i + 1] / 255 - 0.5) * 0.15;
        const length = Math.hypot(nx, ny, 1);
        nimg.data[i] = (nx / length * 0.5 + 0.5) * 255;
        nimg.data[i + 1] = (ny / length * 0.5 + 0.5) * 255;
        nimg.data[i + 2] = (1 / length * 0.5 + 0.5) * 255;
      }
      nctx.putImageData(nimg, 0, 0);
      color = new THREE.CanvasTexture(colorCanvas);
      color.colorSpace = THREE.SRGBColorSpace;
      normal = new THREE.CanvasTexture(normalCanvas);
      normal.colorSpace = THREE.NoColorSpace;
      for (const map of [color, normal]) {
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.repeat.set(repeat[0], repeat[1]);
        map.anisotropy = anisotropy;
        map.needsUpdate = true;
      }
    }
    return { color, normal };
  }, [source, anisotropy, weave, pile, repeat[0], repeat[1]]);
  useEffect(() => () => { maps.color?.dispose(); maps.normal?.dispose(); }, [maps]);
  return maps;
}

/**
 * Large minimalist wool area rug anchoring the seating cluster.
 * Centered on the arrangement; at least 4.5 × 3.5 m, growing so every
 * piece's footprint sits comfortably inside its boundaries.
 */
const RUG_TILE: [number, number] = [1.35, 1.35];

export type RugLayout = { width?: number | null; depth?: number | null; offsetX?: number; offsetZ?: number; rotation?: number };
function Rug({ objects, color, borderColor = "match", borderThicknessMm, borderTwistMm, borderRoughness, weave, pile, layout }: { objects: PlacedObject[]; color: RugColor; borderColor?: RugBorderColor; borderThicknessMm?: number; borderTwistMm?: number; borderRoughness?: number; weave: RugWeave; pile: number; layout?: RugLayout }) {
  const p = clampRugPile(pile);
  // Metre-space UVs preserve yarn scale when the rug is resized.
  const maps = useWoolMaps(rugWeave(weave), p, RUG_TILE);
  const { cx, cz, width, depth } = useMemo(() => {
    const xs = objects.map((o) => o.position?.[0] ?? 0);
    const zs = objects.map((o) => o.position?.[2] ?? 0);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const cz = zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 0;
    let halfW = 2.25, halfD = 1.9; // 4.5 × 3.8 m minimum
    for (const o of objects) {
      const r = footprintRadius(parseDimensionString(o.dimensions), o.scale) + 0.5;
      halfW = Math.max(halfW, Math.abs((o.position?.[0] ?? 0) - cx) + r);
      halfD = Math.max(halfD, Math.abs((o.position?.[2] ?? 0) - cz) + r);
    }
    return {
      cx: cx + clampRugOffset(layout?.offsetX),
      cz: cz + clampRugOffset(layout?.offsetZ),
      width: clampRugSize(layout?.width) ?? halfW * 2,
      depth: clampRugSize(layout?.depth) ?? halfD * 2,
    };
  }, [objects, layout?.width, layout?.depth, layout?.offsetX, layout?.offsetZ]);
  const geometry = useMemo(() => roundedRugGeometry(width, depth), [width, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!maps.color || !maps.normal) return null;
  return (
    <group name="room-rug-placement" position={[cx, RUG_TOP_Y, cz]} rotation={[0, rugYaw(layout?.rotation), 0]}>
    <group rotation={[-Math.PI / 2, 0, 0]}>
    <mesh name="room-area-rug" geometry={geometry} receiveShadow>
      <meshStandardMaterial color={color === "cream" ? SHOWROOM.rim : rugColorHex(color)} map={maps.color} normalMap={maps.normal} normalScale={new THREE.Vector2(0.25 + (p / 100) * 0.25, 0.25 + (p / 100) * 0.25)} roughness={0.88 + (p / 100) * 0.04} metalness={0} envMapIntensity={0.05} />
    </mesh>
    </group>
    </group>
  );
}

export default function RoomSurfaces({ floor, rearWall, objects, glare = 50, wallHeight = 100, ceilingHeight, ceilingThickness, ceilingOpening, wallColor = "warm-white", wallFinish = "matte", wallCustomHex = null, wallFinishIntensity = 100, rugColor = "cream", rugBorderColor = "match", rugBorderThicknessMm, rugBorderTwistMm, rugBorderRoughness, rugWeave: rugWeaveKey = "loop", rugPile = 50, rugLayout, showRug = true }: CeilingSettings & { floor: RoomFloorFinish; rearWall: boolean; objects: PlacedObject[]; glare?: number; wallHeight?: number; wallColor?: RoomWallColor; wallFinish?: RoomWallFinish; wallCustomHex?: string | null; wallFinishIntensity?: number; rugColor?: RugColor; rugBorderColor?: RugBorderColor; rugBorderThicknessMm?: number; rugBorderTwistMm?: number; rugBorderRoughness?: number; rugWeave?: RugWeave; rugPile?: number; rugLayout?: RugLayout; showRug?: boolean }) {
  return <group name="architectural-room-surfaces">
    {floor !== "none" && <Floor key={floor} finish={floor} glare={glare} />}
    {floor !== "none" && showRug && <Rug objects={objects} color={rugColor} borderColor={rugBorderColor} borderThicknessMm={rugBorderThicknessMm} borderTwistMm={rugBorderTwistMm} borderRoughness={rugBorderRoughness} weave={rugWeaveKey} pile={rugPile} layout={rugLayout} />}
    {/* Rear wall removed by request — floor, rug and furniture only. */}
  </group>;
}