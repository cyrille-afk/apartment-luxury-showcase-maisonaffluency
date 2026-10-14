import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WebGLPathTracer } from "three-gpu-pathtracer";
import { isTraceableMesh, PATH_TRACING, tracedEnvironmentRevision, tracedSceneRevision } from "@/lib/visualiserPathTracing";
import { SHOWROOM } from "@/lib/showroomRendering";

/** Owns the demand loop: cheap moving preview, progressive full-resolution GI at rest. */
const PathTracerLayer = ({ signature, onSamples }: { signature: string; onSamples?: (n: number) => void }) => {
  const { gl, scene, camera, invalidate } = useThree();
  const tracer = useRef<WebGLPathTracer | null>(null);
  const report = useRef(onSamples);
  report.current = onSamples;
  const state = useRef({ ready: false, failed: false, dirty: true, revision: "", environment: "", checkedAt: 0, movedAt: 0, reportedAt: 0, samples: -1, world: new THREE.Matrix4(), projection: new THREE.Matrix4() });

  useEffect(() => {
    const current = state.current;
    Object.assign(current, { ready: false, failed: false, dirty: true, revision: "", environment: "", checkedAt: 0, movedAt: performance.now(), samples: -1 });
    // EffectComposer can leave NoToneMapping behind when switching modes.
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = SHOWROOM.exposure;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    let pt: WebGLPathTracer | null = null;
    try {
      pt = new WebGLPathTracer(gl);
      pt.bounces = 10;
      pt.transmissiveBounces = 10;
      // No biased glossy blur: preserve authored reflections/refraction.
      pt.filterGlossyFactor = 0;
      pt.multipleImportanceSampling = true;
      pt.tiles.set(2, 2);
      pt.dynamicLowRes = true;
      pt.lowResScale = PATH_TRACING.movingScale;
      pt.renderScale = PATH_TRACING.settledScale;
      pt.renderDelay = PATH_TRACING.settleMs;
      pt.minSamples = PATH_TRACING.minSamples;
      pt.fadeDuration = PATH_TRACING.fadeMs;
      tracer.current = pt;
    } catch (error) {
      current.failed = true;
      console.warn("[pathtracer] initialization failed; retaining live scene", error);
    }
    invalidate();
    return () => {
      pt?.dispose();
      tracer.current = null;
      invalidate();
    };
  }, [gl, invalidate]);

  useEffect(() => {
    state.current.dirty = true;
    invalidate();
  }, [signature, invalidate]);

  useFrame(() => {
    const pt = tracer.current;
    const current = state.current;
    if (!pt || current.failed) {
      gl.render(scene, camera);
      return;
    }
    const now = performance.now();
    try {
      // Detect actual matrices, not only OrbitControls events (zoom, scripted motion, resize).
      camera.updateMatrixWorld();
      if (!current.world.equals(camera.matrixWorld) || !current.projection.equals(camera.projectionMatrix)) {
        current.world.copy(camera.matrixWorld);
        current.projection.copy(camera.projectionMatrix);
        current.movedAt = now;
        if (current.ready) pt.updateCamera(); // updateCamera ALWAYS resets; never call unconditionally.
      }
      if (current.dirty || now - current.checkedAt >= 250) {
        current.checkedAt = now;
        scene.updateMatrixWorld(true);
        const revision = tracedSceneRevision(scene);
        const environment = tracedEnvironmentRevision(scene);
        if (current.dirty || revision !== current.revision) {
          const hidden: THREE.Object3D[] = [];
          scene.traverse((object) => {
            const drawable = (object as THREE.Mesh).isMesh || (object as THREE.Line).isLine || (object as THREE.Points).isPoints;
            if (object.visible && drawable && !isTraceableMesh(object)) {
              object.visible = false;
              hidden.push(object);
            }
          });
          try {
            pt.setScene(scene, camera);
          } finally {
            hidden.forEach((object) => { object.visible = true; });
          }
          current.ready = true;
          current.dirty = false;
          current.revision = revision;
          current.environment = environment;
          current.movedAt = now;
        } else if (environment !== current.environment) {
          pt.updateEnvironment();
          current.environment = environment;
        }
      }
      // During movement renderSample uses one quarter-resolution preview sample.
      // Full-resolution tiles begin only after movement has settled.
      pt.pausePathTracing = now - current.movedAt < PATH_TRACING.settleMs;
      pt.renderSample();
      const samples = Math.floor(pt.samples);
      if (samples !== current.samples && (samples === 0 || now - current.reportedAt >= 250)) {
        current.samples = samples;
        current.reportedAt = now;
        report.current?.(samples);
      }
      // No arbitrary sample cap: keep converging for as long as Photoreal mode is on.
      invalidate();
    } catch (error) {
      current.failed = true;
      report.current?.(0);
      console.warn("[pathtracer] rendering failed; retaining live scene", error);
      gl.render(scene, camera);
    }
  }, 1);

  return null;
};

export default PathTracerLayer;
