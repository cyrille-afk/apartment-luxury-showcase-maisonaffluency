import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";
import type { PerspectiveCamera } from "three";
import { bindComparisonCamera, type ComparisonCameraLink } from "./comparisonCameraLink";
export type { ComparisonCameraState, ComparisonCameraLink } from "./comparisonCameraLink";

export default function ComparisonCameraSync({ id, shared, enabled = true }: ComparisonCameraLink) {
  const controls = useThree(state => state.controls) as OrbitControls | null;
  const camera = useThree(state => state.camera) as PerspectiveCamera;
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    if (!controls) return;
    return bindComparisonCamera({ id, shared, enabled }, camera, controls, invalidate);
  }, [controls, camera, id, shared, enabled, invalidate]);
  return null;
}