import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import oakImage from "@/assets/room-oak-chevron.jpg";
import cementImage from "@/assets/room-micro-cement.jpg";
import { SHOWROOM } from "@/lib/showroomRendering";
import { clampFloorGlare, type RoomFloorFinish } from "@/lib/visualiserRoomSurfaces";
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

function PlasterWall({ z }: { z: number }) {
  const maps = useSurfaceMaps(cementImage, 16, false);
  return (
    <mesh name="room-rear-plaster-wall" position={[0, 1.9, z]} receiveShadow>
      <planeGeometry args={[80, 3.8]} />
      <meshStandardMaterial color={SHOWROOM.plaster} roughness={0.95} bumpMap={maps.bump} bumpScale={0.002} metalness={0} envMapIntensity={0.2} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function RoomSurfaces({ floor, rearWall, objects, glare = 50 }: { floor: RoomFloorFinish; rearWall: boolean; objects: PlacedObject[]; glare?: number }) {
  const rearZ = Math.min(-4, ...objects.map((o) => (o.position?.[2] ?? 0) - footprintRadius(parseDimensionString(o.dimensions), o.scale) - 1.5));
  return <group name="architectural-room-surfaces">
    {floor !== "none" && <Floor key={floor} finish={floor} glare={glare} />}
    {rearWall && <PlasterWall z={rearZ} />}
  </group>;
}