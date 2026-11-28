import type { SurfaceProduct } from "../../supabase/functions/_shared/eyeLevelSurfaces";

export function surfaceCatalogueMetadata(product: { product_name: string; category?: string; category_role?: string; dimensions?: string | null; width_mm?: number | null; depth_mm?: number | null; height_mm?: number | null }): Omit<SurfaceProduct, "product_name"> {
  const category = product.category?.trim().toLowerCase();
  const role = product.category_role ?? (category === "rugs" || category === "rug" ? "rug" : ["artworks", "artwork", "wall art", "art"].includes(category ?? "") ? "artwork" : undefined);
  if (role !== "rug" && role !== "artwork") return {};
  const metadata: Omit<SurfaceProduct, "product_name"> = { category_role: role };
  // Multiple/custom sizes require explicit selection; never treat a multi-size string as W×D×H.
  const pair = product.dimensions?.trim().match(/^(?:W\s*)?([\d.]+)\s*[×x]\s*(?:[DLH]\s*)?([\d.]+)\s*(mm|cm|m)\s*$/i);
  if (pair) {
    const factor = pair[3]?.toLowerCase() === "mm" ? 0.001 : pair[3]?.toLowerCase() === "cm" ? 0.01 : 1;
    metadata.width_m = Number((Number(pair[1]) * factor).toPrecision(12));
    if (role === "artwork") metadata.height_m = Number((Number(pair[2]) * factor).toPrecision(12));
    else metadata.depth_m = Number((Number(pair[2]) * factor).toPrecision(12));
  } else if (!product.dimensions || !/[,/]|custom|concept/i.test(product.dimensions)) {
    if (product.width_mm && product.width_mm > 0) metadata.width_m = product.width_mm / 1000;
    if (role === "rug" && product.depth_mm && product.depth_mm > 0) metadata.depth_m = product.depth_mm / 1000;
    if (role === "artwork" && product.height_mm && product.height_mm > 0) metadata.height_m = product.height_mm / 1000;
  }
  return metadata;
}