import { useLayoutEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";
import type { RoomBounds } from "@/lib/activeProjectLayout";
import { sandboxCameraPosition } from "./sandboxCameraBounds";

export default function SandboxCameraBounds({ bounds, frontRetreat }: { bounds: RoomBounds; frontRetreat?: number }) {
  const { camera, controls, invalidate } = useThree();
  const orbit = controls as OrbitControls | undefined;
  const constrain = () => {
    const [x, y, z] = sandboxCameraPosition(camera.position.toArray(), bounds, frontRetreat);
    const dy = y - camera.position.y;
    const changed = x !== camera.position.x || dy !== 0 || z !== camera.position.z;
    if (!changed) return;
    camera.position.set(x, y, z);
    if (orbit?.target) {
      const target = sandboxCameraPosition([orbit.target.x, orbit.target.y + dy, orbit.target.z], bounds, frontRetreat);
      orbit.target.set(...target);
      camera.lookAt(orbit.target);
    }
    camera.updateMatrixWorld();
    invalidate();
  };
  useLayoutEffect(() => {
    constrain();
    orbit?.addEventListener("change", constrain);
    return () => orbit?.removeEventListener("change", constrain);
  }, [camera, orbit, bounds.width, bounds.depth, bounds.height, frontRetreat]);
  // Check after controls update and before rendering, including restored poses.
  useFrame(constrain);
  return null;
}