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
      const { data, error } = await supabase
        .from("designers")
        .select("id")
        .ilike("name", value)
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });
};
