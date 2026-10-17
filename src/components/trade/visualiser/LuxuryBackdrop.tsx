import { useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import luxuryAsset from '@/assets/luxury-surrounding.jpg.asset.json';
import { backdropUv, LUXURY_BACKDROP } from './luxuryBackdropSettings';

export default function LuxuryBackdrop() {
  const source = useLoader(THREE.TextureLoader, LUXURY_BACKDROP.path, (loader) => {
    loader.manager = new THREE.LoadingManager();
    loader.manager.setURLModifier((url) => url === LUXURY_BACKDROP.path ? luxuryAsset.url : url);
  });
  const texture = useMemo(() => {
    const map = source.clone();
    const image = source.image as { width: number; height: number };
    const uv = backdropUv(image.width, image.height);
    map.colorSpace = THREE.SRGBColorSpace;
    map.repeat.set(...uv.repeat);
    map.offset.set(...uv.offset);
    map.needsUpdate = true;
    return map;
  }, [source]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh name="default-luxury-backdrop" position={LUXURY_BACKDROP.position} raycast={() => undefined}>
    <planeGeometry args={LUXURY_BACKDROP.size} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}
