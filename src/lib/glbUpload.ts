import { supabase } from "@/integrations/supabase/client";
import { classifyObjBundle, convertObjBundleToGlb, convert3dsToGlb } from "@/lib/objToGlb";

export const GLB_MAX_MB = 50;

export interface PreparedGlb {
  file: File;
  ext: "glb" | "gltf";
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
      return { file: f, ext: n.endsWith(".gltf") ? "gltf" : "glb" };
    }
    if (n.endsWith(".3ds")) {
      const outName = f.name.replace(/\.3ds$/i, "") + ".glb";
      const file = await convert3dsToGlb(f, outName);
      return { file, ext: "glb", convertedFrom: f.name };
    }
  }

  const bundle = classifyObjBundle(files);
  if (bundle) {
    const outName = bundle.objFile.name.replace(/\.obj$/i, "") + ".glb";
    const file = await convertObjBundleToGlb(bundle, outName);
    return { file, ext: "glb", convertedFrom: bundle.objFile.name };
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

  if (existing) {
    const { error } = await supabase
      .from("trade_product_glb_variants")
      .update({ glb_url: publicUrl, file_size_bytes: file.size })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("trade_product_glb_variants").insert({
      product_id: productId,
      variant_label: label,
      glb_url: publicUrl,
      file_size_bytes: file.size,
      is_default: shouldBeDefault,
    });
    if (error) throw error;
  }
}
