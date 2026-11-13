import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { createProceduralSurface, type ProceduralSurface } from '@/lib/visualiserProceduralSurfaces';
import { WALL_ROUGHNESS } from '@/lib/visualiserSurfacePatterns';
import { FEATURE_WALL_FINISHES, type FeatureWallFinish } from '@/lib/visualiserFeatureWall';
export function useProceduralMaps(finish: ProceduralSurface, width: number, height: number, tileSize = 2) {
  const invalidate = useThree(s => s.invalidate);
  const maps = useMemo(() => createProceduralSurface(finish), [finish]);
  useEffect(() => { for (const map of [maps.color, maps.bump, maps.roughness]) map.repeat.set(width / tileSize, height / tileSize); invalidate(); }, [maps, width, height, tileSize, invalidate]);
  useEffect(() => () => { maps.color.dispose(); maps.bump.dispose(); maps.roughness.dispose(); }, [maps]);
  return maps;
}
export default function ProceduralWallMaterial({ finish, width, height }: { finish: FeatureWallFinish; width: number; height: number }) {
  const maps = useProceduralMaps(finish, width, height);
  const surface = FEATURE_WALL_FINISHES[finish];
  return <meshStandardMaterial map={maps.color} bumpMap={maps.bump} roughnessMap={maps.roughness} bumpScale={surface.bumpScale} roughness={WALL_ROUGHNESS} metalness={0} />;
}
