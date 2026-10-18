import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveFelixCatalogueFinishes } from "@/lib/felixQuoteFinishes";
import type { QuoteFinishVariant } from "@/lib/quoteFinishSwatches";

/** Batch metadata only; prices and server-side sourcing remain untouched. */
export function useFelixCatalogueFinishes(ids: string[]) {
  const stableIds = [...new Set(ids)].sort();
  const { data = {} } = useQuery({
    queryKey: ["felix-catalogue-finish-metadata", stableIds],
    enabled: stableIds.length > 0,
    queryFn: async () => {
      const { data: trades, error: tradeError } = await supabase.from("trade_products").select("id,source_pick_id,base_axis_label,top_axis_label,variant_placeholder,size_variants").in("id", stableIds);
      if (tradeError) throw tradeError;
      const canonicalIds = [...new Set([...stableIds, ...(trades ?? []).flatMap(t => t.source_pick_id ? [t.source_pick_id] : [])])];
      const [{ data: picks, error: pickError }, { data: swatches, error: swatchError }] = await Promise.all([
        supabase.from("designer_curator_picks").select("id,base_axis_label,top_axis_label,variant_placeholder,size_variants").in("id", canonicalIds),
        supabase.from("product_fabric_swatches_public").select("pick_id,fabric_id,name,image_url,category,sort_order").in("pick_id", canonicalIds).eq("is_active", true),
      ]);
      if (pickError || swatchError) throw pickError || swatchError;
      return Object.fromEntries(stableIds.map(id => {
        const canonicalId = trades?.find(t => t.id === id)?.source_pick_id || id;
        return [id, { product: picks?.find(p => p.id === canonicalId) ?? trades?.find(t => t.id === id), swatches: (swatches ?? []).filter(s => s.pick_id === canonicalId) }];
      }));
    },
    staleTime: 60_000,
  });
  return (id: string, variant: string | null | undefined) => {
    const entry = data[id];
    if (!entry) return [];
    const product = entry.product;
    return resolveFelixCatalogueFinishes({ ...product, size_variants: Array.isArray(product?.size_variants) ? product.size_variants as QuoteFinishVariant[] : [] }, variant, entry.swatches);
  };
}