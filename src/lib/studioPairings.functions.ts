import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rankStudioPairings, type PairingProduct } from "./studioPairings";

export const getStudioPairings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ referenceId: z.string().uuid(), selectedFinish: z.string().max(2000).nullable().optional(), excludedIds: z.array(z.string().uuid()).max(5000) }).parse(input))
  .handler(async ({ data, context }) => {
    const fields = "id, source_pick_id, product_name, brand_name, category, subcategory, materials, materials_description, default_variant_label, image_url, size_variants";
    const { data: reference, error } = await context.supabase.from("trade_products").select(fields).eq("id", data.referenceId).single();
    if (error || !reference) throw new Error("The selected piece could not be read. Please try again.");
    const catalogue: PairingProduct[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data: rows, error: readError } = await context.supabase.from("trade_products").select(fields)
        .eq("is_active", true).eq("is_hidden", false).not("image_url", "is", null)
        .order("id").range(offset, offset + 499);
      if (readError) throw new Error("The pairing catalogue is temporarily unavailable. Please try again.");
      catalogue.push(...(rows || []));
      if (!rows || rows.length < 500) break;
    }
    const allProducts = [reference, ...catalogue];
    const pickIds = [...new Set(allProducts.map(p => p.source_pick_id).filter((id): id is string => Boolean(id)))];
    const sourceDetails = new Map<string, { materials: string | null; materials_description: string | null; default_variant_label: string | null; size_variants: unknown }>();
    for (let offset = 0; offset < pickIds.length; offset += 100) {
      const { data: picks, error: pickError } = await context.supabase.from("designer_curator_picks")
        .select("id, materials, materials_description, default_variant_label, size_variants").in("id", pickIds.slice(offset, offset + 100));
      if (pickError) throw new Error("Source material details are temporarily unavailable.");
      for (const pick of picks || []) sourceDetails.set(pick.id, pick);
    }
    const hydrate = (product: PairingProduct): PairingProduct => {
      const pick = product.source_pick_id ? sourceDetails.get(product.source_pick_id) : undefined;
      return { ...product, materials: product.materials || pick?.materials || null,
        materials_description: product.materials_description || pick?.materials_description || null,
        default_variant_label: product.default_variant_label || pick?.default_variant_label || null,
        size_variants: Array.isArray(product.size_variants) && product.size_variants.length ? product.size_variants : pick?.size_variants };
    };
    const exclusions = [...data.excludedIds, ...catalogue.filter(p => data.excludedIds.includes(p.id)).map(p => p.source_pick_id || p.id)];
    const { data: favorites, error: favoriteError } = await context.supabase.from("studio_favorite_pairings")
      .select("product_id").eq("user_id", context.userId).eq("reference_id", data.referenceId);
    if (favoriteError) throw new Error("Saved pairings could not be read. Please try again.");
    const favoriteIds = (favorites || []).map(row => row.product_id);
    const favoriteSet = new Set(favoriteIds);
    const source = { ...hydrate(reference), selected_finish: data.selectedFinish };
    const hydratedCatalogue = catalogue.map(hydrate);
    // RLS remains the read boundary; never return catalogue attributes or prices.
    return { recommendations: rankStudioPairings(source, hydratedCatalogue, exclusions), favoriteIds,
      savedRecommendations: rankStudioPairings(source, hydratedCatalogue.filter(product => favoriteSet.has(product.id)), exclusions,
        { perRole: catalogue.length, total: catalogue.length }) };
  });