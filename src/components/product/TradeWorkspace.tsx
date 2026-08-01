import React, { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { FileDown, Loader2, Laptop, Check } from "lucide-react";
import { toast } from "sonner";
import SpecSheetButton from "@/components/trade/SpecSheetButton";
import ClientSafeToggle from "@/components/trade/ClientSafeToggle";
import { useClientSafeMode } from "@/lib/clientSafeMode";
import { supabase } from "@/integrations/supabase/client";
import { useTradeProductPricing } from "@/hooks/useTradeProductPricing";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { cn } from "@/lib/utils";
import type { FelixProductContext } from "@/components/product/ProductFelixPanel";


// Felix (and its whole runtime) is code-split and only ever requested inside
// this authenticated workspace — never for signed-out visitors.
const ProductFelixPanel = lazy(() => import("@/components/product/ProductFelixPanel"));

interface Props {
  productId: string;
  title: string;
  designerDisplay: string;
  dimensions?: string | null;
  materials?: string | null;
  originLine?: string | null;
  leadTime?: string | null;
  selectedFinishes: string[];
  pdfUrl?: string | null;
  pdfUrls?: any[] | null;
  inquireHref: string;
  felixUrl?: string;
}

function formatCents(cents: number | null | undefined, currency?: string | null, unit?: string | null) {
  if (cents == null || cents <= 0) return null;
  const ccy = (currency || "EUR").toUpperCase();
  const showUnit = unit && !/^(each|unit|item|piece)$/i.test(unit.trim());
  try {
    const value = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy,
      maximumFractionDigits: 0,
    }).format(cents / 100);
    return showUnit ? `${value} / ${unit}` : value;
  } catch {
    return `${ccy} ${(cents / 100).toLocaleString("en-US")}`;
  }
}

const STOCK_LABEL: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  made_to_order: "Made to order",
  discontinued: "Discontinued",
};

/**
 * Authenticated Trade Workspace.
 *
 * Replaces the public "Trade Exclusive Access" block on a product page once a
 * verified trade member is signed in: net pricing + availability on the left,
 * the Felix curatorial guide (seeded with this product's context) on the right.
 */
