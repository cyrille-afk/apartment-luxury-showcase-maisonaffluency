import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WebGLPathTracer, PhysicalCamera } from "three-gpu-pathtracer";
import { photographicBokeh, photographicFocusDistance } from "@/lib/visualiserDepthOfField";
import { DEFAULT_PT_QUALITY, isTraceableMesh, PATH_TRACING, type PathTraceQuality, tracedEnvironmentRevision, tracedRenderScale, tracedSceneRevision } from "@/lib/visualiserPathTracing";
import { SHOWROOM } from "@/lib/showroomRendering";
import { canRetainPhotorealFrame, type PhotorealFrameCaptureRef } from "@/lib/visualiserPhotorealGhost";
import { configureProgressivePresentation } from "@/lib/visualiserProgressivePresentation";
import { adaptiveQuality, createAdaptiveState, emptySampleTiming, measureSampleDuration, recordSampleDuration, resetAdaptiveState, type AdaptiveSamplingState } from "@/lib/visualiserAdaptiveSampling";
import { captureAccumulation, CHECKPOINT_INTERVAL_MS, loadRenderCheckpoint, renderFingerprint, restoreAccumulation, saveRenderCheckpoint, type RenderCheckpoint } from "@/lib/visualiserRenderCheckpoint";

const matricesClose = (a: THREE.Matrix4, b: THREE.Matrix4, eps = 1e-5) => {
  for (let i = 0; i < 16; i++) if (Math.abs(a.elements[i] - b.elements[i]) > eps) return false;
  return true;
};

