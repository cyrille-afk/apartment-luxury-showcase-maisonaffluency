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
  is_allocation_restricted?: boolean | null;
  allocation_unit_cap?: number | null;
  available_stock_units?: number | null;
}

export class TradeCatalogRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TradeCatalogRateLimitError";
  }
}

/**
 * Trade-only pricing lookup for a public product page.
 *
 * Wholesale prices are served through the `trade-catalog-pricing` gateway
 * rather than read from the table directly, so every request is counted
 * server-side and harvesting cadences are throttled (429) and flagged.
 */
export function useTradeProductPricing(pickId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["trade-product-pricing", pickId],
    enabled: !!pickId && enabled,
    staleTime: 5 * 60_000,
    retry: (count, error) => !(error instanceof TradeCatalogRateLimitError) && count < 2,
    queryFn: async (): Promise<TradeProductPricingRow | null> => {
      if (!pickId) return null;

      const { data, error } = await supabase.functions.invoke("trade-catalog-pricing", {
        body: { pickIds: [pickId] },
      });

      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        if (status === 429) {
          throw new TradeCatalogRateLimitError(
            "Pricing requests are temporarily throttled on this account.",
          );
        }
        throw error;
      }

      const products = (data as { products?: TradeProductPricingRow[] } | null)?.products ?? [];
      if (!products.length) return null;

      // Prefer the twin resolved through source_pick_id, then a direct id match.
      const bySource = products.find(
        (row) => (row as { source_pick_id?: string }).source_pick_id === pickId,
      );
      return bySource ?? products.find((row) => row.id === pickId) ?? products[0];
    },
  });
}