export default function TradeWorkspace({
  productId,
  title,
  designerDisplay,
  dimensions,
  materials,
  originLine,
  leadTime,
  selectedFinishes,
  pdfUrl,
  pdfUrls,
  inquireHref,
  felixUrl,
}: Props) {
  const { data: pricing, isLoading } = useTradeProductPricing(productId);
  const { discountPct, tierLabel } = useTradeDiscount();
  const { clientSafe } = useClientSafeMode();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendToDesktop = async () => {
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-to-desktop", {
        body: { product_id: productId, title, designer: designerDisplay, finishes: selectedFinishes },
      });
      if (error) throw error;
      if (navigator.vibrate) navigator.vibrate(15);
      setSent(true);
      toast.success("Sent to your desktop workspace");
    } catch (e) {
      toast.error("Could not reach your desktop — please try again");
    } finally {
      setSending(false);
    }
  };


  const rrpCents = pricing?.rrp_price_cents ?? pricing?.trade_price_cents ?? null;
  const netCents =
    pricing?.trade_price_cents && pricing?.rrp_price_cents
      ? pricing.trade_price_cents
      : rrpCents
        ? Math.round(rrpCents * (1 - (discountPct || 0)))
        : null;

  const rrpLabel = formatCents(rrpCents, pricing?.currency, pricing?.price_unit);
  const netLabel = formatCents(netCents, pricing?.currency, pricing?.price_unit);
  const stockKey = pricing?.stock_status_override || "made_to_order";
  const stockLabel = STOCK_LABEL[stockKey] || "Made to order";
  const resolvedLead = pricing?.lead_time || leadTime || null;
  const hasSpecSheet = !!(pdfUrl || (pdfUrls && pdfUrls.length > 0) || pricing?.spec_sheet_url);

  const felixContext: FelixProductContext = {
    title,
    designer: designerDisplay,
    dimensions,
    materials,
    leadTime: resolvedLead,
    finishes: selectedFinishes,
    url: felixUrl,
  };

  return (
    <section
      aria-label="Trade workspace"
      className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in"
    >
      {/* Left — commercial data */}
      <div className="rounded-lg border border-border bg-card/40 p-5 flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <p className="font-body text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gold))]">
            Trade Workspace
          </p>
          <div className="flex items-center gap-2">
            <ClientSafeToggle />
            {tierLabel && !clientSafe && (
              <span className="font-body text-[9px] uppercase tracking-[0.16em] text-muted-foreground border border-border rounded-full px-2 py-0.5">
                {tierLabel}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground font-body text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading trade pricing…
            </div>
          ) : clientSafe ? (
            /* Client-safe: retail only, never net or margin. */
            <>
              <p className="font-display text-2xl leading-none">{rrpLabel || "Price on Request"}</p>
              <p className="font-body text-[11px] text-muted-foreground mt-1.5">
                {rrpLabel ? "Recommended retail" : "Available on request"}
              </p>
            </>
          ) : netLabel ? (
            <>
              <p className="font-display text-2xl leading-none">{netLabel}</p>
              <p className="font-body text-[11px] text-muted-foreground mt-1.5">
                Your trade net
                {rrpLabel && netCents !== rrpCents && (
                  <>
                    {" · RRP "}
                    <span className="line-through">{rrpLabel}</span>
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="font-display text-xl leading-none">Price on Request</p>
          )}
        </div>


        <dl className="mt-5 space-y-2.5">
          <div className="flex items-baseline gap-4">
            <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground w-28 shrink-0">
              Availability
            </dt>
            <dd className="font-body text-sm">{stockLabel}</dd>
          </div>
          {resolvedLead && (
            <div className="flex items-baseline gap-4">
              <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground w-28 shrink-0">
                Lead time
              </dt>
              <dd className="font-body text-sm">{resolvedLead}</dd>
            </div>
          )}
          {originLine && (
            <div className="flex items-baseline gap-4">
              <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground w-28 shrink-0">
                Origin
              </dt>
              <dd className="font-body text-sm">{originLine}</dd>
            </div>
          )}
          <div className="flex items-baseline gap-4">
            <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground w-28 shrink-0">
              Finishes
            </dt>
            <dd className="font-body text-sm">
              {selectedFinishes.length ? selectedFinishes.join(" · ") : "No finish selected yet"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            to={`/trade/products/${productId}`}
            className="flex items-center justify-center px-4 py-3 rounded-md bg-foreground text-background font-body text-[11px] uppercase tracking-[0.12em] hover:bg-foreground/90 transition-colors"
          >
            Open Full Trade Sheet
          </Link>

          {hasSpecSheet ? (
            <SpecSheetButton
              pdfUrl={pdfUrl || pricing?.spec_sheet_url || undefined}
              pdfUrls={pdfUrls as any}
              brandName={designerDisplay}
              productName={title}
              variant="button"
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-md font-body text-[11px] uppercase tracking-[0.12em] transition-all border border-foreground/40 text-foreground hover:bg-foreground/5 cursor-pointer"
            />
          ) : (
            <Link
              to={inquireHref}
              className={cn(
                "flex items-center justify-center gap-1.5 px-4 py-3 rounded-md font-body text-[11px] uppercase tracking-[0.12em] transition-all border border-foreground/40 text-foreground hover:bg-foreground/5"
              )}
            >
              <FileDown className="h-3.5 w-3.5" />
              Request Spec Sheet
            </Link>
          )}
        </div>
      </div>

      {/* Right — Felix */}
      <Suspense
        fallback={
          <div className="rounded-lg border border-border bg-card/40 p-5 flex items-center gap-2 text-muted-foreground font-body text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waking the curatorial guide…
          </div>
        }
      >
        <ProductFelixPanel context={felixContext} />
      </Suspense>
    </section>
  );
}
