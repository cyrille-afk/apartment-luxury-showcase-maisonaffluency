import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WebGLPathTracer, PhysicalCamera } from "three-gpu-pathtracer";
import { photographicBokeh, photographicFocusDistance } from "@/lib/visualiserDepthOfField";
import { DEFAULT_PT_QUALITY, isTraceableMesh, PATH_TRACING, type PathTraceQuality, tracedEnvironmentRevision, tracedSceneRevision } from "@/lib/visualiserPathTracing";
import { SHOWROOM } from "@/lib/showroomRendering";

const matricesClose = (a: THREE.Matrix4, b: THREE.Matrix4, eps = 1e-5) => {
  for (let i = 0; i < 16; i++) if (Math.abs(a.elements[i] - b.elements[i]) > eps) return false;
  return true;
};

/** Owns the demand loop: cheap moving preview, progressive full-resolution GI at rest. */
const PathTracerLayer = ({ signature, onSamples, quality = DEFAULT_PT_QUALITY, depthOfField = false, focusTarget, dofStrength = 3 }: { signature: string; onSamples?: (n: number) => void; quality?: PathTraceQuality; depthOfField?: boolean; focusTarget: THREE.Vector3; dofStrength?: number }) => {
  const { gl, scene, camera, invalidate } = useThree();
  const tracer = useRef<WebGLPathTracer | null>(null);
  const physicalCamera = useRef(new PhysicalCamera());
  const lastFocus = useRef({ distance: -1, bokeh: -1 });
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

  const maxSamples = useRef(quality.maxSamples);
  maxSamples.current = quality.maxSamples;
  useEffect(() => {
    const pt = tracer.current;
    if (!pt) return;
    pt.lowResScale = quality.previewScale;
    if (pt.renderScale !== quality.renderScale) {
      pt.renderScale = quality.renderScale;
      state.current.dirty = true; // resolution change requires a fresh accumulation
    }
    invalidate();
  }, [quality.previewScale, quality.renderScale, quality.maxSamples, invalidate]);

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
      // Detect real camera motion with a tolerance: float jitter from controls/resize
      // must not reset accumulation every frame (that froze the image at sample 1).
      camera.updateMatrixWorld();
      const renderCamera = physicalCamera.current;
      // Copy the view without PhysicalCamera.copy reading absent lens properties.
      THREE.PerspectiveCamera.prototype.copy.call(renderCamera, camera, false);
      renderCamera.bokehSize = photographicBokeh(depthOfField, dofStrength);
      renderCamera.focusDistance = photographicFocusDistance(camera, focusTarget);
      const focusChanged = Math.abs(lastFocus.current.bokeh - renderCamera.bokehSize) > 0.001 ||
        (depthOfField && Math.abs(lastFocus.current.distance - renderCamera.focusDistance) > 0.001);
      if (focusChanged || !matricesClose(current.world, camera.matrixWorld) || !matricesClose(current.projection, camera.projectionMatrix)) {
        lastFocus.current = { distance: renderCamera.focusDistance, bokeh: renderCamera.bokehSize };
        current.world.copy(camera.matrixWorld);
        current.projection.copy(camera.projectionMatrix);
        current.movedAt = now;
        if (current.ready) pt.updateCamera(); // updateCamera ALWAYS resets; never call unconditionally.
      }
      // Cheap environment checks run every painted frame, including the first
      // frame woken by an async HDR commit and when accumulation was capped.
      const environment = tracedEnvironmentRevision(scene);
      if (current.dirty || now - current.checkedAt >= 250) {
        current.checkedAt = now;
        scene.updateMatrixWorld(true);
        const revision = tracedSceneRevision(scene);
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
            pt.setScene(scene, renderCamera);
          } finally {
            hidden.forEach((object) => { object.visible = true; });
          }
          current.ready = true;
          current.dirty = false;
          current.revision = revision;
          current.environment = environment;
          current.movedAt = now;
        }
      }
      if (current.ready && environment !== current.environment) {
        pt.updateEnvironment(); // rebind lighting/background and reset old samples
        current.environment = environment;
      }
      // During movement renderSample uses one quarter-resolution preview sample.
      // Full-resolution tiles begin only after movement has settled.
      const cap = maxSamples.current;
      const capped = cap > 0 && pt.samples >= cap && now - current.movedAt >= PATH_TRACING.settleMs;
      pt.pausePathTracing = capped || now - current.movedAt < PATH_TRACING.settleMs;
      pt.renderSample();
      const samples = Math.floor(pt.samples);
      if (samples !== current.samples && (samples === 0 || now - current.reportedAt >= 250)) {
        current.samples = samples;
        current.reportedAt = now;
        report.current?.(samples);
      }
      // Keep converging until the user's final sample count (0 = unlimited).
      if (!capped) invalidate();
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
