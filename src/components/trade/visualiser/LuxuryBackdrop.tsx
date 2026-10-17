import { useEffect, useMemo, useRef } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import luxuryAsset from '@/assets/luxury-surrounding.jpg.asset.json';
import { backdropFit, LUXURY_BACKDROP } from './luxuryBackdropSettings';

export default function LuxuryBackdrop() {
  const mesh = useRef<THREE.Mesh>(null);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const source = useLoader(THREE.TextureLoader, LUXURY_BACKDROP.path, (loader) => {
    loader.manager = new THREE.LoadingManager();
    loader.manager.setURLModifier((url) => url === LUXURY_BACKDROP.path ? luxuryAsset.url : url);
  });
  const texture = useMemo(() => {
    const map = source.clone();
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [source]);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(({ camera }) => {
    if (!mesh.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    const image = source.image as { width: number; height: number };
    const height = 2 * LUXURY_BACKDROP.distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fit = backdropFit(image.width, image.height, height * camera.aspect, height);
    mesh.current.scale.set(fit[0], fit[1], 1);
    camera.getWorldDirection(direction);
    mesh.current.position.copy(camera.position).addScaledVector(direction, LUXURY_BACKDROP.distance);
    mesh.current.quaternion.copy(camera.quaternion);
  });
  return <mesh ref={mesh} name="default-luxury-backdrop" renderOrder={-1000} raycast={() => undefined}>
    <planeGeometry args={[1, 1]} />
    <meshBasicMaterial map={texture} toneMapped={false} depthWrite={false} />
  </mesh>;
}
