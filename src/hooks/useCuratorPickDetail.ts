import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Fetches the heavy fields (description, gallery_images, size_variants,
 * variant_image_map, variant_placeholder, base/top axis labels) for a single
 * curator pick. Kept OUT of `useDbCuratorPicks` so the listing payload stays
 * lightweight — call this only when a card is opened (lightbox / product page).
 */
export function useCuratorPickDetail(pickId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.curatorPickDetail(pickId ?? undefined),
    enabled: !!pickId && enabled,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      if (!pickId) return null;
      const { data, error } = await supabase
        .from("designer_curator_picks_public" as any)
        .select(
          "id, description, gallery_images, size_variants, variant_placeholder, base_axis_label, top_axis_label, variant_image_map"
        )
        .eq("id", pickId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}
