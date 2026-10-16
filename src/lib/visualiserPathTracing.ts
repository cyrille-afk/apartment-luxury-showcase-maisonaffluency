import * as THREE from "three";

export const PATH_TRACING = {
  movingScale: 1,
  settledScale: 1,
  settleMs: 150,
  minSamples: 1,
  fadeMs: 0,
  /** Interior GI bounces; beyond ~5 the enclosed room adds cost, not visible light. */
  bounces: 5,
  transmissiveBounces: 6,
  /** Traced pixel density cap; accumulated jittered samples are already antialiased. */
  maxTracePixelRatio: 1.5,
} as const;

/** Tracer render scale for a canvas DPR: the live view keeps full DPR, tracing caps at 1.5×. */
export const tracedRenderScale = (renderScale: number, pixelRatio: number) =>
  renderScale * Math.min(1, PATH_TRACING.maxTracePixelRatio / Math.max(1, pixelRatio || 1));

export interface PathTraceQuality {
  /** Resolution fraction while the camera moves (0.1–1). */
  previewScale: number;
  /** Stop refining at this sample count; 0 = unlimited. */
  maxSamples: number;
  /** Final render resolution multiplier (0.5–2). */
  renderScale: number;
  /** Active key/environment lighting multiplier (0.2–3; 1 = baseline). */
  lightIntensity: number;
}
export const DEFAULT_PT_QUALITY: PathTraceQuality = { previewScale: PATH_TRACING.movingScale, maxSamples: 0, renderScale: PATH_TRACING.settledScale, lightIntensity: 1.6 };
export const PT_QUALITY_KEY = "trade-visualiser-pt-quality-v1";
export const clampPtQuality = (q: Partial<PathTraceQuality>): PathTraceQuality => ({
  previewScale: Math.min(1, Math.max(0.1, Number(q.previewScale) || DEFAULT_PT_QUALITY.previewScale)),
  maxSamples: Math.min(10000, Math.max(0, Math.round(Number(q.maxSamples) || 0))),
  renderScale: Math.min(2, Math.max(0.5, Number(q.renderScale) || DEFAULT_PT_QUALITY.renderScale)),
  lightIntensity: Math.min(3, Math.max(0.2, Number(q.lightIntensity) || DEFAULT_PT_QUALITY.lightIntensity)),
});
export function loadPtQuality(): PathTraceQuality {
  try {
    const saved = JSON.parse(localStorage.getItem(PT_QUALITY_KEY) || "{}");
    const quality = restorePhotorealQuality(saved);
    localStorage.setItem(PT_QUALITY_KEY, JSON.stringify({ ...quality, qualityVersion: 2 }));
    return quality;
  } catch { return DEFAULT_PT_QUALITY; }
}

/** Restore native-quality preview once, preserving later explicit quality choices. */
export function restorePhotorealQuality(saved: Partial<PathTraceQuality> & { qualityVersion?: number }): PathTraceQuality {
  return clampPtQuality(saved.qualityVersion === 2 ? saved : { ...saved, previewScale: 1, renderScale: Math.max(1, Number(saved.renderScale) || 1) });
}

export function isTraceableMesh(object: THREE.Object3D): object is THREE.Mesh {
  if (!(object as THREE.Mesh).isMesh || (object as THREE.Line).isLine || (object as THREE.Points).isPoints) return false;
  const material = (object as THREE.Mesh).material;
  const materials = Array.isArray(material) ? material : [material];
  return materials.length > 0 && materials.every((m) => Boolean(m) && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial);
}

/** Detect models/maps that finish loading after the page's placement signature. */
export function tracedSceneRevision(scene: THREE.Scene): string {
  const parts: string[] = [];
  scene.traverseVisible((object) => {
    if (!isTraceableMesh(object)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const position = object.geometry.getAttribute("position");
    const positionVersion = position instanceof THREE.InterleavedBufferAttribute ? position.data.version : position?.version;
    // Rounded so float jitter never registers as "objects moved" and resets accumulation.
    parts.push(object.uuid, object.geometry.uuid, String(positionVersion), object.matrixWorld.elements.map((v) => v.toFixed(4)).join(","));
    for (const material of materials) {
      const pbr = material as THREE.MeshStandardMaterial;
      parts.push(material.uuid, String(material.version), pbr.color.getHexString(), String(pbr.roughness), String(pbr.metalness));
      for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "alphaMap", "bumpMap", "emissiveMap", "displacementMap"] as const) {
        const texture = pbr[key];
        parts.push(texture ? `${texture.uuid}:${texture.version}` : "");
      }
    }
  });
  return parts.join("|");
}

export function tracedEnvironmentRevision(scene: THREE.Scene): string {
  const background = scene.background;
  return [scene.environment?.uuid, scene.environment?.version, scene.environmentIntensity,
    scene.environmentRotation.toArray().join(","),
    background instanceof THREE.Color ? background.getHexString() : background?.uuid,
    scene.backgroundIntensity, scene.backgroundBlurriness, scene.backgroundRotation.toArray().join(",")].join("|");
}

/** GPU class used to size Photoreal presets; presets only change sampling/resolution, never scene contents. */
export type GpuTier = "low" | "mid" | "high";
export type PhotorealPresetName = "balanced" | "high";

/** Classify the GPU from the WebGL renderer string (software/integrated → low, discrete → high). */
export function classifyGpu(renderer: string | null | undefined, cores = 4): GpuTier {
  const r = (renderer || "").toLowerCase();
  if (!r || /swiftshader|llvmpipe|software|basic render|mali-[gt][0-9]{1,2}\b|adreno \(tm\) [3-5]/.test(r)) return "low";
  if (/rtx|radeon rx|radeon pro|apple m[1-9] (pro|max|ultra)|apple m[3-9]|quadro|arc a/.test(r)) return "high";
  if (/intel|uhd|iris|adreno|mali|powervr/.test(r)) return cores >= 8 ? "mid" : "low";
  return "mid";
}

const PRESETS: Record<PhotorealPresetName, Record<GpuTier, Omit<PathTraceQuality, "lightIntensity">>> = {
  balanced: {
    low: { previewScale: 0.25, maxSamples: 256, renderScale: 0.75 },
    mid: { previewScale: 0.5, maxSamples: 512, renderScale: 1 },
    high: { previewScale: 1, maxSamples: 1024, renderScale: 1 },
  },
  high: {
    low: { previewScale: 0.25, maxSamples: 1024, renderScale: 1 },
    mid: { previewScale: 0.5, maxSamples: 2048, renderScale: 1 },
    high: { previewScale: 1, maxSamples: 2048, renderScale: 1.5 },
  },
};

/** Preset quality for a GPU tier; keeps the user's lighting choice. */
export const photorealPreset = (name: PhotorealPresetName, tier: GpuTier, lightIntensity = DEFAULT_PT_QUALITY.lightIntensity): PathTraceQuality =>
  clampPtQuality({ ...PRESETS[name][tier], lightIntensity });

/** Which preset (if any) the current quality matches for this tier. */
export const matchPhotorealPreset = (q: PathTraceQuality, tier: GpuTier): PhotorealPresetName | "custom" =>
  (Object.keys(PRESETS) as PhotorealPresetName[]).find((n) => {
    const p = PRESETS[n][tier];
    return p.previewScale === q.previewScale && p.maxSamples === q.maxSamples && p.renderScale === q.renderScale;
  }) ?? "custom";

export function detectGpuTier(): GpuTier {
  try {
    const gl = document.createElement("canvas").getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) return "low";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return classifyGpu(String(renderer), navigator.hardwareConcurrency || 4);
  } catch { return "mid"; }
}
