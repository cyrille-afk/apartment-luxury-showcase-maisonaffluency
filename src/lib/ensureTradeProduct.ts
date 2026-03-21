import { supabase } from "@/integrations/supabase/client";

export interface ProductMeta {
  product_name: string;
  brand_name: string;
  category?: string;
  image_url?: string | null;
  dimensions?: string | null;
  materials?: string | null;
}

/**
 * Finds an existing trade_products record matching the given name+brand,
 * or creates one. Returns the real UUID.
 */
export async function ensureTradeProductId(meta: ProductMeta): Promise<string | null> {
  // Try exact match first
  const { data: existing } = await supabase
    .from("trade_products")
    .select("id")
    .eq("product_name", meta.product_name)
    .eq("brand_name", meta.brand_name)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  // Try fuzzy match (brand match + name ilike)
  const { data: fuzzy } = await supabase
    .from("trade_products")
    .select("id")
    .eq("brand_name", meta.brand_name)
    .ilike("product_name", `%${meta.product_name}%`)
    .limit(1)
    .maybeSingle();

  if (fuzzy?.id) return fuzzy.id;

  // Create new record
  const { data: created, error } = await supabase
    .from("trade_products")
    .insert({
      product_name: meta.product_name,
      brand_name: meta.brand_name,
      category: meta.category || "Uncategorized",
      image_url: meta.image_url || null,
      dimensions: meta.dimensions || null,
      materials: meta.materials || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to ensure trade product:", error.message);
    return null;
  }

  return created?.id || null;
}