/** Owns the demand loop: native-quality tracing preview and progressive GI at rest. */
const PathTracerLayer = ({ signature, checkpointKey, onCheckpoint, onSamples, quality = DEFAULT_PT_QUALITY, depthOfField = false, focusTarget, dofStrength = 3, frameCaptureRef, adaptive = false, onAdaptiveChange }: { signature: string; checkpointKey?: string; onCheckpoint?: (result: "restored" | "unavailable") => void; onSamples?: (n: number) => void; quality?: PathTraceQuality; depthOfField?: boolean; focusTarget: THREE.Vector3; dofStrength?: number; frameCaptureRef?: PhotorealFrameCaptureRef; adaptive?: boolean; onAdaptiveChange?: (state: AdaptiveSamplingState) => void }) => {
  const { gl, scene, camera, controls, invalidate } = useThree();
  const checkpoint = useRef({ loading: false, candidate: null as RenderCheckpoint | null, cameraApplied: false, changedAt: 0, fingerprint: "", savedAt: 0, savedSamples: 0, writing: false, warned: false });
  const checkpointReport = useRef(onCheckpoint);
  checkpointReport.current = onCheckpoint;
  const saveNow = useRef<() => void>(() => {});
  useEffect(() => {
    if (!checkpointKey) return;
    let alive = true;
    Object.assign(checkpoint.current, { loading: true, candidate: null, cameraApplied: false, fingerprint: "", savedAt: 0, savedSamples: 0 });
    loadRenderCheckpoint(checkpointKey).then(value => {
      if (!alive) return;
      checkpoint.current.candidate = value;
    }).catch(() => {
      if (alive) checkpointReport.current?.("unavailable");
    }).finally(() => {
      if (alive) { checkpoint.current.loading = false; invalidate(); }
    });
    const flush = () => saveNow.current();
    const hide = () => { if (document.hidden) flush(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", flush);
    return () => { alive = false; flush(); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", flush); };
  }, [checkpointKey, invalidate]);
  const tracer = useRef<WebGLPathTracer | null>(null);
  const physicalCamera = useRef(new PhysicalCamera());
  const lastFocus = useRef({ distance: -1, bokeh: -1 });
  const report = useRef(onSamples);
  report.current = onSamples;
  const state = useRef({ ready: false, failed: false, dirty: true, revision: "", environment: "", checkedAt: 0, movedAt: 0, reportedAt: 0, samples: -1, world: new THREE.Matrix4(), projection: new THREE.Matrix4() });
  const retained = useRef<HTMLCanvasElement | null>(null);
  const retainFrame = () => {
    const pt = tracer.current;
    const current = state.current;
    if (!frameCaptureRef || !pt || !current.ready || current.failed ||
      !canRetainPhotorealFrame(pt.samples, performance.now() - current.movedAt, PATH_TRACING.settleMs, PATH_TRACING.minSamples)) return;
    // Copy only on a reset or explicit mode switch, never every accumulated sample.
    const snapshot = retained.current ?? document.createElement("canvas");
    snapshot.width = gl.domElement.width;
    snapshot.height = gl.domElement.height;
    try {
      const context = snapshot.getContext("2d");
      if (!context) return;
      context.drawImage(gl.domElement, 0, 0);
      retained.current = snapshot;
    } catch { /* A capture failure must never stop live rendering. */ }
  };
  useEffect(() => {
    if (!frameCaptureRef) { retained.current = null; return; }
    frameCaptureRef.current = () => {
      retainFrame();
      try { return retained.current?.toDataURL("image/png") ?? null; } catch { return null; }
    };
    return () => { frameCaptureRef.current = null; retained.current = null; };
  }, [frameCaptureRef, gl]);

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
      configureProgressivePresentation(pt);
      pt.bounces = PATH_TRACING.bounces;
      pt.transmissiveBounces = PATH_TRACING.transmissiveBounces;
      // No biased glossy blur: preserve authored reflections/refraction.
      pt.filterGlossyFactor = 0;
      pt.multipleImportanceSampling = true;
      pt.tiles.set(2, 2);
      pt.dynamicLowRes = true;
      pt.lowResScale = PATH_TRACING.movingScale;
      pt.renderScale = tracedRenderScale(PATH_TRACING.settledScale, gl.getPixelRatio());
      pt.renderDelay = 0;
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
  // Adaptive sampling: the user's quality is the ceiling; measured per-sample
  // cost can step resolution/preview/cap down and back up, never above it.
  const adaptiveState = useRef<AdaptiveSamplingState>(createAdaptiveState(quality));
  const adaptiveReport = useRef(onAdaptiveChange);
  adaptiveReport.current = onAdaptiveChange;
  const adaptiveOn = useRef(adaptive);
  adaptiveOn.current = adaptive;
  const timing = useRef(emptySampleTiming());
  useEffect(() => {
    const resume = () => {
      timing.current = emptySampleTiming();
      adaptiveState.current.durations = [];
      if (!document.hidden) invalidate();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [invalidate]);
  useEffect(() => {
    adaptiveState.current = resetAdaptiveState(adaptiveState.current, quality);
    timing.current = emptySampleTiming();
    const pt = tracer.current;
    if (!pt) return;
    pt.lowResScale = quality.previewScale;
    const renderScale = tracedRenderScale(quality.renderScale, gl.getPixelRatio());
    if (pt.renderScale !== renderScale) {
      pt.renderScale = renderScale;
      state.current.dirty = true; // resolution change requires a fresh accumulation
    }
    invalidate();
  }, [gl, quality.previewScale, quality.renderScale, quality.maxSamples, invalidate]);

  useEffect(() => {
    state.current.dirty = true;
    invalidate();
  }, [signature, invalidate]);

  saveNow.current = () => {
    const saved = checkpoint.current;
    const pt = tracer.current;
    if (!checkpointKey || !pt || !saved.fingerprint || saved.loading || saved.candidate || saved.writing ||
      state.current.dirty || state.current.failed || pt.samples <= saved.savedSamples) return;
    try {
      const accumulation = captureAccumulation(pt, gl);
      if (!accumulation) return;
      const orbit = controls as unknown as { target?: THREE.Vector3 } | null;
      const value: RenderCheckpoint = { ...accumulation, version: 1, signature, fingerprint: saved.fingerprint,
        savedAt: Date.now(), renderScale: pt.renderScale,
        camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), target: (orbit?.target ?? focusTarget).toArray() } };
      saved.writing = true;
      void saveRenderCheckpoint(checkpointKey, value).then(() => {
        saved.savedAt = performance.now(); saved.savedSamples = accumulation.samples;
      }).catch(() => {
        if (!saved.warned) { saved.warned = true; checkpointReport.current?.("unavailable"); }
      }).finally(() => { saved.writing = false; });
    } catch {
      if (!saved.warned) { saved.warned = true; checkpointReport.current?.("unavailable"); }
    }
  };

  useFrame(() => {
    const pt = tracer.current;
    const current = state.current;
    if (!pt || current.failed) {
      gl.render(scene, camera);
      return;
    }
    const now = performance.now();
    const saved = checkpoint.current;
    if (saved.loading) { gl.render(scene, camera); invalidate(); return; }
    if (saved.candidate && !saved.cameraApplied) {
      saved.cameraApplied = true;
      if (saved.candidate.signature === signature) {
        camera.position.fromArray(saved.candidate.camera.position);
        camera.quaternion.fromArray(saved.candidate.camera.quaternion);
        const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
        orbit?.target?.fromArray(saved.candidate.camera.target); orbit?.update?.();
        pt.renderScale = saved.candidate.renderScale;
      } else saved.candidate = null;
    }
    if (document.hidden) {
      timing.current = emptySampleTiming();
      return; // Pause without discarding GPU accumulation.
    }
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
        saved.fingerprint = ""; saved.changedAt = now; saved.savedSamples = 0;
        retainFrame();
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
          saved.fingerprint = ""; saved.changedAt = now; saved.savedSamples = 0;
          retainFrame();
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
        saved.fingerprint = ""; saved.changedAt = now; saved.savedSamples = 0;
        retainFrame();
        pt.updateEnvironment(); // rebind lighting/background and reset old samples
        current.environment = environment;
      }
      // Wait for async models, material maps and HDR to settle; validate content,
      // not the reload-specific UUIDs used for cheap live invalidation.
      if (checkpointKey && !saved.fingerprint && now - saved.changedAt >= 1000 && !pt.isCompiling) {
        saved.fingerprint = renderFingerprint(scene, camera, signature, [renderCamera.bokehSize, renderCamera.focusDistance]);
      }
      if (saved.candidate && saved.fingerprint) {
        const candidate = saved.candidate;
        if (candidate.fingerprint === saved.fingerprint && restoreAccumulation(pt, gl, candidate)) {
          saved.savedSamples = candidate.samples; saved.savedAt = now;
          report.current?.(candidate.samples); checkpointReport.current?.("restored");
        }
        // A subsequent late asset changes the live revision and resets normally.
        saved.candidate = null;
      }
      // A full-resolution traced preview remains active through geometry resets;
      // accumulation resumes once motion settles without reducing canvas DPR.
      const cap = adaptiveOn.current ? adaptiveState.current.maxSamples : maxSamples.current;
      const capped = cap > 0 && pt.samples >= cap && now - current.movedAt >= PATH_TRACING.settleMs;
      pt.pausePathTracing = capped || now - current.movedAt < PATH_TRACING.settleMs;
      // The engine advances stratified pixel jitter once per complete sample.
      // Keep one tile per tick; only publish once all four tiles share that sample.
      pt.renderSample();
      if (checkpointKey && now - saved.savedAt >= CHECKPOINT_INTERVAL_MS) saveNow.current();
      const samples = Math.floor(pt.samples);
      // Measure the real per-sample cost while settled and accumulating; on a
      // slow GPU step resolution/preview/cap down, on a fast one back up.
      if (adaptiveOn.current && current.ready && !capped && now - current.movedAt >= PATH_TRACING.settleMs) {
        const duration = measureSampleDuration(timing.current, samples, now, !document.hidden);
        if (duration !== null) {
          const adjusted = recordSampleDuration(adaptiveState.current, duration, now);
          if (adjusted) {
            const effective = adaptiveQuality(adaptiveState.current);
            pt.lowResScale = effective.previewScale;
            const nextScale = tracedRenderScale(effective.renderScale, gl.getPixelRatio());
            if (pt.renderScale !== nextScale) {
              retainFrame();
              pt.renderScale = nextScale;
              current.dirty = true; // Only actual resolution changes reset samples.
              saved.fingerprint = ""; saved.changedAt = now; saved.savedSamples = 0;
            }
            adaptiveReport.current?.(adaptiveState.current);
          }
        }
      } else {
        timing.current = emptySampleTiming();
      }
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
