import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";

export function InitialAssetsCommitted({ onReady }: { onReady: (ready: boolean) => void }) {
  useEffect(() => { onReady(true); return () => onReady(false); }, [onReady]);
  return null;
}

/** Reveal only after the complete full-DPR room has drawn; later edits never mask it. */
export default function InitialRoomReveal({ ready, modelCount, onReady }: { ready: boolean; modelCount: number; onReady: () => void }) {
  const revealed = useRef(false);
  const frames = useRef(0);
  const pending = useRef<number | null>(null);
  useEffect(() => () => { if (pending.current !== null) cancelAnimationFrame(pending.current); }, []);
  useFrame(({ scene, invalidate }) => {
    if (revealed.current) return;
    let loadedModels = 0;
    scene.traverse((node) => { if (node.userData.visualiserInitialReady === true) loadedModels += 1; });
    if (!ready || loadedModels < modelCount) { frames.current = 0; invalidate(); return; }
    if (++frames.current < 2) { invalidate(); return; }
    revealed.current = true;
    pending.current = requestAnimationFrame(onReady);
  });
  return null;
}