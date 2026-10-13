import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { EquirectangularReflectionMapping } from "three";

/** parse() returns pixel metadata, not a Texture; the loader must construct it. */
export function createExrEnvironmentTexture(buffer: ArrayBuffer) {
  const texture = new EXRLoader().createDataTexture(buffer);
  if (!texture.image?.data || !Number.isFinite(texture.image.width) || !Number.isFinite(texture.image.height) || texture.image.width <= 0 || texture.image.height <= 0) {
    texture.dispose();
    throw new Error("EXR has no readable image pixels");
  }
  texture.mapping = EquirectangularReflectionMapping;
  return texture;
}