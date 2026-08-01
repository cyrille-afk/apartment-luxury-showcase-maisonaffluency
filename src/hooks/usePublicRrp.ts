import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicRrpRow {
  rrp_price_cents: number | null;
  currency: string | null;
  price_unit: string | null;
  price_prefix: string | null;
  /** Per-size/finish RRP list, only exposed for publicly priced products. */
  rrp_size_variants?: Array<{ base?: string | null; top?: string | null; label?: string | null; price_cents?: number | null }> | null;
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
        .select("rrp_price_cents, currency, price_unit, price_prefix, rrp_size_variants")
        .eq("source_pick_id", pickId)
        .limit(1)
        .maybeSingle();
      if (bySource.data) return bySource.data as unknown as PublicRrpRow;

      const byId = await supabase
        .from("trade_products_public_rrp" as any)
        .select("rrp_price_cents, currency, price_unit, price_prefix, rrp_size_variants")
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
  return formatPublicRrpCents(row.rrp_price_cents, row);
}

/**
 * Formats an arbitrary cents amount (e.g. the price of the size/finish the
 * visitor just selected) using the same currency, unit and prefix rules as the
 * catalogue "From" price. Pass `prefix: ""` for an exact, non-"From" price.
 */
export function formatPublicRrpCents(
  cents: number,
  row: PublicRrpRow | null | undefined,
  prefixOverride?: string,
): string | null {
  if (!cents || cents <= 0) return null;
  const currency = (row?.currency || "USD").toUpperCase();
  const symbol = SYMBOLS[currency] || "";
  const amount = Math.round(cents / 100).toLocaleString("en-US");
  const prefix = prefixOverride !== undefined ? prefixOverride : (row?.price_prefix?.trim() || "From");
  const rawUnit = (row?.price_unit || "").trim().toLowerCase().replace(/_/g, " ");
  const genericUnit = ["", "per piece", "piece", "each", "unit", "per unit", "item"].includes(rawUnit);
  const unit = genericUnit ? "" : ` / ${rawUnit}`;
  return `${prefix ? `${prefix} ` : ""}${symbol}${amount}${symbol ? "" : ` ${currency}`}${unit}`;
}

