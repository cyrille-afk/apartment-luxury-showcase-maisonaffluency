import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true when the given `founder` value corresponds to an actual designer/brand
 * page (e.g. "Ecart"), and false when it is simply the studio's human founder
 * (e.g. Dagmar → "Aaron Fitzgerald"), which must not be shown as a brand line.
 */
export const useFounderIsBrand = (founder?: string | null) => {
  const value = (founder || "").trim();
  return useQuery({
    queryKey: ["founder-is-brand", value.toLowerCase()],
    enabled: value.length > 0,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      // Name-only public roster: includes trade-only houses (e.g. "Sé
      // Collections") that RLS hides from anonymous reads of `designers`,
      // so public and trade pages print the same brand attribution line.
      const { data, error } = await supabase
        .from("designer_brand_names")
        .select("name")
        .ilike("name", value)
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });
};
