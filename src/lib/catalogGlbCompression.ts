export const CATALOG_TEXTURE_MAX_SIZE = 1024;
const DRACO_DECODER_WASM_URL = "/wasm/draco_decoder_gltf.wasm";
const DRACO_ENCODER_WASM_URL = "/wasm/draco_encoder.wasm";

export interface CompressedCatalogGlb {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  textureCount: number;
}

function outputName(filename: string): string {
  return `${filename.replace(/\.glb$/i, "") || "catalog-item"}-compressed.glb`;
}

/** Compress a raw binary glTF entirely in the admin's browser. */
export async function compressCatalogGlb(file: File): Promise<CompressedCatalogGlb> {
  if (!/\.glb$/i.test(file.name)) {
    throw new Error("Choose a raw .glb file for catalog compression.");
  }

  const [{ WebIO }, { ALL_EXTENSIONS }, { draco, textureCompress }, draco3dModule] = await Promise.all([
    import("@gltf-transform/core"),
    import("@gltf-transform/extensions"),
    import("@gltf-transform/functions"),
    import("draco3dgltf"),
  ]);
  const draco3d = draco3dModule.default;
  // These same-origin public URLs are fetched only after an admin submits a GLB.
  const [decoder, encoder] = await Promise.all([
    draco3d.createDecoderModule({ locateFile: () => DRACO_DECODER_WASM_URL }),
    draco3d.createEncoderModule({ locateFile: () => DRACO_ENCODER_WASM_URL }),
  ]);

  const io = new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.decoder": decoder,
      "draco3d.encoder": encoder,
    });

  let document;
  try {
    document = await io.readBinary(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("This GLB could not be read. Check that it is a valid binary glTF file.");
  }

  // textureCompress uses its browser image encoder when Sharp is absent.
  await document.transform(
    textureCompress({
      targetFormat: "webp",
      resize: [CATALOG_TEXTURE_MAX_SIZE, CATALOG_TEXTURE_MAX_SIZE],
    }),
    draco({ method: "edgebreaker" }),
  );

  const textures = document.getRoot().listTextures();
  const unconverted = textures.filter((texture) => texture.getImage() && texture.getMimeType() !== "image/webp");
  if (unconverted.length > 0) {
    throw new Error("One or more textures could not be converted to WebP. Check the source images and try again.");
  }

  const bytes = await io.writeBinary(document);
  if (bytes.byteLength === 0) throw new Error("Compression produced an empty GLB.");

  return {
    file: new File([bytes], outputName(file.name), { type: "model/gltf-binary" }),
    originalBytes: file.size,
    compressedBytes: bytes.byteLength,
    textureCount: textures.length,
  };
}
