import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Box3, PerspectiveCamera } from "three";
import type { OrbitControls } from "three-stdlib";
import { fitRoomCamera } from "@/lib/roomCameraFit";

/** Inside asset Suspense so the fit includes every loaded GLB. */
export default function RoomOverviewCamera({ revision, enabled = true }: { revision: string | number; enabled?: boolean }) {
  const { camera, controls, scene, size, invalidate } = useThree();
  const fitted = useRef("");
  useEffect(() => {
    if (!enabled || !(camera instanceof PerspectiveCamera) || !controls || !size.width || !size.height) return;
    const key = `${revision}:${size.width}:${size.height}:${camera.uuid}`;
    if (fitted.current === key) return;
    const room = scene.getObjectByName("curated-room");
    if (!room) return;
    room.updateWorldMatrix(true, true);
    const bounds = new Box3().setFromObject(room);
    if (bounds.isEmpty()) return;
    const fit = fitRoomCamera(bounds, size.width / size.height, camera.fov);
    camera.position.copy(fit.position);
    camera.far = fit.far;
    camera.lookAt(fit.target);
    camera.updateProjectionMatrix();
    const orbit = controls as OrbitControls;
    orbit.target.copy(fit.target);
    orbit.update();
    fitted.current = key;
    invalidate();
  }, [camera, controls, enabled, invalidate, revision, scene, size.width, size.height]);
  return null;
}