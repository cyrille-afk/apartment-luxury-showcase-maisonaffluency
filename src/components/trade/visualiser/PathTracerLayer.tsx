import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { WebGLPathTracer } from "three-gpu-pathtracer";

/**
 * Progressive path tracing (true GI, multi-bounce light, refraction) using the
 * scene's existing HDRI environment and PBR materials. Samples accumulate while
 * the camera is still; any camera move or scene change restarts accumulation.
 * Takes over rendering (priority 1) so the raster post-processing chain is bypassed.
 */
const PathTracerLayer = ({ signature, onSamples }: { signature: string; onSamples?: (n: number) => void }) => {
  const { gl, scene, camera, controls, invalidate } = useThree();
  const tracer = useRef<WebGLPathTracer | null>(null);
  const lastReport = useRef(0);
  const warned = useRef(false);

  useEffect(() => {
    const pt = new WebGLPathTracer(gl);
    pt.bounces = 6;
    pt.transmissiveBounces = 8;
    pt.filterGlossyFactor = 0.5;
    pt.tiles.set(2, 2);
    pt.renderScale = 1;
    pt.minSamples = 3;
    pt.fadeDuration = 300;
    tracer.current = pt;
    return () => {
      pt.dispose();
      tracer.current = null;
      invalidate();
    };
  }, [gl, invalidate]);

  // Rebuild the BVH/material set when the scene composition changes.
  useEffect(() => {
    const pt = tracer.current;
    if (!pt) return;
    const id = window.setTimeout(() => {
      try {
        pt.setScene(scene, camera);
      } catch (err) {
        console.warn("[pathtracer] setScene failed", err);
      }
      invalidate();
    }, 250);
    return () => window.clearTimeout(id);
  }, [signature, scene, camera, invalidate]);

  // Restart accumulation whenever the camera moves.
  useEffect(() => {
    const c = controls as unknown as { addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void } | null;
    if (!c?.addEventListener) return;
    const onChange = () => {
      tracer.current?.updateCamera();
      invalidate();
    };
    c.addEventListener("change", onChange);
    return () => c.removeEventListener?.("change", onChange);
  }, [controls, invalidate]);

  useFrame(() => {
    const pt = tracer.current;
    if (!pt) return;
    try {
      pt.renderSample();
    } catch (err) {
      if (!warned.current) { warned.current = true; console.warn("[pathtracer] renderSample failed", err); }
      gl.render(scene, camera);
      return;
    }
    const n = Math.floor(pt.samples);
    if (onSamples && n !== lastReport.current) {
      lastReport.current = n;
      onSamples(n);
    }
    // Keep refining up to a V-Ray-like convergence budget, then idle.
    if (pt.samples < 1024) invalidate();
  }, 1);

  return null;
};

export default PathTracerLayer;
