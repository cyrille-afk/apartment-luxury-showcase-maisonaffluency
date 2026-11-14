import { supabase } from "@/integrations/supabase/client";
import type { PlaceableProduct } from "@/lib/placedObjectFactory";
import type { QuoteFinishVariant } from "@/lib/quoteFinishSwatches";
import {
  resolveStudioSelection,
  studioAppearance,
  studioSelectedFinishes,
  type StudioFinish,
  type StudioFinishProduct,
} from "@/lib/studioFinishes";

export type VisualiserDefaultProduct = PlaceableProduct & {
  source_pick_id?: string | null;
  variants?: QuoteFinishVariant[] | null;
  baseLabel?: string | null;
  topLabel?: string | null;
  materials?: string | null;
  comMetres?: number | null;
  default_variant_label?: string | null;
};

type FinishLink = {
  price_tier_label?: string | null;
  price_cents_a?: number | null;
  image_indices?: number[] | null;
  fabrics: (StudioFinish & { supplier?: string | null; is_active?: boolean; price_per_lm_cents?: number | null; currency?: string | null }) | null;
};

/** Resolve only the chosen alternative, after its exact catalogue identity is known. */
export async function resolveVisualiserDefaultAppearance(product: VisualiserDefaultProduct) {
  const productKey = product.source_pick_id || product.id;
  const [pickResult, linksResult] = await Promise.all([
    supabase.from("designer_curator_picks").select("materials,base_axis_label,top_axis_label,size_variants,com_meters").eq("id", productKey).maybeSingle(),
    supabase.from("product_fabrics").select("pick_id,sort_order,price_tier_label,image_indices,price_cents_a,fabrics(id,name,supplier,category,image_url,is_active,price_per_lm_cents,currency)").eq("pick_id", productKey).order("sort_order"),
  ]);
  if (pickResult.error) throw pickResult.error;
  if (linksResult.error) throw linksResult.error;
  const pick = pickResult.data as { materials?: string | null; base_axis_label?: string | null; top_axis_label?: string | null; size_variants?: QuoteFinishVariant[] | null; com_meters?: number | null } | null;
  const finishes: StudioFinish[] = ((linksResult.data ?? []) as unknown as FinishLink[]).flatMap(link => {
    const finish = link.fabrics;
    if (!finish || finish.is_active === false) return [];
    return [{
      ...finish,
      brand_name: finish.supplier || product.brand_name,
      category: finish.category || "Fabric",
      material_type: finish.category,
      tier: link.price_tier_label,
      framePrice: link.price_cents_a,
      perMetre: finish.price_per_lm_cents,
      currency: finish.currency || undefined,
      pictured: link.image_indices?.includes(1),
    }];
  });
  const catalog: StudioFinishProduct = {
    name: product.product_name,
    variants: (pick?.size_variants ?? product.variants ?? product.size_variants ?? []) as QuoteFinishVariant[],
    finishes,
    materials: pick?.materials ?? product.materials,
    baseLabel: pick?.base_axis_label ?? product.baseLabel,
    topLabel: pick?.top_axis_label ?? product.topLabel,
    comMetres: pick?.com_meters ?? product.comMetres,
  };
  const selection = resolveStudioSelection(catalog, product.default_variant_label ?? null);
  return {
    appearance: studioAppearance(catalog, selection),
    finishLabel: studioSelectedFinishes(catalog, selection).map(({ finish }) => finish.name).join(" · ") || null,
  };
}
