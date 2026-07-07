// Client-side OBJ (+ optional MTL + textures) → GLB conversion.
// Uses three.js OBJLoader/MTLLoader + GLTFExporter from three-stdlib.
import * as THREE from "three";
import { OBJLoader } from "three-stdlib";
import { MTLLoader } from "three-stdlib";
import { GLTFExporter } from "three-stdlib";

const TEXTURE_EXTS = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tga", "tif", "tiff"];

function baseName(name: string): string {
  return name.split(/[\\/]/).pop() || name;
}

export interface ObjBundle {
  objFile: File;
  mtlFile?: File;
  textureFiles: File[];
  extraObjFiles: File[]; // additional OBJs that will be merged into one GLB
}

export function classifyObjBundle(files: File[]): ObjBundle | null {
  const objs = files.filter((f) => f.name.toLowerCase().endsWith(".obj"));
  if (objs.length === 0) return null;
  const mtl = files.find((f) => f.name.toLowerCase().endsWith(".mtl"));
  const textures = files.filter((f) => {
    const ext = f.name.toLowerCase().split(".").pop() || "";
    return TEXTURE_EXTS.includes(ext);
  });
  return {
    objFile: objs[0],
    extraObjFiles: objs.slice(1),
    mtlFile: mtl,
    textureFiles: textures,
  };
}

async function loadMaterialsFromMtl(
  mtlFile: File,
  textureFiles: File[]
): Promise<any> {
  const mtlText = await mtlFile.text();
  const manager = new THREE.LoadingManager();

  // Map basename → blob URL so MTLLoader can resolve `map_Kd texture.png` etc.
  const blobMap = new Map<string, string>();
  const blobUrls: string[] = [];
  for (const tex of textureFiles) {
    const url = URL.createObjectURL(tex);
    blobMap.set(baseName(tex.name).toLowerCase(), url);
    blobUrls.push(url);
  }
  manager.setURLModifier((url) => {
    const key = baseName(url).toLowerCase();
    return blobMap.get(key) || url;
  });

  const loader = new MTLLoader(manager);
  const materialCreator = loader.parse(mtlText, "");
  materialCreator.preload();
  // Track blobs so caller can revoke later.
  (materialCreator as any).__blobUrls = blobUrls;
  return materialCreator;
}

async function loadObj(objFile: File, materialCreator: any | null): Promise<THREE.Group> {
  const objText = await objFile.text();
  const loader = new OBJLoader();
  if (materialCreator) loader.setMaterials(materialCreator);
  return loader.parse(objText);
}

/**
 * Convert an OBJ bundle into a single .glb File.
 */
export async function convertObjBundleToGlb(
  bundle: ObjBundle,
  outputName = "model.glb"
): Promise<File> {
  const materialCreator = bundle.mtlFile
    ? await loadMaterialsFromMtl(bundle.mtlFile, bundle.textureFiles)
    : null;

  const root = new THREE.Group();
  root.name = "root";

  const parts = [bundle.objFile, ...bundle.extraObjFiles];
  for (const objFile of parts) {
    const group = await loadObj(objFile, materialCreator);
    group.name = objFile.name.replace(/\.obj$/i, "");
    root.add(group);
  }

  const glbArrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      root,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error("GLTFExporter did not return binary GLB"));
      },
      (err) => reject(err),
      { binary: true, embedImages: true, onlyVisible: false } as any
    );
  });

  // Revoke blob URLs used for textures.
  if (materialCreator && (materialCreator as any).__blobUrls) {
    for (const url of (materialCreator as any).__blobUrls as string[]) {
      URL.revokeObjectURL(url);
    }
  }

  return new File([glbArrayBuffer], outputName, { type: "model/gltf-binary" });
}
