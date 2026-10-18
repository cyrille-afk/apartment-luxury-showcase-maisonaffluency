import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCuratedPairingRules(enabled = true, admin = false) {
  return useQuery({
    queryKey: ["curated-pairing-rules", admin ? "admin" : "public"],
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        let query = supabase.from("curated_pairing_rules").select("*").order("sort_order").order("id").range(offset, offset + 999);
        if (!admin) query = query.eq("enabled", true);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) return rows;
      }
    },
  });
}