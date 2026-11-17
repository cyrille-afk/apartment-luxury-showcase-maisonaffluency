import * as THREE from "three";
import OpenSubdiv, { type OpenSubdivModule } from "@nasedkinpv/opensubdiv-wasm";
import { decodeModel, encodeModel, type ModelWire } from "./visualiserModelWire";
import { closeTextureImages, decodeTextures, encodeTextureImages, type TextureImageWire } from "./visualiserPreparationTransport";
import { loadMaterialMaps, prepareModel } from "./visualiserModelPreparation";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { PartOverrides } from "./visualiserPartMapping";
import { BOND_STREET_BASE_FINISH, isBondStreetStool } from "./visualiserProductFinishes";

export type PreparationJob = { id: number; wire: ModelWire; images: TextureImageWire[]; object: PlacedObject; overrides: PartOverrides; anisotropy: number; origin: string };
export type PreparationResult = { id: number; wire?: ModelWire; images?: TextureImageWire[]; error?: string; durationMs?: number };
let subdivision: Promise<OpenSubdivModule | null> | undefined;
async function run(job: PreparationJob) {
  const started = performance.now();
  let model: THREE.Object3D | undefined;
  let textures = new Map<string, THREE.Texture>();
  const ownedTextures = new Set<THREE.Texture>();
  try {
    const sourceTextures = decodeTextures(job.wire, job.images);
    for (const texture of sourceTextures.values()) ownedTextures.add(texture);
    const scene = decodeModel(job.wire, sourceTextures);
    subdivision ??= OpenSubdiv({ locateFile: () => `${job.origin}/wasm/opensubdiv.wasm` }).catch(() => null);
    const finishes = [job.object.material, job.object.topMaterial, job.object.baseMaterial ?? (isBondStreetStool(job.object.id) ? BOND_STREET_BASE_FINISH : null), job.object.upholsteryMaterial, ...Object.values(job.object.partMaterials ?? {})];
    const distinct = [...new Map(finishes.filter(f => Boolean(f)).map(f => [f?.id, f])).values()];
    const maps = new Map(await Promise.all(distinct.map(async finish => {
      if (!finish) throw new Error("Invalid finish");
      const absolute = { ...finish };
      for (const key of ["image_url", "diffuse_url", "normal_url", "roughness_url"] as const) if (absolute[key]) absolute[key] = new URL(absolute[key], job.origin).href;
      return [finish.id, await loadMaterialMaps(absolute, job.anisotropy)] as const;
    })));
    for (const mapsForFinish of maps.values()) for (const texture of Object.values(mapsForFinish)) if (texture) ownedTextures.add(texture);
    model = prepareModel(scene, job.object, job.overrides, maps, await subdivision);
    const encoded = encodeModel(model);
    textures = encoded.textures;
    for (const texture of textures.values()) ownedTextures.add(texture);
    const images = await encodeTextureImages(textures);
    const result: PreparationResult = { id: job.id, wire: encoded.wire, images: images.images, durationMs: performance.now() - started };
    self.postMessage(result, { transfer: [...encoded.transfers, ...images.transfers] });
  } catch {
    self.postMessage({ id: job.id, error: "The furniture could not be prepared. Retry the 3D view." } satisfies PreparationResult);
  } finally {
    closeTextureImages(job.images);
    for (const texture of ownedTextures) { if (texture.image instanceof ImageBitmap) texture.image.close(); texture.dispose(); }
    model?.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); for (const m of Array.isArray(child.material) ? child.material : [child.material]) m.dispose(); } });
  }
}
// A single worker serializes preparation; asynchronous finish fetches cannot overlap CPU jobs.
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<PreparationJob>) => { queue = queue.then(() => run(event.data)); };