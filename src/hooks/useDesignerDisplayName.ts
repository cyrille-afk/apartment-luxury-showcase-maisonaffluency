import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBrandToParent } from "@/lib/brandNormalization";

/**
 * Resolve a designer/brand filter query value into a friendly display label.
 *
 * Lookup order:
 *  1. Exact match on `designers.name` → use `display_name` if present, else `name`.
 *  2. Fall back to the brand-normalization map (child → parent label).
 *  3. Fall back to the raw value.
 *
 * Used by filter chips on TradeQuotes / TradeBoards / TradeProjectDetail
 * so the chip always reads as the designer's canonical label, not the raw
 * `brand_name` we filter on internally.
 */
export function useDesignerDisplayName(rawValue: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["designer-display-name", rawValue],
    enabled: !!rawValue,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!rawValue) return null;
      const { data } = await supabase
        .from("designers")
        .select("name, display_name")
        .eq("name", rawValue)
        .maybeSingle();
      return data?.display_name || data?.name || null;
    },
  });

  if (!rawValue) return "";
  return data || normalizeBrandToParent(rawValue) || rawValue;
}
