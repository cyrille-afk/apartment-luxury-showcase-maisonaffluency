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
import { formatHandcrafted } from "@/lib/formatHandcrafted";
import { originToCountry } from "@/lib/productOrigin";
import { formatDimensionsMultiline } from "@/lib/formatDimensions";
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

  // Strip + spec-table data
  const originCountry = originToCountry(originLine);
  const handcraftedLine = formatHandcrafted(originLine, null);

  /**
   * Zone 1 — full-width Trade Workspace strip: data points on one line with
   * hairline vertical dividers, action buttons grouped on the right.
   * Zones 2 & 3 — 50/50 split: Felix (left) | technical specifications (right).
   */
  const StripCell = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col justify-center gap-1 py-4 lg:py-5 lg:px-7 first:lg:pl-0 min-w-0">
      <p className="font-body text-[9px] uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
        {label}
      </p>
      <p className="font-body text-sm leading-snug">{children}</p>
    </div>
  );

  return (
    <section aria-label="Trade workspace" className="mt-10 animate-fade-in">
      {/* ── Zone 1 — Trade Workspace strip ─────────────────────────────── */}
      <div className="border-y border-border">
        <div className="flex flex-col lg:flex-row lg:items-stretch lg:divide-x lg:divide-border/60">
          <div className="flex flex-col lg:flex-row lg:items-stretch lg:flex-1 min-w-0 lg:divide-x lg:divide-border/60 divide-y lg:divide-y-0 divide-border/60">
            {/* Tier */}
            <div className="flex flex-wrap items-center gap-3 py-4 lg:py-0 lg:px-7 lg:first:pl-0 flex-1 lg:flex-none">
              <ClientSafeToggle />
              {tierLabel && !clientSafe && (
                <span className="inline-flex items-center rounded-full border border-[hsl(var(--gold))]/40 px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--gold))] whitespace-nowrap">
                  {tierLabel} − {discountLabel}
                </span>
              )}
            </div>

            {/* Retail vs Net Trade price */}
            <div className="flex flex-col justify-center gap-1 py-4 lg:py-5 lg:px-7 min-w-0">
              <p className="font-body text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                {clientSafe ? "Recommended Retail" : "Net Trade Price"}
              </p>
              {isLoading ? (
                <span className="inline-flex items-center gap-2 font-body text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading trade pricing…
                </span>
              ) : clientSafe ? (
                <p className="font-body text-sm leading-snug">
                  {rrpLabel ? `${usingVariantPrice && !selectedVariantExact ? "From " : ""}${rrpLabel}` : "Price upon Request"}
                </p>
              ) : netLabel ? (
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="font-display text-lg leading-none">
                    {usingVariantPrice && !selectedVariantExact ? "From " : ""}
                    {netLabel}
                  </span>
                  {rrpLabel && netCents !== rrpCents && (
                    <span className="font-body text-[11px] text-muted-foreground line-through">{rrpLabel}</span>
                  )}
                </p>
              ) : (
                <p className="font-body text-sm leading-snug">Price upon Request</p>
              )}
            </div>

            <StripCell label="Availability">{stockLabel}</StripCell>
            {resolvedLead && <StripCell label="Lead Time">{resolvedLead}</StripCell>}
            {originCountry && <StripCell label="Origin">{originCountry}</StripCell>}
          </div>

          {/* Action group — right side of the strip */}
          <div className="flex flex-wrap sm:flex-nowrap lg:flex-wrap xl:flex-nowrap items-center gap-2 py-4 lg:py-0 lg:pl-7 lg:pr-1 lg:my-3">
            <Link
              to={`/trade/products/${productId}${selectedFinishes.length ? `?finish=${encodeURIComponent(selectedFinishes.join(" / "))}` : ""}`}
              state={returnPath ? { from: returnPath } : undefined}
              className="flex-1 whitespace-nowrap inline-flex items-center justify-center px-4 py-2.5 bg-foreground text-background font-body text-[10px] uppercase tracking-[0.12em] transition-colors hover:bg-foreground/85"
            >
              Add to Co-Pilot Workspace
            </Link>
            <button
              type="button"
              onClick={() => {
                setFelixOpen(true);
                window.dispatchEvent(new CustomEvent("concierge:stage", { detail: { openPanel: true } }));
              }}
              className="flex-1 whitespace-nowrap inline-flex items-center justify-center px-4 py-2.5 border border-foreground/50 text-foreground font-body text-[10px] uppercase tracking-[0.12em] transition-colors hover:bg-muted/60"
            >
              Open 3D Studio
            </button>
            {hasSpecSheet ? (
              <SpecSheetButton
                pdfUrl={pdfUrl || pricing?.spec_sheet_url || undefined}
                pdfUrls={pdfUrls as any}
                brandName={designerDisplay}
                productName={title}
                variant="button"
                className="flex-1 whitespace-nowrap inline-flex items-center justify-center gap-1.5 px-4 py-2.5 font-body text-[10px] uppercase tracking-[0.12em] border border-foreground/40 text-foreground hover:bg-foreground/5 cursor-pointer"
              />
            ) : (
              <Link
                to={inquireHref}
                className="flex-1 whitespace-nowrap inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-foreground/40 text-foreground font-body text-[10px] uppercase tracking-[0.12em] transition-colors hover:bg-foreground/5"
              >
                <FileDown className="h-3.5 w-3.5" />
                Request Spec Sheet
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Zones 2 & 3 — 50/50 lower split ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 mt-10">
        {/* Zone 2 — Felix AI Curatorial Guide */}
        <div className="min-w-0">
          <Suspense
            fallback={
              <div className="rounded-none border border-border bg-card/40 p-6 flex items-center gap-2 text-muted-foreground font-body text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waking the curatorial guide…
              </div>
            }
          >
            <ProductFelixPanel context={felixContext} />
          </Suspense>
        </div>

        {/* Zone 3 — Technical Specifications */}
        <div className="min-w-0">
          <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Technical Specifications
          </p>
          <dl className="mt-4">
            {dimensions && (
              <div className="flex items-baseline justify-between gap-8 py-3.5 border-b border-border/60 first:border-t">
                <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground shrink-0">
                  Dimensions
                </dt>
                <dd className="font-body text-sm leading-relaxed text-right">
                  {formatDimensionsMultiline(dimensions)}
                </dd>
              </div>
            )}
            {materials && (
              <div className="flex items-baseline justify-between gap-8 py-3.5 border-b border-border/60">
                <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground shrink-0">
                  Materials
                </dt>
                <dd className="font-body text-sm leading-relaxed text-right">{materials}</dd>
              </div>
            )}
            {handcraftedLine && (
              <div className="flex items-baseline justify-between gap-8 py-3.5 border-b border-border/60">
                <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground shrink-0">
                  Origin
                </dt>
                <dd className="font-body text-sm leading-relaxed text-right">{handcraftedLine}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-8 py-3.5 border-b border-border/60">
              <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground shrink-0">
                Finishes
              </dt>
              <dd className="font-body text-sm leading-relaxed text-right">
                {selectedFinishes.length ? selectedFinishes.join(" · ") : "No finish selected yet"}
              </dd>
            </div>
            {resolvedLead && (
              <div className="flex items-baseline justify-between gap-8 py-3.5 border-b border-border/60">
                <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground shrink-0">
                  Lead Time
                </dt>
                <dd className="font-body text-sm leading-relaxed text-right">{resolvedLead}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}
