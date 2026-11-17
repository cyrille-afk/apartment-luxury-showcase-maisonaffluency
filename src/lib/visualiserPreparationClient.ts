import type * as THREE from "three";
import { decodeModel, encodeModel } from "./visualiserModelWire";
import { closeTextureImages, decodeTextures, encodeTextureImages } from "./visualiserPreparationTransport";
import type { PreparationJob, PreparationResult } from "./visualiserPreparation.worker";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { PartOverrides } from "./visualiserPartMapping";

let worker: Worker | undefined;
let id = 0;
const pending = new Map<number, { resolve: (result: PreparationResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
function resetWorker() {
  worker?.terminate(); worker = undefined;
  for (const job of pending.values()) { clearTimeout(job.timer); job.reject(new Error("The furniture could not be prepared. Retry the 3D view.")); }
  pending.clear();
}
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./visualiserPreparation.worker.ts", import.meta.url), { type: "module", name: "visualiser-model-preparation" });
  worker.onerror = resetWorker;
  worker.onmessageerror = resetWorker;
  worker.onmessage = (event: MessageEvent<PreparationResult>) => {
    const job = pending.get(event.data.id);
    if (!job) { closeTextureImages(event.data.images ?? []); return; }
    pending.delete(event.data.id); clearTimeout(job.timer);
    if (event.data.error) job.reject(new Error(event.data.error)); else job.resolve(event.data);
  };
  return worker;
}
export async function prepareVisualiserModel(scene: THREE.Object3D, object: PlacedObject, overrides: PartOverrides, anisotropy: number, signal: AbortSignal): Promise<THREE.Object3D> {
  const encoded = encodeModel(scene);
  const images = await encodeTextureImages(encoded.textures);
  if (signal.aborted) { closeTextureImages(images.images); throw new DOMException("Cancelled", "AbortError"); }
  const jobId = ++id;
  let cancel: () => void = () => {};
  const result = await new Promise<PreparationResult>((resolve, reject) => {
    const timer = setTimeout(resetWorker, 120000);
    pending.set(jobId, { resolve, reject, timer });
    cancel = () => { clearTimeout(timer); pending.delete(jobId); reject(new DOMException("Cancelled", "AbortError")); };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      getWorker().postMessage({ id: jobId, wire: encoded.wire, images: images.images, object, overrides, anisotropy, origin: window.location.origin } satisfies PreparationJob, [...encoded.transfers, ...images.transfers]);
    } catch { clearTimeout(timer); pending.delete(jobId); closeTextureImages(images.images); reject(new Error("The furniture could not be prepared. Retry the 3D view.")); }
  }).finally(() => signal.removeEventListener("abort", cancel));
  if (!result.wire || !result.images) throw new Error("The furniture could not be prepared. Retry the 3D view.");
  if (signal.aborted) { closeTextureImages(result.images); throw new DOMException("Cancelled", "AbortError"); }
  const model = decodeModel(result.wire, decodeTextures(result.wire, result.images));
  model.userData.visualiserWorkerPrepared = true;
  model.userData.visualiserPreparationMs = result.durationMs;
  return model;
}