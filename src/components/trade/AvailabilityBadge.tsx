import { useEffect, useState } from "react";
import { Clock, CheckCircle2, Hourglass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type StockStatus = "in_stock" | "low_stock" | "made_to_order" | "discontinued";

export interface AvailabilityInfo {
  lead_weeks_min: number | null;
  lead_weeks_max: number | null;
  stock_status: StockStatus;
  source: "product" | "brand" | "default";
}

const TONE: Record<StockStatus, { bg: string; text: string; border: string; icon: typeof Clock; label: string }> = {
  in_stock:      { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", icon: CheckCircle2, label: "In stock" },
  low_stock:     { bg: "bg-amber-50",   text: "text-amber-800",   border: "border-amber-200",   icon: Hourglass,   label: "Low stock" },
  made_to_order: { bg: "bg-sky-50",     text: "text-sky-800",     border: "border-sky-200",     icon: Clock,       label: "Made to order" },
  discontinued:  { bg: "bg-zinc-100",   text: "text-zinc-600",    border: "border-zinc-200",    icon: Clock,       label: "Discontinued" },
};

export function formatLeadTime(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (min && max && min !== max) return `${min}–${max} wks`;
  return `${min ?? max} wks`;
}

interface Props {
  availability: AvailabilityInfo | null | undefined;
  size?: "xs" | "sm";
  className?: string;
  showLeadTime?: boolean;
}

/** Stateless badge — pass already-fetched availability data. */
export function AvailabilityBadge({ availability, size = "sm", className, showLeadTime = true }: Props) {
  if (!availability) return null;
  const tone = TONE[availability.stock_status] ?? TONE.made_to_order;
  const Icon = tone.icon;
  const lt = formatLeadTime(availability.lead_weeks_min, availability.lead_weeks_max);

  const sizeCls =
    size === "xs"
      ? "text-[9px] px-1.5 py-0.5 gap-1"
      : "text-[10px] px-2 py-0.5 gap-1.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-body uppercase tracking-wider",
        tone.bg,
        tone.text,
        tone.border,
        sizeCls,
        className
      )}
      title={`Source: ${availability.source}`}
    >
      <Icon className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      <span className="font-medium">{tone.label}</span>
      {showLeadTime && lt && availability.stock_status !== "in_stock" && (
        <span className="opacity-70 normal-case tracking-normal">· {lt}</span>
      )}
    </span>
  );
}

/** Hook: fetch effective availability for a single product (uses RPC). */
export function useProductAvailability(productId: string | null | undefined) {
  const [data, setData] = useState<AvailabilityInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("effective_product_availability", { _product_id: productId })
      .then(({ data: rows, error }) => {
        if (cancelled) return;
        if (error || !rows || rows.length === 0) {
          setData(null);
        } else {
          const r = rows[0] as any;
          setData({
            lead_weeks_min: r.lead_weeks_min,
            lead_weeks_max: r.lead_weeks_max,
            stock_status: (r.stock_status as StockStatus) ?? "made_to_order",
            source: (r.source as AvailabilityInfo["source"]) ?? "default",
          });
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return { availability: data, loading };
}

/** Hook: batch-fetch availability for multiple products in one query (joins brand_lead_times client-side). */
export function useBatchAvailability(productIds: string[]) {
  const [map, setMap] = useState<Record<string, AvailabilityInfo>>({});

  useEffect(() => {
    if (productIds.length === 0) {
      setMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: prods } = await supabase
        .from("trade_products")
        .select("id, brand_name, lead_weeks_min_override, lead_weeks_max_override, stock_status_override")
        .in("id", productIds);

      const brands = Array.from(new Set((prods ?? []).map((p: any) => p.brand_name).filter(Boolean)));
      const { data: blt } = brands.length
        ? await supabase
            .from("brand_lead_times")
            .select("brand_name, default_lead_weeks_min, default_lead_weeks_max, default_stock_status")
            .in("brand_name", brands)
        : { data: [] as any[] };

      const bltMap = new Map<string, any>();
      (blt ?? []).forEach((b: any) => bltMap.set(b.brand_name, b));

      const out: Record<string, AvailabilityInfo> = {};
      (prods ?? []).forEach((p: any) => {
        const b = bltMap.get(p.brand_name);
        const hasProductOverride = p.lead_weeks_min_override != null || p.stock_status_override != null;
        out[p.id] = {
          lead_weeks_min: p.lead_weeks_min_override ?? b?.default_lead_weeks_min ?? null,
          lead_weeks_max: p.lead_weeks_max_override ?? b?.default_lead_weeks_max ?? null,
          stock_status: (p.stock_status_override ?? b?.default_stock_status ?? "made_to_order") as StockStatus,
          source: hasProductOverride ? "product" : b ? "brand" : "default",
        };
      });
      if (!cancelled) setMap(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIds.join("|")]);

  return map;
}

export default AvailabilityBadge;
