import { describe, expect, it } from "vitest";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { compressCatalogGlb } from "@/lib/catalogGlbCompression";

async function rawTriangle(): Promise<File> {
  const document = new Document();
  const buffer = document.createBuffer();
  const positions = document.createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buffer);
  const indices = document.createAccessor()
    .setType("SCALAR")
    .setArray(new Uint16Array([0, 1, 2]))
    .setBuffer(buffer);
  const primitive = document.createPrimitive().setAttribute("POSITION", positions).setIndices(indices);
  const mesh = document.createMesh("Triangle").addPrimitive(primitive);
  const node = document.createNode("Triangle").setMesh(mesh);
  document.createScene("Scene").addChild(node);
  const bytes = await new NodeIO().registerExtensions(ALL_EXTENSIONS).writeBinary(document);
  return new File([bytes], "triangle.glb", { type: "model/gltf-binary" });
}

describe("browser catalog GLB compression", () => {
  it("writes a readable GLB with Draco mesh compression", async () => {
    const result = await compressCatalogGlb(await rawTriangle());
    expect(result.file.name).toBe("triangle-compressed.glb");
    expect(result.file.type).toBe("model/gltf-binary");
    expect(result.compressedBytes).toBeGreaterThan(0);

    const decoder = await draco3d.createDecoderModule();
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "draco3d.decoder": decoder });
    const decoded = await io.readBinary(new Uint8Array(await result.file.arrayBuffer()));
    expect(decoded.getRoot().listExtensionsUsed().map((extension) => extension.extensionName)).toContain("KHR_draco_mesh_compression");
    expect(decoded.getRoot().listMeshes()).toHaveLength(1);
  });

  it("rejects non-GLB source files before processing", async () => {
    await expect(compressCatalogGlb(new File(["{}"], "model.gltf"))).rejects.toThrow("raw .glb");
  });
});
