import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live list of published designer profiles that carry at least one product.
 * Used to keep the Trade Gallery dropdown in sync with the live maker count.
 */
export function usePublishedMakerNames(): string[] | null {
  const { data } = useQuery({
    queryKey: ["published-maker-names"],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("published_maker_names");
      if (error) throw error;
      return (data as string[]) ?? null;
    },
  });
  return data ?? null;
}
