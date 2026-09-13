import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { convertCentsWithFallback, getFxRates, FALLBACK_RATES } from "@/lib/fxRates";
import { useShippingDestination } from "@/lib/shippingDestination";

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

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", SGD: "S$", HKD: "HK$", CHF: "CHF" };

/** "From $3,450" — rounded to whole currency units, no decimals. */
export function formatPublicRrp(row: PublicRrpRow | null | undefined): string | null {
  if (!row?.rrp_price_cents || row.rrp_price_cents <= 0) return null;
  return formatPublicRrpCents(row.rrp_price_cents, row);
}

/**
 * Convert a public RRP to the shopper's destination currency and format it.
 * Falls back to the bundled FX table so cards never block on a live-rate fetch.
 */
export function formatPublicRrpForDestination(
  row: PublicRrpRow | null | undefined,
  destinationCurrency: string | undefined,
): string | null {
  if (!row?.rrp_price_cents || row.rrp_price_cents <= 0) return null;
  const src = (row.currency || "USD").toUpperCase();
  const tgt = (destinationCurrency || src).toUpperCase();
  if (src === tgt) return formatPublicRrp(row);
  const convertedCents = convertCentsWithFallback(row.rrp_price_cents, src, tgt, FALLBACK_RATES);
  return formatPublicRrpCents(convertedCents, { ...row, currency: tgt });
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


/**
 * Batch variant of `usePublicRrp` — resolves publicly visible RRPs for a list
 * of curator pick ids (used by pick grids so publicly priced products show a
 * real price instead of "Price upon request").
 */
export function usePublicRrpMap(pickIds: (string | null | undefined)[]) {
  const ids = Array.from(new Set(pickIds.filter((v): v is string => !!v))).sort();
  return useQuery({
    queryKey: ["public-rrp-map", ids],
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Record<string, PublicRrpRow>> => {
      const map: Record<string, PublicRrpRow> = {};
      const select = "id, source_pick_id, rrp_price_cents, currency, price_unit, price_prefix";
      const [bySource, byId] = await Promise.all([
        supabase.from("trade_products_public_rrp" as any).select(select).in("source_pick_id", ids),
        supabase.from("trade_products_public_rrp" as any).select(select).in("id", ids),
      ]);
      for (const row of ((byId.data || []) as any[])) {
        if (row?.id) map[row.id] = row as PublicRrpRow;
      }
      for (const row of ((bySource.data || []) as any[])) {
        if (row?.source_pick_id) map[row.source_pick_id] = row as PublicRrpRow;
      }
      return map;
    },
  });
}

/**
 * Display-currency layer for public RRPs.
 *
 * The shopper's chosen destination (header flag, persisted in localStorage via
 * `shippingDestination`) is the single source of truth for which currency every
 * public price is *shown* in. Listing pages and product detail pages both read
 * this hook, so navigating between them never reverts to the source currency.
 *
 * Conversion is display-only: the underlying row keeps its source currency for
 * cart/checkout maths, where the settlement currency is resolved separately.
 */
export function usePublicRrpDisplay(row: PublicRrpRow | null | undefined) {
  const dest = useShippingDestination();
  const src = (row?.currency || "USD").toUpperCase();
  const tgt = (dest.currency || src).toUpperCase();
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (src === tgt) return;
    let cancelled = false;
    getFxRates([{ src, tgt }]).then((r) => {
      if (!cancelled) setRates(r);
    });
    return () => {
      cancelled = true;
    };
  }, [src, tgt]);

  const toDisplayCents = useCallback(
    (cents: number) =>
      src === tgt ? cents : convertCentsWithFallback(cents, src, tgt, rates),
    [src, tgt, rates],
  );

  const displayRow = useMemo<PublicRrpRow | null | undefined>(() => {
    if (!row || src === tgt) return row;
    return {
      ...row,
      currency: tgt,
      rrp_price_cents: row.rrp_price_cents ? toDisplayCents(row.rrp_price_cents) : row.rrp_price_cents,
    };
  }, [row, src, tgt, toDisplayCents]);

  return { displayRow, toDisplayCents, displayCurrency: tgt };
}
