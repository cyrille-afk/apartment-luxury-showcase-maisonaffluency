import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QuoteBaseItem {
  name: string;
  price: number;
}

export interface QuoteResult {
  success: boolean;
  meta: {
    location: string | null;
    multiplier_applied: number;
    shipping_tier: string;
  };
  pricing_summary: {
    items: Array<{
      item_name: string;
      original_price: number;
      discounted_price: number;
    }>;
    subtotal: number;
    trade_discount_applied: number;
    estimated_total: number;
  };
}

/**
 * Fetches a localized trade quote for a given project + line items via the
 * `calculate-trade-quote` edge function. Returns { loading, data, error }.
 * Refetches when projectId or the serialized base items change.
 */
export function useProjectQuote(
  projectId: string | null | undefined,
  baseItems: QuoteBaseItem[] | null | undefined,
  enabled: boolean = true,
) {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(baseItems ?? []);

  useEffect(() => {
    if (!enabled || !projectId || !baseItems || baseItems.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("Not authenticated");

        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "calculate-trade-quote",
          { body: { project_id: projectId, base_items: baseItems } },
        );
        if (fnError) throw fnError;
        if (!cancelled) setData(fnData as QuoteResult);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to calculate quote");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, key, enabled]);

  return { loading, data, error };
}
