import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { backdropFit, LUXURY_BACKDROP } from './luxuryBackdropSettings';

/**
 * Shows the studio's uploaded interior panorama as a fitted flat backdrop
 * (the whole picture, letterboxed) instead of a 360° projection, so the room
 * reads as a framed photograph and furniture stays grounded on the floor
 * stage. The EXR itself still drives lighting via the environment map.
 */
export default function UploadedEnvironmentBackdrop({ map }: { map: THREE.DataTexture }) {
  const mesh = useRef<THREE.Mesh>(null);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const texture = useMemo(() => {
    const clone = map.clone();
    // EXR data is linear HDR — let ACES tone mapping (material default) grade it.
    clone.needsUpdate = true;
    return clone;
  }, [map]);
  useFrame(({ camera }) => {
    if (!mesh.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    const image = map.image as { width: number; height: number };
    const height = 2 * LUXURY_BACKDROP.distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fit = backdropFit(image.width, image.height, height * camera.aspect, height);
    mesh.current.scale.set(fit[0], fit[1], 1);
    camera.getWorldDirection(direction);
    mesh.current.position.copy(camera.position).addScaledVector(direction, LUXURY_BACKDROP.distance);
    mesh.current.quaternion.copy(camera.quaternion);
  });
  return (
    <mesh ref={mesh} name="uploaded-environment-backdrop" renderOrder={-1000} raycast={() => undefined}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} depthWrite={false} />
    </mesh>
  );
}
