import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";
import type { PerspectiveCamera } from "three";

export type ComparisonCameraState = { source: string; position: [number, number, number]; target: [number, number, number]; fov: number; version: number };
export type ComparisonCameraLink = { id: string; shared: MutableRefObject<ComparisonCameraState | null> };

export default function ComparisonCameraSync({ id, shared }: ComparisonCameraLink) {
  const controls = useThree(state => state.controls) as OrbitControls | null;
  const camera = useThree(state => state.camera) as PerspectiveCamera;
  const invalidate = useThree(state => state.invalidate);
  const applying = useRef(false);
  const version = useRef(-1);
  useEffect(() => {
    if (!controls) return;
    const publish = () => {
      if (applying.current) return;
      const next = (shared.current?.version ?? 0) + 1;
      shared.current = { source: id, position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov, version: next };
      version.current = next;
      invalidate();
    };
    controls.addEventListener("change", publish);
    return () => controls.removeEventListener("change", publish);
  }, [controls, camera, id, shared, invalidate]);
  useFrame(() => {
    const pose = shared.current;
    if (!controls || !pose || pose.version === version.current || pose.source === id) return;
    applying.current = true;
    camera.position.fromArray(pose.position);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    controls.target.fromArray(pose.target);
    controls.update();
    version.current = pose.version;
    applying.current = false;
    invalidate();
  });
  // A frame is also needed in the receiving demand canvas when the other camera moves.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (shared.current && shared.current.version !== version.current) invalidate();
    }, 40);
    return () => window.clearInterval(timer);
  }, [shared, invalidate]);
  return null;
}