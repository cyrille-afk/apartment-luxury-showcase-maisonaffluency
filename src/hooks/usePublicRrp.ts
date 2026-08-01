import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicRrpRow {
  rrp_price_cents: number | null;
  currency: string | null;
  price_unit: string | null;
  price_prefix: string | null;
}

/**
 * Publicly visible recommended retail price for a curator pick.
 *
 * Reads `trade_products_public_rrp`, a view that only exposes rows explicitly
 * flagged with `public_rrp_visible` (currently the Apparatus catalogue).
 * Net trade pricing is never exposed here.
 */
export function usePublicRrp(pickId: string | null | undefined) {
  return useQuery({
    queryKey: ["public-rrp", pickId],
    enabled: !!pickId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<PublicRrpRow | null> => {
      if (!pickId) return null;
      const bySource = await supabase
        .from("trade_products_public_rrp" as any)
        .select("rrp_price_cents, currency, price_unit, price_prefix")
        .eq("source_pick_id", pickId)
        .limit(1)
        .maybeSingle();
      if (bySource.data) return bySource.data as unknown as PublicRrpRow;

      const byId = await supabase
        .from("trade_products_public_rrp" as any)
        .select("rrp_price_cents, currency, price_unit, price_prefix")
        .eq("id", pickId)
        .limit(1)
        .maybeSingle();
      return (byId.data as unknown as PublicRrpRow) || null;
    },
  });
}

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", SGD: "S$", HKD: "HK$" };

/** "From $3,450" — rounded to whole currency units, no decimals. */
export function formatPublicRrp(row: PublicRrpRow | null | undefined): string | null {
  if (!row?.rrp_price_cents || row.rrp_price_cents <= 0) return null;
  const currency = (row.currency || "USD").toUpperCase();
  const symbol = SYMBOLS[currency] || "";
  const amount = Math.round(row.rrp_price_cents / 100).toLocaleString("en-US");
  const prefix = row.price_prefix?.trim() || "From";
  const rawUnit = (row.price_unit || "").trim().toLowerCase().replace(/_/g, " ");
  const genericUnit = ["", "per piece", "piece", "each", "unit", "per unit", "item"].includes(rawUnit);
  const unit = genericUnit ? "" : ` / ${rawUnit}`;
  return `${prefix} ${symbol}${amount}${symbol ? "" : ` ${currency}`}${unit}`;
}
