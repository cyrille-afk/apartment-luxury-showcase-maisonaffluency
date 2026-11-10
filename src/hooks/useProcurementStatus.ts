import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { procurementState } from "@/lib/procurementStatus";

export const procurementQuoteKey = (quoteId: string) => ["procurement-quote-state", quoteId];
export function useProcurementStatus(quoteId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: procurementQuoteKey(quoteId || ""),
    enabled: !!quoteId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.from("trade_quotes").select("id, status, procurement_issued_at, project_board_id").eq("id", quoteId || "").single();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const refresh = () => { if (quoteId) void queryClient.invalidateQueries({ queryKey: procurementQuoteKey(quoteId) }); };
    window.addEventListener("ma:procurement-issued", refresh);
    return () => window.removeEventListener("ma:procurement-issued", refresh);
  }, [quoteId, queryClient]);
  const acceptIssued = (row: NonNullable<typeof query.data>) => {
    queryClient.setQueryData(procurementQuoteKey(row.id), row);
    window.dispatchEvent(new CustomEvent("ma:procurement-issued"));
  };
  return { ...query, state: procurementState(query.data?.procurement_issued_at), acceptIssued };
}