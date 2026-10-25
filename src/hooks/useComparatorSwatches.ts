import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ComparatorSwatch } from "@/lib/comparatorSwatches";

/** Fetch only the selected pieces' public finish metadata; never cache prices in a draft. */
export function useComparatorSwatches(ids: string[]) {
  const stableIds = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["comparator-swatches", stableIds], enabled: stableIds.length > 0, staleTime: 60_000,
    queryFn: async () => {
      const { data: trades, error: tradeError } = await supabase.from("trade_products").select("id,source_pick_id").in("id", stableIds);
      if (tradeError) throw tradeError;
      const canonical = new Map((trades ?? []).map(t => [t.id, t.source_pick_id || t.id]));
      const pickIds = [...new Set(stableIds.map(id => canonical.get(id) || id))];
      const { data, error } = await supabase.from("product_fabric_swatches_public").select("pick_id,fabric_id,name,image_url,sort_order").in("pick_id", pickIds).eq("is_active", true).order("sort_order", { ascending: true });
      if (error) throw error;
      return new Map<string, ComparatorSwatch[]>(stableIds.map(id => [id, (data ?? []).filter(row => row.pick_id === (canonical.get(id) || id)).map(row => ({ id: row.fabric_id, name: row.name, imageUrl: row.image_url }))]));
    },
  });
}