import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { CinematicPath } from "@/hooks/useCinematicPath";

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Drives the default camera along the cinematic spline while `playing`; always looks at the cluster centre. */
export default function CinematicCameraRig({ path, playing, onDone }: { path: CinematicPath | null; playing: boolean; onDone: () => void }) {
  const camera = useThree((s) => s.camera);
  const start = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (!playing || !path) { start.current = null; return; }
    if (start.current == null) start.current = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - start.current) / path.durationSec);
    camera.position.copy(path.curve.getPointAt(ease(t)));
    camera.lookAt(path.target);
    if (t >= 1) { start.current = null; onDone(); }
  });
  return null;
}
