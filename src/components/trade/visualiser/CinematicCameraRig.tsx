import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CinematicPath } from "@/hooks/useCinematicPath";

/** Gentle cosine ramps, constant-speed cruise. */
export const cinematicProgress = (t: number) => {
  const ramp = 0.12;
  const integral = (x: number) => (x - ramp / Math.PI * Math.sin(Math.PI * x / ramp)) / 2;
  if (t < ramp) return integral(Math.max(0, t)) / (1 - ramp);
  if (t > 1 - ramp) return 1 - integral(Math.max(0, 1 - t)) / (1 - ramp);
  return (t - ramp / 2) / (1 - ramp);
};

export default function CinematicCameraRig({ path, playing, onDone }: { path: CinematicPath | null; playing: boolean; onDone: () => void }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const elapsed = useRef(0);
  const active = useRef(false);
  const from = useRef(new THREE.Vector3());
  const orientation = useRef(new THREE.Quaternion());
  const scratch = useRef(new THREE.PerspectiveCamera());
  const forward = useRef(new THREE.Vector3());
  useFrame((_state, delta) => {
    if (!playing || !path) { active.current = false; return; }
    if (!active.current) {
      elapsed.current = 0;
      from.current.copy(camera.position);
      orientation.current.copy(camera.quaternion);
      active.current = true;
    }
    elapsed.current += Math.min(delta, 0.05); // dropped frames must not teleport the camera
    const entrySec = 2.5;
    if (elapsed.current < entrySec) {
      const t = elapsed.current / entrySec;
      const blend = t * t * t * (t * (t * 6 - 15) + 10);
      camera.position.lerpVectors(from.current, path.curve.getPointAt(0), blend);
      scratch.current.position.copy(camera.position);
      scratch.current.lookAt(path.target);
      camera.quaternion.slerpQuaternions(orientation.current, scratch.current.quaternion, blend);
    } else {
      const t = Math.min(1, (elapsed.current - entrySec) / path.durationSec);
      camera.position.copy(path.curve.getPointAt(cinematicProgress(t)));
      camera.lookAt(path.target);
      if (t >= 1) { active.current = false; onDone(); }
    }
    // Resume OrbitControls without a target/orientation jump, including manual Stop.
    if (controls) {
      camera.getWorldDirection(forward.current);
      controls.target.copy(camera.position).addScaledVector(forward.current, camera.position.distanceTo(path.target));
    }
  });
  return null;
}
