import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

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
    scene.traverse((node) => { if (node.userData.visualiserInitialReady === true && node.parent?.userData !== node.userData) loadedModels += 1; });
    if (!ready || loadedModels < modelCount) { frames.current = 0; return; }
    if (++frames.current < 2) { invalidate(); return; }
    revealed.current = true;
    pending.current = requestAnimationFrame(onReady);
  });
  return null;
}
export type SceneCaptureHandle = {
  modelsReady: () => boolean;
  invalidate: () => void;
  /** Renders one frame synchronously (incl. the effect composer) on an opaque background and returns it as PNG. */
  captureOpaqueFrame: (background: string) => string;
};

/** Lets mockup export wait until every piece's finishes are loaded into its materials. */
export function SceneCaptureProbe({ modelCount, handle }: { modelCount: number; handle: { current: SceneCaptureHandle | null } }) {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    handle.current = {
      invalidate: () => invalidate(),
      captureOpaqueFrame: (background) => {
        // Transparent pixels in the premultiplied buffer get un-premultiplied on readback,
        // which washes colours out; an opaque background keeps alpha at 1 everywhere.
        const prevBackground = scene.background;
        const prevClear = gl.getClearColor(new THREE.Color());
        const prevAlpha = gl.getClearAlpha();
        scene.background = new THREE.Color(background);
        gl.setClearColor(background, 1);
        try {
          advance(performance.now(), true); // runs useFrame, so the composer's ACES/sRGB passes are baked in
          return gl.domElement.toDataURL("image/png");
        } finally {
          scene.background = prevBackground;
          gl.setClearColor(prevClear, prevAlpha);
          invalidate();
        }
      },
      modelsReady: () => {
        let loaded = 0;
        scene.traverse((node) => { if (node.userData.visualiserInitialReady === true && node.parent?.userData !== node.userData) loaded += 1; });
        return loaded >= modelCount;
      },
    };
    return () => { handle.current = null; };
  }, [scene, invalidate, advance, gl, modelCount, handle]);
  return null;
}
