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
  /** RRP of the size/finish combination currently selected on the page. */
  selectedVariantCents?: number | null;
  /** True when exactly one variant matched (otherwise the price is a "from"). */
  selectedVariantExact?: boolean;
  /** Public path to return to from the full trade sheet. */
  returnPath?: string;
  pdfUrl?: string | null;
  pdfUrls?: any[] | null;
  inquireHref: string;
  felixUrl?: string;
  /** Mobile/PWA: collapse the workspace into a slim inline price block. */
  compact?: boolean;
}

/** Human-readable suffix for a price unit. `per_piece` is the default and is never shown. */
function unitSuffix(unit?: string | null) {
  const u = (unit || "").trim().toLowerCase();
  if (!u || /^(each|unit|item|piece|per_piece|per piece)$/.test(u)) return "";
  if (/^(per_sqm|per sqm|sqm|m2)$/.test(u)) return " / m²";
  return ` / ${u.replace(/_/g, " ")}`;
}

function formatCents(cents: number | null | undefined, currency?: string | null, unit?: string | null) {
  if (cents == null || cents <= 0) return null;
  const ccy = (currency || "EUR").toUpperCase();
  try {
    const value = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy,
      maximumFractionDigits: 0,
    }).format(cents / 100);
    return `${value}${unitSuffix(unit)}`;
  } catch {
    return `${ccy} ${(cents / 100).toLocaleString("en-US")}${unitSuffix(unit)}`;
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
  selectedVariantCents = null,
  selectedVariantExact = false,
  returnPath,
  pdfUrl,
  pdfUrls,
  inquireHref,
  felixUrl,
  compact = false,
}: Props) {
  const { data: pricing, isLoading } = useTradeProductPricing(productId);
  const { discountPct, tierLabel } = useTradeDiscount();
  const { clientSafe } = useClientSafeMode();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [felixOpen, setFelixOpen] = useState(false);

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


  // `trade_price_cents` holds RRP for most rows (legacy import), so it only counts
  // as a real negotiated net when it is strictly below RRP. Otherwise the tier
  // discount is applied on top of RRP.
  // The selected size/finish always wins over the product's base RRP so the
  // workspace price tracks the configuration on screen.
  const baseRrpCents = pricing?.rrp_price_cents ?? pricing?.trade_price_cents ?? null;
  const rrpCents = selectedVariantCents && selectedVariantCents > 0 ? selectedVariantCents : baseRrpCents;
  const usingVariantPrice = !!(selectedVariantCents && selectedVariantCents > 0);
  const explicitNet =
    !usingVariantPrice && pricing?.trade_price_cents && baseRrpCents && pricing.trade_price_cents < baseRrpCents
      ? pricing.trade_price_cents
      : null;
  const netCents =
    explicitNet ?? (rrpCents ? Math.round(rrpCents * (1 - (discountPct || 0))) : null);
  const discountApplied = !explicitNet && !!discountPct && netCents !== rrpCents;
  const discountLabel = `${(discountPct * 100).toFixed(discountPct * 100 % 1 === 0 ? 0 : 1)}%`;

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

  if (compact) {
    const priceNode = isLoading ? (
      <span className="inline-flex items-center gap-2 text-muted-foreground font-body text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading trade pricing…
      </span>
    ) : clientSafe ? (
      <span className="font-display text-2xl leading-none">
        {rrpLabel ? `${usingVariantPrice && !selectedVariantExact ? "From " : ""}${rrpLabel}` : "Price upon Request"}
      </span>
    ) : netLabel ? (
      <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-display text-2xl leading-none">
          {usingVariantPrice && !selectedVariantExact ? "From " : ""}
          {netLabel}
        </span>
        {rrpLabel && netCents !== rrpCents && (
          <span className="font-body text-sm text-muted-foreground line-through">{rrpLabel}</span>
        )}
      </span>
    ) : (
      <span className="font-display text-xl leading-none">Price upon Request</span>
    );

    return (
      <section aria-label="Trade pricing" className="mt-3 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-body text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gold))]">
            Trade
          </p>
          <div className="flex items-center gap-2">
            <ClientSafeToggle />
            {tierLabel && !clientSafe && (
              <span className="font-body text-[9px] uppercase tracking-[0.16em] text-muted-foreground border border-border rounded-full px-2 py-0.5 whitespace-nowrap">
                {tierLabel} −{discountLabel}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2">{priceNode}</div>
        <p className="font-body text-[11px] text-muted-foreground mt-1.5">
          {clientSafe
            ? rrpLabel
              ? "Recommended retail"
              : "Available on request"
            : netLabel
              ? `Your trade net${
                  usingVariantPrice && selectedFinishes.length ? ` · ${selectedFinishes.join(" · ")}` : ""
                }${discountApplied ? ` · ${tierLabel} ${discountLabel} off RRP` : ""}`
              : "Available on request"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => {
              setFelixOpen(true);
              window.dispatchEvent(new CustomEvent("concierge:stage", { detail: { openPanel: true } }));
            }}
            className="font-body text-[11px] uppercase tracking-[0.12em] text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground transition-colors"
          >
            Ask Felix
          </button>
          <Link
            to={`/trade/products/${productId}${selectedFinishes.length ? `?finish=${encodeURIComponent(selectedFinishes.join(" / "))}` : ""}`}
            state={returnPath ? { from: returnPath } : undefined}
            className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:text-foreground transition-colors"
          >
            Full trade sheet
          </Link>
        </div>

        {felixOpen && (
          <div className="mt-4">
            <Suspense
              fallback={
                <div className="rounded-lg border border-border bg-card/40 p-5 flex items-center gap-2 text-muted-foreground font-body text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waking the curatorial guide…
                </div>
              }
            >
              <ProductFelixPanel context={felixContext} />
            </Suspense>
          </div>
        )}
      </section>
    );
  }

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
              <span className="font-body text-[9px] uppercase tracking-[0.16em] text-muted-foreground border border-border rounded-full px-2 py-0.5 whitespace-nowrap">
                {tierLabel} −{discountLabel}
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
              <p className="font-display text-2xl leading-none">
                {rrpLabel ? `${usingVariantPrice && !selectedVariantExact ? "From " : ""}${rrpLabel}` : "Price upon Request"}
              </p>
              <p className="font-body text-[11px] text-muted-foreground mt-1.5">
                {rrpLabel
                  ? usingVariantPrice
                    ? `Recommended retail · ${selectedFinishes.join(" · ") || "selected configuration"}`
                    : "Recommended retail"
                  : "Available on request"}
              </p>
            </>
          ) : netLabel ? (
            <>
              <p className="font-body text-[11px] tracking-[0.04em] text-muted-foreground">
                {rrpLabel
                  ? `Retail: ${usingVariantPrice && !selectedVariantExact ? "From " : ""}${rrpLabel} (Before Tax)`
                  : "Retail on request (Before Tax)"}
              </p>
              <p className="font-display text-2xl leading-none mt-1">
                {usingVariantPrice && !selectedVariantExact ? "From " : ""}
                {netLabel}{" "}
                <span className="font-body text-xs uppercase tracking-widest text-muted-foreground">
                  Net Trade Price
                </span>
              </p>
              <p className="font-body text-[11px] text-muted-foreground mt-1.5">
                {usingVariantPrice && selectedFinishes.length ? `${selectedFinishes.join(" · ")}` : "Your tier pricing"}
                {discountApplied && ` · ${tierLabel} ${discountLabel} off RRP`}
              </p>
            </>
          ) : (
            <p className="font-display text-xl leading-none">Price upon Request</p>
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
          {/* Mobile → desktop continuity: pushes this piece (with the chosen
              finishes) to the studio desktop, ready for the next session. */}
          <button
            type="button"
            onClick={sendToDesktop}
            disabled={sending || sent}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-md border border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))] font-body text-[11px] uppercase tracking-[0.12em] transition-colors hover:bg-[hsl(var(--gold))]/5 disabled:opacity-70 touch-manipulation"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : sent ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Laptop className="h-3.5 w-3.5" />
            )}
            {sent ? "Waiting on your desktop" : "Send to Desktop"}
          </button>

          <Link
            to={`/trade/products/${productId}${selectedFinishes.length ? `?finish=${encodeURIComponent(selectedFinishes.join(" / "))}` : ""}`}
            state={returnPath ? { from: returnPath } : undefined}
            className="flex items-center justify-center px-4 py-3 rounded-none bg-foreground text-background font-body text-xs uppercase tracking-widest transition-all hover:bg-foreground/85"
          >
            Add to Co-Pilot Workspace &amp; Order
          </Link>
          <button
            type="button"
            onClick={() => {
              setFelixOpen(true);
              window.dispatchEvent(new CustomEvent("concierge:stage", { detail: { openPanel: true } }));
            }}
            className="flex items-center justify-center px-4 py-3 rounded-none border border-foreground bg-background text-foreground font-body text-xs uppercase tracking-widest transition-all hover:bg-muted/60"
          >
            Open 3D Studio &amp; Axonometric Planning
          </button>
          {returnPath && (
            <p className="text-center font-body text-[10px] text-muted-foreground/80">
              Your finish selection carries over — use Back to return here.
            </p>
          )}

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

      {/* Right — Felix. Collapsed behind a launcher on mobile so the pricing
          block stays adjacent to the finish selectors. */}
      <div>
        {!felixOpen && (
          <button
            type="button"
            onClick={() => setFelixOpen(true)}
            className="md:hidden w-full flex items-center justify-center px-4 py-3 rounded-md border border-border font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Ask Felix about this piece
          </button>
        )}
        <div className={cn(!felixOpen && "hidden md:block")}>
          <Suspense
            fallback={
              <div className="rounded-lg border border-border bg-card/40 p-5 flex items-center gap-2 text-muted-foreground font-body text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waking the curatorial guide…
              </div>
            }
          >
            <ProductFelixPanel context={felixContext} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
