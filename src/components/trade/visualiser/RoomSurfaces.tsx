import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import oakImage from "@/assets/room-oak-chevron.jpg";
import cementImage from "@/assets/room-micro-cement.jpg";
import { WALL_FULL_HEIGHT_M, clampFloorGlare, clampWallFinishIntensity, clampWallHeight, roomWallColor, roomWallFinish, wallColorHex, wallFinishSpec, clampRugPile, clampRugSize, clampRugOffset, rugColorHex, rugWeave, type RugColor, type RugWeave, type RoomFloorFinish, type RoomWallColor, type RoomWallFinish } from "@/lib/visualiserRoomSurfaces";
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
function useWoolMaps(weave: RugWeave, pile: number, repeat: [number, number] = [6, 5]) {
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
      cctx.putImageData(cimg, 0, 0);
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
  }, [anisotropy, weave, pile, repeat[0], repeat[1]]);
  useEffect(() => () => { maps.color?.dispose(); maps.normal?.dispose(); }, [maps]);
  return maps;
}

/**
 * Large minimalist wool area rug anchoring the seating cluster.
 * Centered on the arrangement; at least 4.5 × 3.5 m, growing so every
 * piece's footprint sits comfortably inside its boundaries.
 */
const RUG_THICKNESS_M = 0.018;
const RUG_BEVEL_M = 0.005;
/** Height of the rug's top surface — contact shadows sit just above it. */
export const RUG_TOP_Y = 0.001 + RUG_THICKNESS_M + RUG_BEVEL_M * 2;
const RUG_TILE: [number, number] = [1.35, 1.35];

/**
 * Pebble-like asymmetric silhouette from cubic béziers, normalised to the
 * given overall width × depth (shape X → world X, shape Y → world −Z).
 */
export function organicRugShape(width: number, depth: number): THREE.Shape {
  const w = width / 2, d = depth / 2;
  const P = (x: number, y: number) => [x * w, y * d] as const;
  const s = new THREE.Shape();
  s.moveTo(...P(-0.98, 0.05));
  s.bezierCurveTo(...P(-1.0, 0.62), ...P(-0.62, 1.0), ...P(-0.12, 0.94));
  s.bezierCurveTo(...P(0.28, 0.89), ...P(0.42, 0.78), ...P(0.68, 0.84));
  s.bezierCurveTo(...P(0.95, 0.9), ...P(1.02, 0.46), ...P(0.97, 0.08));
  s.bezierCurveTo(...P(0.92, -0.38), ...P(1.0, -0.8), ...P(0.52, -0.95));
  s.bezierCurveTo(...P(0.18, -1.04), ...P(-0.08, -0.84), ...P(-0.42, -0.9));
  s.bezierCurveTo(...P(-0.82, -0.97), ...P(-0.96, -0.5), ...P(-0.98, 0.05));
  return s;
}

const RUG_CORD_RADIUS_M = 0.01;

