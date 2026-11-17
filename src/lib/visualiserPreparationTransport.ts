import * as THREE from "three";
import type { ModelWire } from "./visualiserModelWire";

export type TextureImageWire = { uuid: string; bitmap?: ImageBitmap; data?: THREE.TypedArray; width: number; height: number };
export async function encodeTextureImages(textures: Map<string, THREE.Texture>): Promise<{ images: TextureImageWire[]; transfers: Transferable[] }> {
  const images: TextureImageWire[] = [], transfers: Transferable[] = [];
  for (const [uuid, texture] of textures) {
    const image = texture.image as (ImageBitmapSource & { data?: THREE.TypedArray; width: number; height: number }) | undefined;
    if (!image) continue;
    if (image.data) {
      const data = image.data.slice();
      images.push({ uuid, data, width: image.width, height: image.height });
      transfers.push(data.buffer as ArrayBuffer);
    } else {
      const bitmap = await createImageBitmap(image);
      images.push({ uuid, bitmap, width: bitmap.width, height: bitmap.height });
      transfers.push(bitmap);
    }
  }
  return { images, transfers };
}
export function decodeTextures(wire: ModelWire, images: TextureImageWire[]): Map<string, THREE.Texture> {
  const byUuid = new Map(images.map(image => [image.uuid, image]));
  const sources: Record<string, THREE.Source<unknown>> = {};
  for (const definition of wire.textures) {
    const image = byUuid.get(definition.uuid);
    if (!image) continue;
    sources[String(definition.image)] = new THREE.Source(image.bitmap ?? { data: image.data, width: image.width, height: image.height });
  }
  return new Map(Object.entries(new THREE.ObjectLoader().parseTextures(wire.textures, sources)));
}
export function closeTextureImages(images: TextureImageWire[]) {
  for (const image of images) image.bitmap?.close();
}