import * as THREE from "three";
import type { WebGLPathTracer } from "three-gpu-pathtracer";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { isCompletePhotorealSample } from "./visualiserProgressivePresentation";

export const CHECKPOINT_INTERVAL_MS = 15000;
export interface RenderCheckpoint {
  version: 1;
  fingerprint: string;
  savedAt: number;
  samples: number;
  width: number;
  height: number;
  alpha: boolean;
  pixels: Float32Array;
  seed: number;
  renderScale: number;
  camera: { position: number[]; quaternion: number[]; target: number[] };
}
// Audited adapter for three-gpu-pathtracer 0.0.27. Never assign the read-only wrapper samples.
interface CheckpointTracer extends WebGLPathTracer {
  _queueReset: boolean;
  _pathTracer: {
    samples: number; alpha: boolean; _task: unknown; _currentTile: number;
    _primaryTarget: THREE.WebGLRenderTarget;
    _blendTargets: THREE.WebGLRenderTarget[];
    material: { seed: number };
  };
}
function internalTracer(pt: WebGLPathTracer): CheckpointTracer {
  const internal = pt as CheckpointTracer;
  if (!internal._pathTracer?._primaryTarget || internal._pathTracer._blendTargets?.length !== 2) {
    throw new Error("Render checkpoint adapter is incompatible with this renderer");
  }
  return internal;
}

export function captureAccumulation(pt: WebGLPathTracer, gl: THREE.WebGLRenderer) {
  const internal = internalTracer(pt);
  if (internal._queueReset || !isCompletePhotorealSample(pt.samples)) return null;
  const target = pt.target;
  // RGBA32F, linear HDR: a screenshot cannot restore the accumulated estimator.
  if (target.width * target.height * 16 > 256 * 1024 * 1024) throw new Error("Render checkpoint exceeds local storage budget");
  const pixels = new Float32Array(target.width * target.height * 4);
  gl.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
  return { pixels, samples: pt.samples, width: target.width, height: target.height,
    alpha: internal._pathTracer.alpha, seed: internal._pathTracer.material.seed };
}

export function restoreAccumulation(pt: WebGLPathTracer, gl: THREE.WebGLRenderer, checkpoint: RenderCheckpoint): boolean {
  const internal = internalTracer(pt);
  const engine = internal._pathTracer;
  if (internal._queueReset || pt.isCompiling || !validCheckpoint(checkpoint) ||
    pt.target.width !== checkpoint.width || pt.target.height !== checkpoint.height || engine.alpha !== checkpoint.alpha) return false;
  const texture = new THREE.DataTexture(checkpoint.pixels, checkpoint.width, checkpoint.height, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  const material = new THREE.ShaderMaterial({
    uniforms: { image: { value: texture } }, blending: THREE.NoBlending, depthTest: false, depthWrite: false,
    vertexShader: "varying vec2 uvOut; void main(){ uvOut=uv; gl_Position=vec4(position.xy,0.,1.); }",
    fragmentShader: "uniform sampler2D image; varying vec2 uvOut; void main(){ gl_FragColor=texture2D(image,uvOut); }",
  });
  const quad = new FullScreenQuad(material);
  const previous = gl.getRenderTarget();
  const scissor = gl.getScissorTest();
  try {
    // At complete sample boundaries the generator's private swap can be pending.
    // A fresh generator with BOTH alpha histories seeded from the same converged
    // average continues the identical weighted accumulation equation safely.
    const targets = checkpoint.alpha ? engine._blendTargets : [engine._primaryTarget];
    for (const target of targets) { gl.setRenderTarget(target); gl.setScissorTest(false); quad.render(gl); }
    engine._task = null;
    engine._currentTile = 0;
    engine.material.seed = checkpoint.seed;
    engine.samples = checkpoint.samples;
    return true;
  } finally {
    gl.setRenderTarget(previous); gl.setScissorTest(scissor);
    quad.dispose(); material.dispose(); texture.dispose();
  }
}

export function validCheckpoint(value: RenderCheckpoint): boolean {
  return value?.version === 1 && isCompletePhotorealSample(value.samples) &&
    Number.isInteger(value.width) && value.width > 0 && Number.isInteger(value.height) && value.height > 0 &&
    value.pixels instanceof Float32Array && value.pixels.length === value.width * value.height * 4 &&
    value.pixels.every(Number.isFinite) && Number.isFinite(value.seed) &&
    value.renderScale > 0 && value.renderScale <= 2 &&
    value.camera?.position.length === 3 && value.camera.quaternion.length === 4 && value.camera.target.length === 3 &&
    [...value.camera.position, ...value.camera.quaternion, ...value.camera.target].every(Number.isFinite);
}

/** Stable across reloads: UUIDs/version counters are deliberately excluded. */
export function renderFingerprint(scene: THREE.Scene, camera: THREE.Camera, signature: string, lens: number[]) {
  let hash = 2166136261;
  const add = (value: unknown) => {
    const text = typeof value === "number" ? value.toFixed(5) : String(value);
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  };
  const array = (values: ArrayLike<number>) => { add(values.length); for (let i = 0; i < values.length; i++) add(values[i]); };
  const texture = (t: THREE.Texture | null) => {
    if (!t) { add(null); return; }
    add(t.mapping); add(t.colorSpace); add(t.wrapS); add(t.wrapT); array(t.matrix.elements);
    const image = t.image;
    add(image?.currentSrc || image?.src || ""); add(image?.width); add(image?.height);
    if (image?.data) array(image.data);
  };
  add("checkpoint-v1:three-gpu-pathtracer-0.0.27:bounces-5:transmissive-6"); add(signature);
  array(camera.matrixWorld.elements); array(camera.projectionMatrix.elements); array(lens);
  texture(scene.environment); add(scene.environmentIntensity); array(scene.environmentRotation.toArray().slice(0, 3));
  if (scene.background instanceof THREE.Color) add(scene.background.getHexString()); else texture(scene.background);
  add(scene.backgroundIntensity); add(scene.backgroundBlurriness); array(scene.backgroundRotation.toArray().slice(0, 3));
  scene.traverseVisible(object => {
    if ((object as THREE.Light).isLight) {
      const light = object as THREE.Light; add(light.type); add(light.intensity); add(light.color.getHexString()); array(light.matrixWorld.elements);
    }
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.every(m => (m as THREE.MeshStandardMaterial).isMeshStandardMaterial)) return;
    array(mesh.matrixWorld.elements);
    for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) {
      add(name); array(attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data.array : attribute.array);
    }
    if (mesh.geometry.index) array(mesh.geometry.index.array);
    add(JSON.stringify(mesh.geometry.groups));
    for (const material of materials) {
      const data = material.toJSON();
      // UUID references do not identify contents across a new page load.
      add(JSON.stringify(data, (key, value) => ["uuid", "metadata", "textures", "images"].includes(key) || /Map$|^map$/.test(key) ? undefined : value));
      const pbr = material as THREE.MeshStandardMaterial;
      for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "alphaMap", "bumpMap", "emissiveMap", "displacementMap"] as const) texture(pbr[key]);
    }
  });
  return (hash >>> 0).toString(16);
}

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("ma-photoreal-checkpoints-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("renders");
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function loadRenderCheckpoint(key: string): Promise<RenderCheckpoint | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("renders").objectStore("renders").get(key);
      request.onsuccess = () => resolve(request.result && validCheckpoint(request.result) ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function saveRenderCheckpoint(key: string, checkpoint: RenderCheckpoint) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("renders", "readwrite");
      transaction.objectStore("renders").put(checkpoint, key);
      transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error); transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}