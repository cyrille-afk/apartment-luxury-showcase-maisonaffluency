import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TradeProductPricingRow {
  id: string;
  trade_price_cents: number | null;
  rrp_price_cents: number | null;
  currency: string | null;
  price_unit: string | null;
  price_prefix: string | null;
  lead_time: string | null;
  lead_time_weeks_min: number | null;
  lead_time_weeks_max: number | null;
  stock_status_override: string | null;
  spec_sheet_url: string | null;
}

const COLS =
  "id, trade_price_cents, rrp_price_cents, currency, price_unit, price_prefix, lead_time, lead_time_weeks_min, lead_time_weeks_max, stock_status_override, spec_sheet_url";

/**
 * Trade-only pricing lookup for a public product page.
 *
 * Resolves the `trade_products` twin of a curator pick (via `source_pick_id`,
 * falling back to a direct id match). Only ever called from the authenticated
 * Trade Workspace — signed-out visitors never mount it, so no pricing request
 * leaves the browser for public sessions.
 */
export function useTradeProductPricing(pickId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["trade-product-pricing", pickId],
    enabled: !!pickId && enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TradeProductPricingRow | null> => {
      if (!pickId) return null;

      const bySource = await supabase
        .from("trade_products")
        .select(COLS)
        .eq("source_pick_id", pickId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (bySource.data) return bySource.data as unknown as TradeProductPricingRow;

      const byId = await supabase
        .from("trade_products")
        .select(COLS)
        .eq("id", pickId)
        .limit(1)
        .maybeSingle();
      return (byId.data as unknown as TradeProductPricingRow) || null;
    },
  });
}