/** Procedural braided/whip-stitched cord normal map (u runs along the cord). */
function makeBraidNormalMap(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const W = 256, H = 64;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d"); if (!ctx) return null;
  const img = ctx.createImageData(W, H);
  // Height field: two interleaved diagonal strands → braided twist.
  const h = (x: number, y: number) => {
    const a = Math.sin(((x / W) * 4 + (y / H)) * Math.PI * 2);
    const b = Math.sin(((x / W) * 4 - (y / H)) * Math.PI * 2 + Math.PI);
    return Math.max(a, b) * 0.5 + 0.5 + Math.sin((x / W) * Math.PI * 64) * 0.04;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = h((x + 1) % W, y) - h((x - 1 + W) % W, y);
    const dy = h(x, (y + 1) % H) - h(x, (y - 1 + H) % H);
    const n = new THREE.Vector3(-dx * 3, -dy * 3, 1).normalize();
    const i = (y * W + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

/** Braided piping trim following the rug's top outer lip. */
function RugBorder({ width, depth, color }: { width: number; depth: number; color: string }) {
  const normal = useMemo(() => makeBraidNormalMap(), []);
  const geometry = useMemo(() => {
    const topZ = RUG_THICKNESS_M + RUG_BEVEL_M * 2;
    const pts = organicRugShape(width, depth).getSpacedPoints(480).slice(0, -1).map((v) => new THREE.Vector3(v.x, v.y, topZ));
    const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
    return { g: new THREE.TubeGeometry(curve, 960, RUG_CORD_RADIUS_M, 12, true), len: curve.getLength() };
  }, [width, depth]);
  useEffect(() => { if (normal) normal.repeat.set(geometry.len / 0.025, 1); }, [normal, geometry.len]);
  useEffect(() => () => geometry.g.dispose(), [geometry]);
  useEffect(() => () => normal?.dispose(), [normal]);
  return (
    <mesh name="room-area-rug-border" geometry={geometry.g} castShadow receiveShadow>
      <meshStandardMaterial color={color} normalMap={normal ?? undefined} normalScale={new THREE.Vector2(1.6, 1.6)} roughness={0.75} metalness={0} envMapIntensity={0.08} />
    </mesh>
  );
}

export type RugLayout = { width?: number | null; depth?: number | null; offsetX?: number; offsetZ?: number };
function Rug({ objects, color, weave, pile, layout }: { objects: PlacedObject[]; color: RugColor; weave: RugWeave; pile: number; layout?: RugLayout }) {
  const p = clampRugPile(pile);
  // Extruded shape UVs are in metres, so tile ~1.35× per metre (matches the old 6×5 over 4.5×3.8 m).
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
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(organicRugShape(width, depth), {
      depth: RUG_THICKNESS_M, bevelEnabled: true, bevelThickness: RUG_BEVEL_M, bevelSize: 0.03, bevelSegments: 3, curveSegments: 96,
    });
    // Sit the bevelled underside on the floor.
    g.translate(0, 0, RUG_BEVEL_M);
    return g;
  }, [width, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!maps.color || !maps.normal) return null;
  return (
    <group position={[cx, 0.001, cz]} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh name="room-area-rug" geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={rugColorHex(color)} map={maps.color} normalMap={maps.normal} normalScale={new THREE.Vector2(0.8 + (p / 100) * 1.6, 0.8 + (p / 100) * 1.6)} roughness={0.88 + (p / 100) * 0.04} metalness={0} envMapIntensity={0.05} />
    </mesh>
    <RugBorder width={width} depth={depth} color={rugColorHex(color)} />
    </group>
  );
}

export default function RoomSurfaces({ floor, rearWall, objects, glare = 50, wallHeight = 100, wallColor = "warm-white", wallFinish = "matte", wallCustomHex = null, wallFinishIntensity = 100, rugColor = "cream", rugWeave: rugWeaveKey = "loop", rugPile = 50, rugLayout, showRug = true }: { floor: RoomFloorFinish; rearWall: boolean; objects: PlacedObject[]; glare?: number; wallHeight?: number; wallColor?: RoomWallColor; wallFinish?: RoomWallFinish; wallCustomHex?: string | null; wallFinishIntensity?: number; rugColor?: RugColor; rugWeave?: RugWeave; rugPile?: number; rugLayout?: RugLayout; showRug?: boolean }) {
  return <group name="architectural-room-surfaces">
    {floor !== "none" && <Floor key={floor} finish={floor} glare={glare} />}
    {floor !== "none" && showRug && <Rug objects={objects} color={rugColor} weave={rugWeaveKey} pile={rugPile} layout={rugLayout} />}
    {rearWall && <PlasterWall objects={objects} heightPct={wallHeight} color={roomWallColor(wallColor)} finish={roomWallFinish(wallFinish)} customHex={wallCustomHex} intensity={wallFinishIntensity} />}
  </group>;
}