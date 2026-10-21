import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { Matrix4, PerspectiveCamera } from "three";
import { photoCameraProjection, type PhotoCalibration } from "@/lib/photoPerspective";
import type { RoomBounds } from "@/lib/activeProjectLayout";

export default function PhotoMatchedCamera({ calibration, bounds }: { calibration: PhotoCalibration; bounds: RoomBounds }) {
  const { camera } = useThree();
  const projection = useMemo(() => photoCameraProjection(calibration, bounds), [calibration, bounds]);
  useFrame(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    camera.position.set(...projection.center);
    camera.quaternion.identity();
    camera.updateMatrixWorld(true);
    const clip = new Matrix4().set(...projection.clip as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]);
    camera.projectionMatrix.copy(clip.multiply(camera.matrixWorld));
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }, -2);
  return null;
}