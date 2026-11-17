import { supabase } from "@/integrations/supabase/client";
import { compressCatalogGlb, type CompressedCatalogGlb } from "@/lib/catalogGlbCompression";

export interface CatalogItemDetails {
  sku: string;
  name: string;
  designer: string | null;
  category_role: string;
  room_type: string[];
  width_m: number;
  depth_m: number;
  height_m: number;
  base_price_sgd: number;
  base_lead_time_weeks: number;
}

export interface CatalogItemRecord extends CatalogItemDetails {
  id: string;
  glb_url_compressed: string;
  glb_url_proxy: string | null;
}

export type CatalogUploadStage = "compressing" | "uploading" | "saving";

interface UploadCatalogGlbOptions {
  file: File;
  details: CatalogItemDetails;
  /** Omit to create a new catalog item after compression. */
  itemId?: string;
  onStage?: (stage: CatalogUploadStage) => void;
}

export interface UploadedCatalogGlb {
  record: CatalogItemRecord;
  publicUrl: string;
  compression: CompressedCatalogGlb;
}

function safePathSegment(value: string): string {
  return value.trim().replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "item";
}

export function validateCatalogItemDetails(details: CatalogItemDetails): void {
  if (!details.sku.trim() || !details.name.trim() || !details.category_role.trim()) {
    throw new Error("SKU, item name, and category / role are required.");
  }
  if (details.room_type.length === 0 || details.room_type.some((room) => !room.trim())) {
    throw new Error("Add at least one room type.");
  }
  if (![details.width_m, details.depth_m, details.height_m].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Width, depth, and height must be positive measurements in metres.");
  }
  if (!Number.isFinite(details.base_price_sgd) || details.base_price_sgd < 0) {
    throw new Error("Base price must be zero or greater.");
  }
  if (!Number.isInteger(details.base_lead_time_weeks) || details.base_lead_time_weeks < 0) {
    throw new Error("Lead time must be a whole number of weeks, zero or greater.");
  }
}

/** Compress first, then upload only the optimized GLB and persist its public URL. */
export async function uploadCatalogGlb({
  file,
  details,
  itemId,
  onStage,
}: UploadCatalogGlbOptions): Promise<UploadedCatalogGlb> {
  validateCatalogItemDetails(details);
  onStage?.("compressing");
  const compressionStarted = performance.now();
  let compression: CompressedCatalogGlb;
  try {
    compression = await compressCatalogGlb(file);
  } catch (error) {
    window.__lovableEvents?.track?.("project.catalog_glb_compression_failed", {
      original_bytes: file.size,
      duration_ms: performance.now() - compressionStarted,
    });
    throw error;
  }
  window.__lovableEvents?.track?.("project.catalog_glb_compression_succeeded", {
    original_bytes: compression.originalBytes,
    optimized_bytes: compression.compressedBytes,
    duration_ms: performance.now() - compressionStarted,
  });

  const path = `catalog-items/${safePathSegment(details.sku)}/${Date.now()}-${safePathSegment(compression.file.name.replace(/\.glb$/i, ""))}.glb`;
  onStage?.("uploading");
  const { error: uploadError } = await supabase.storage.from("assets").upload(path, compression.file, {
    contentType: "model/gltf-binary",
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const publicUrl = supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
  onStage?.("saving");

  const query = itemId
    ? supabase.from("catalog_items").update({ glb_url_compressed: publicUrl }).eq("id", itemId)
    : supabase.from("catalog_items").insert({ ...details, glb_url_compressed: publicUrl });
  const { data, error } = await query.select("*").single();

  if (error) {
    // A failed database save must not leave an unreferenced public model.
    await supabase.storage.from("assets").remove([path]);
    throw error;
  }

  window.__lovableEvents?.track?.("project.catalog_glb_upload_completed", {
    original_bytes: compression.originalBytes,
    optimized_bytes: compression.compressedBytes,
    mode: itemId ? "replace" : "create",
  });
  return { record: data as CatalogItemRecord, publicUrl, compression };
}
