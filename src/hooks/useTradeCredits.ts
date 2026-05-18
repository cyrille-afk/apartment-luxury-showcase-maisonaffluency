import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TradeCredit {
  id: string;
  source: string;
  amount_cents: number;
  currency: string;
  status: "available" | "applied" | "expired";
  created_at: string;
  applied_to_quote_id: string | null;
  applied_at: string | null;
}

export function useTradeCredits(overrideUserId?: string) {
  const { user } = useAuth();
  const effectiveUserId = overrideUserId ?? user?.id ?? null;
  const [credits, setCredits] = useState<TradeCredit[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("trade_credits")
      .select("id, source, amount_cents, currency, status, created_at, applied_to_quote_id, applied_at")
      .eq("user_id", effectiveUserId)
      .order("created_at", { ascending: false });
    setCredits((data || []) as any);
    setLoading(false);
  }, [effectiveUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  const availableCents = credits
    .filter((c) => c.status === "available")
    .reduce((sum, c) => sum + c.amount_cents, 0);

  return { credits, availableCents, loading, refresh };
}
