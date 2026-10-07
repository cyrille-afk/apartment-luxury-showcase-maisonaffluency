import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CinematicPath } from "@/hooks/useCinematicPath";
import { advancePlayback, CINEMATIC_ENTRY_SECONDS } from "@/lib/cinematicPlayback";

/** Gentle cosine ramps, constant-speed cruise. */
export const cinematicProgress = (t: number) => {
  const ramp = 0.12;
  const integral = (x: number) => (x - ramp / Math.PI * Math.sin(Math.PI * x / ramp)) / 2;
  if (t < ramp) return integral(Math.max(0, t)) / (1 - ramp);
  if (t > 1 - ramp) return 1 - integral(Math.max(0, 1 - t)) / (1 - ramp);
  return (t - ramp / 2) / (1 - ramp);
};

export default function CinematicCameraRig({ path, enabled, playing, speed, seek, onTimeChange, onDone }: {
  path: CinematicPath | null;
  enabled: boolean;
  playing: boolean;
  speed: number;
  seek: { id: number; time: number };
  onTimeChange: (time: number) => void;
  onDone: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const elapsed = useRef(0);
  const active = useRef(false);
  const lastSeek = useRef(-1);
  const lastReport = useRef(0);
  const from = useRef(new THREE.Vector3());
  const orientation = useRef(new THREE.Quaternion());
  const scratch = useRef(new THREE.PerspectiveCamera());
  const forward = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());
  useFrame((_state, delta) => {
    if (!enabled || !path) { active.current = false; return; }
    if (!active.current) {
      elapsed.current = 0;
      lastSeek.current = -1;
      lastReport.current = 0;
      from.current.copy(camera.position);
      orientation.current.copy(camera.quaternion);
      active.current = true;
    }
    const entrySec = CINEMATIC_ENTRY_SECONDS;
    const duration = entrySec + path.durationSec;
    lookTarget.current.copy(path.target);
    const seeking = lastSeek.current !== seek.id;
    if (seeking) {
      elapsed.current = THREE.MathUtils.clamp(seek.time, 0, duration);
      lastSeek.current = seek.id;
    } else if (!playing) return;
    if (playing && !seeking) elapsed.current = advancePlayback(elapsed.current, delta, speed, duration);
    if (elapsed.current < entrySec) {
      const t = elapsed.current / entrySec;
      const blend = t * t * t * (t * (t * 6 - 15) + 10);
      camera.position.lerpVectors(from.current, path.curve.getPointAt(0), blend);
      scratch.current.position.copy(camera.position);
      scratch.current.lookAt(path.target);
      camera.quaternion.slerpQuaternions(orientation.current, scratch.current.quaternion, blend);
    } else {
      const t = Math.min(1, (elapsed.current - entrySec) / path.durationSec);
      const progress = cinematicProgress(t);
      camera.position.copy(path.curve.getPointAt(progress));
      if (path.lookAtCurve) lookTarget.current.copy(path.lookAtCurve.getPoint(path.curve.getUtoTmapping(progress, 0)));
      camera.lookAt(lookTarget.current);
    }
    // Resume OrbitControls without a target/orientation jump, including manual Stop.
    if (controls) {
      camera.getWorldDirection(forward.current);
      controls.target.copy(camera.position).addScaledVector(forward.current, camera.position.distanceTo(lookTarget.current));
    }
    if (seeking || Math.abs(elapsed.current - lastReport.current) >= 0.1 || elapsed.current >= duration) {
      lastReport.current = elapsed.current;
      onTimeChange(elapsed.current);
    }
    if (playing && elapsed.current >= duration) onDone();
  });
  return null;
}
