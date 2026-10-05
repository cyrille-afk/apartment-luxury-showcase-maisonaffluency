import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Single live count of published designer profiles that carry at least one product. */
export function usePublishedMakerCount(): number | null {
  const { data } = useQuery({
    queryKey: ["published-maker-count"],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("published_maker_count");
      if (error) throw error;
      return (data as number) ?? null;
    },
  });
  return data ?? null;
}
