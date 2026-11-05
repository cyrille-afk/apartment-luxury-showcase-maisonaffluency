import { supabase } from "@/integrations/supabase/client";
import { Box3, Vector3 } from "three";
import { GLTFLoader } from "three-stdlib";
import { classifyObjBundle, convertObjBundleToGlb, convert3dsToGlb } from "@/lib/objToGlb";

export const GLB_MAX_MB = 50;

export interface GlbDimensions {
  wCm: number;
  dCm: number;
  hCm: number;
}

/**
 * Normalize a raw bounding-box size to whole centimetres. glTF is specified
 * in metres, but many studio exports are authored in cm or mm — pick the
 * unit from the magnitude so a 1.08 m table and a 1080 mm table both read
 * as 108 cm.
 */
export function normalizeSizeToCm(size: { x: number; y: number; z: number }): GlbDimensions | null {
  const max = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(max) || max <= 0) return null;
  const factor = max < 20 ? 100 : max > 400 ? 0.1 : 1;
  const round = (v: number) => Math.max(1, Math.round(v * factor));
  return { wCm: round(size.x), dCm: round(size.z), hCm: round(size.y) };
}

/** Unit the admin wants detected dimensions pre-filled in. */
export type DimensionUnit = "cm" | "mm" | "in";

/** Variant label matching the admin convention ("W 108 × D 108"). */
export function formatDimensionLabel(d: GlbDimensions, unit: DimensionUnit = "cm"): string {
  if (unit === "mm") return `W ${d.wCm * 10} × D ${d.dCm * 10} mm`;
  if (unit === "in") {
    const toIn = (v: number) => `${Math.round((v / 2.54) * 10) / 10}`;
    return `W ${toIn(d.wCm)} × D ${toIn(d.dCm)} in`;
  }
  return `W ${d.wCm} × D ${d.dCm}`;
}

/**
 * Measure a .glb/.gltf model's real bounding box in the browser. Returns
 * null when the file cannot be parsed — callers keep their manual label.
 */
export async function measureGlbDimensions(file: File): Promise<GlbDimensions | null> {
  try {
    const loader = new GLTFLoader();
    const data: ArrayBuffer | string = /\.gltf$/i.test(file.name)
      ? await file.text()
      : await file.arrayBuffer();
    const gltf = await loader.parseAsync(data, "");
    const size = new Box3().setFromObject(gltf.scene).getSize(new Vector3());
    return normalizeSizeToCm(size);
  } catch {
    return null;
  }
}

export interface PreparedGlb {
  file: File;
  ext: "glb" | "gltf";
  originalFormat: "glb" | "gltf" | "obj" | "3ds";
  originalFilenames: string[];
  /** Set when the source needed in-browser conversion (3ds/obj). */
  convertedFrom?: string;
}

/**
 * Turn the admin's picked files into a single uploadable GLB/GLTF.
 * Accepts a lone .glb/.gltf, a lone .3ds (converted in-browser), or an
 * .obj bundle (.obj + .mtl + textures). Throws with a user-facing message.
 */
export async function prepareGlbFile(files: File[]): Promise<PreparedGlb> {
  if (files.length === 0) throw new Error("No file selected.");

  if (files.length === 1) {
    const f = files[0];
    const n = f.name.toLowerCase();
    if (n.endsWith(".glb") || n.endsWith(".gltf")) {
      const ext = n.endsWith(".gltf") ? "gltf" : "glb";
      return { file: f, ext, originalFormat: ext, originalFilenames: [f.name] };
    }
    if (n.endsWith(".3ds")) {
      const outName = f.name.replace(/\.3ds$/i, "") + ".glb";
      const file = await convert3dsToGlb(f, outName);
      return { file, ext: "glb", convertedFrom: f.name, originalFormat: "3ds", originalFilenames: [f.name] };
    }
  }

  const bundle = classifyObjBundle(files);
  if (bundle) {
    const outName = bundle.objFile.name.replace(/\.obj$/i, "") + ".glb";
    const file = await convertObjBundleToGlb(bundle, outName);
    return { file, ext: "glb", convertedFrom: bundle.objFile.name, originalFormat: "obj", originalFilenames: files.map(f => f.name) };
  }

  throw new Error("Please upload a .glb/.gltf, a .3ds, or an .obj (+ .mtl + textures).");
}

export interface UploadGlbOptions {
  productId: string;
  label: string;
  prepared: PreparedGlb;
  /** Existing variant rows for this product (for replace/default logic). */
  existingVariants: { id: string; variant_label: string; is_default: boolean }[];
  onProgress?: (pct: number) => void;
}

/**
 * Upload a prepared GLB to the assets bucket and upsert the
 * trade_product_glb_variants row. Shared by the single-product manager and
 * the bulk uploader so the two paths cannot drift.
 */
export async function uploadGlbForProduct({
  productId,
  label,
  prepared,
  existingVariants,
  onProgress,
}: UploadGlbOptions): Promise<void> {
  const { file, ext } = prepared;
  if (file.size > GLB_MAX_MB * 1024 * 1024) {
    throw new Error(`${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the ${GLB_MAX_MB} MB limit.`);
  }

  const safeLabel = label.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const path = `glb-models/${productId}/${safeLabel}-${Date.now()}.${ext}`;
  const contentType = ext === "glb" ? "model/gltf-binary" : "model/gltf+json";
  const { error: upErr } = await supabase.storage.from("assets").upload(path, file, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
    onUploadProgress: (evt: { loaded?: number; total?: number }) => {
      onProgress?.(Math.round(((evt.loaded || 0) / (evt.total || file.size)) * 100));
    },
  } as any);
  if (upErr) throw upErr;

  const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  const existing = existingVariants.find(
    (v) => v.variant_label.toLowerCase() === label.toLowerCase(),
  );
  const shouldBeDefault = existingVariants.length === 0 || (existing?.is_default ?? false);
  const metadata = {
    original_upload_format: prepared.originalFormat,
    original_upload_filenames: prepared.originalFilenames,
  };

  if (existing) {
    const { error } = await supabase
      .from("trade_product_glb_variants")
      .update({ glb_url: publicUrl, file_size_bytes: file.size, ...metadata })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("trade_product_glb_variants").insert({
      product_id: productId,
      variant_label: label,
      glb_url: publicUrl,
      file_size_bytes: file.size,
      is_default: shouldBeDefault,
      ...metadata,
    });
    if (error) throw error;
  }
}
