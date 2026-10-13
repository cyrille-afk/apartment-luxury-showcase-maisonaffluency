import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import oakImage from "@/assets/room-oak-chevron.jpg";
import cementImage from "@/assets/room-micro-cement.jpg";
import { WALL_FULL_HEIGHT_M, clampFloorGlare, clampWallHeight, roomWallColor, roomWallFinish, wallColorHex, wallFinishSpec, type RoomFloorFinish, type RoomWallColor, type RoomWallFinish } from "@/lib/visualiserRoomSurfaces";
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
        // Glare 0 = near-matte floor (0.9), 100 = polished (0.55); brighter texels stay rougher.
        const polishedBase = 0.9 - (clampFloorGlare(glare) / 100) * 0.35;
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
function PlasterWall({ objects, heightPct, color, finish }: { objects: PlacedObject[]; heightPct: number; color: RoomWallColor; finish: RoomWallFinish }) {
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
      <meshStandardMaterial color={wallColorHex(color)} roughness={spec.roughness} bumpMap={maps.bump} bumpScale={spec.bumpScale} metalness={0} envMapIntensity={spec.envMapIntensity} side={THREE.BackSide} />
    </mesh>
  );
}

export default function RoomSurfaces({ floor, rearWall, objects, glare = 50, wallHeight = 100, wallColor = "warm-white", wallFinish = "matte" }: { floor: RoomFloorFinish; rearWall: boolean; objects: PlacedObject[]; glare?: number; wallHeight?: number; wallColor?: RoomWallColor; wallFinish?: RoomWallFinish }) {
  return <group name="architectural-room-surfaces">
    {floor !== "none" && <Floor key={floor} finish={floor} glare={glare} />}
    {rearWall && <PlasterWall objects={objects} heightPct={wallHeight} color={roomWallColor(wallColor)} finish={roomWallFinish(wallFinish)} />}
  </group>;
}