import { useProductConfigOptional } from "@/contexts/ProductConfigContext";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import QuoteBriefIntake from "@/components/product/QuoteBriefIntake";

import { useTradeProductPricing } from "@/hooks/useTradeProductPricing";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useClientSafeMode } from "@/lib/clientSafeMode";
import { cn } from "@/lib/utils";

/**
 * Multi-tier product commerce CTA.
 *
 * STATE A (public / logged out): retail price + "Place Order" + "Request a
 * Quote or Customisation" — the latter opens the Trade Exclusive Access card
 * in a modal.
 *
 * STATE B (verified trade): two-line price (Retail … Before Tax / Net Trade
 * Price) + workspace order + studio planning actions.
 *
 * On mobile a fixed sticky bottom dock keeps price + primary action within
 * reach while scrolling.
 */

const primaryBtn =
  "inline-flex h-12 w-full items-center justify-center px-5 rounded-none bg-foreground text-background font-body text-xs uppercase tracking-widest transition-all hover:bg-foreground/85 disabled:opacity-60";

const secondaryBtn =
  "inline-flex h-12 w-full items-center justify-center px-5 rounded-none bg-background text-foreground border border-foreground font-body text-xs uppercase tracking-widest transition-all hover:bg-muted/60";

export interface ProductCommerceCtaProps {
  productId: string;
  /** Formatted public retail price, e.g. "$8,363" (null → Price upon Request) */
  rrpLabel?: string | null;
  /** Verified-trade view */
  tradeApproved?: boolean;
  /** Dev role-preview override: precomputed net trade price label (e.g. "$5,259") */
  netLabelOverride?: string | null;
  /** Dev role-preview override: precomputed plain retail label (e.g. "$7,513") */
  retailLabelOverride?: string | null;
  /** Direct Stripe checkout — receives the chosen quantity */
  onPlaceOrder: (quantity?: number) => void;
  /** Persists the configured piece into the shared cart state (no navigation) */
  onAddToCart?: (quantity: number) => void;
  placingOrder?: boolean;
  onRequestQuote: () => void;
  /** Trade: finish selection carried to the workspace */
  selectedFinishes?: string[];
  /** Display-accurate finish label (axis reference merged with swatch colourway). */
  orderFinishLabel?: string | null;
  redirectTo?: string;
  /** Mobile-only sticky bottom dock */
  dock?: boolean;
  /** Render only the mobile dock (in-flow panel lives elsewhere) */
  dockOnly?: boolean;
  /** Mini-cart drawer content */
  productTitle?: string;
  designerName?: string;
  imageUrl?: string | null;
  leadTime?: string | null;
  /** Secondary utility links rendered inside the action panel */
  utilityLinks?: ReactNode;
}

/** Normalize raw DB lead-time copy for display (strips "Ships in" prefixes). */
function cleanLeadTime(raw: string): string {
  return raw.replace(/^\s*ships?\s+in\s+/i, "").trim();
}

/** Luxury quantity stepper: "QUANTITY" label + bordered counter box. */
function QuantitySelector({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-none",
        compact ? "py-1" : "py-2.5"
      )}
    >
      <span className="font-body text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Quantity:
      </span>
      {/* Thin-bordered counter box — mirrors the Select Your Finish dropdowns */}
      <div className="flex h-10 w-36 items-center justify-between rounded-none border border-border/60 px-3">
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={value <= 1}
          onClick={() => onChange(Math.max(1, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-none border border-transparent text-foreground transition-all hover:border-border hover:bg-muted/50 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <span className="min-w-8 text-center font-body text-sm font-medium tabular-nums text-foreground">
          {value}
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          disabled={value >= 99}
          onClick={() => onChange(Math.min(99, value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-none border border-transparent text-foreground transition-all hover:border-border hover:bg-muted/50 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function PriceBlock({
  rrpLabel,
  netLabel,
  trade,
  from,
}: {
  rrpLabel: string | null;
  netLabel: string | null;
  trade: boolean;
  from: boolean;
}) {
  if (trade && netLabel) {
    return (
      <div className="flex flex-col gap-1">
        <p className="font-body text-[11px] tracking-[0.04em] text-muted-foreground line-through decoration-muted-foreground/50">
          {rrpLabel ? `Retail: ${from ? "From " : ""}${rrpLabel}` : "Retail on request"}
        </p>
        <p className="font-display text-2xl leading-none text-foreground">
          {from ? "From " : ""}{netLabel} <span className="font-body text-xs tracking-widest uppercase text-muted-foreground">Net Trade Price</span>
        </p>
      </div>
    );
  }
  return (
    <p className="font-display text-xl leading-none text-foreground">
      {rrpLabel ? `${from ? "From " : ""}${rrpLabel}` : "Price upon Request"}
    </p>
  );
}

export default function ProductCommerceCta({
  productId,
  rrpLabel = null,
  tradeApproved = false,
  netLabelOverride = null,
  retailLabelOverride = null,
  onPlaceOrder,
  onAddToCart,
  placingOrder = false,
  onRequestQuote,
  selectedFinishes = [],
  orderFinishLabel = null,
  redirectTo,
  dock = true,
  dockOnly = false,
  productTitle,
  designerName,
  imageUrl,
  leadTime,
  utilityLinks,
}: ProductCommerceCtaProps) {
  const [accessOpen, setAccessOpen] = useState(false);
  // Quantity lives in the container engine so both layout variants share it;
  // falls back to local state when rendered outside ProductPageContainer.
  const productConfig = useProductConfigOptional();
  const [localQuantity, setLocalQuantity] = useState(1);
  const quantity = productConfig ? productConfig.quantity : localQuantity;
  const setQuantity = productConfig ? productConfig.setQuantity : setLocalQuantity;
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const [manualForm, setManualForm] = useState(false);
  const { clientSafe } = useClientSafeMode();
  const { data: pricing } = useTradeProductPricing(productId, tradeApproved);
  const { discountPct, apply } = useTradeDiscount();

  const baseRrpCents = pricing?.rrp_price_cents ?? pricing?.trade_price_cents ?? null;
  const explicitNet =
    pricing?.trade_price_cents && baseRrpCents && pricing.trade_price_cents < baseRrpCents
      ? pricing.trade_price_cents
      : null;
  const netCents = explicitNet ?? (baseRrpCents ? apply(baseRrpCents) : null);

  const fmt = (cents: number | null) => {
    if (cents == null || cents <= 0) return null;
    const ccy = (pricing?.currency || "EUR").toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(cents / 100);
    } catch {
      return `${ccy} ${(cents / 100).toLocaleString("en-US")}`;
    }
  };

  const retailLabel = retailLabelOverride ?? fmt(baseRrpCents) ?? rrpLabel ?? null;
  const netLabel = netLabelOverride ?? (tradeApproved && !clientSafe ? fmt(netCents) : null);
  const displayNet = netLabel ?? (tradeApproved && rrpLabel && discountPct ? null : null);

  const finishQuery = selectedFinishes.length
    ? `?finish=${encodeURIComponent(selectedFinishes.join(" / "))}`
    : "";
  const workspaceHref = `/trade/products/${productId}${finishQuery}`;

  const primaryLabel = tradeApproved ? "Add to Co-Pilot Workspace & Order" : "Place Order";
  const secondaryLabel = tradeApproved
    ? "Open Axonometric Studio"
    : "Request a Quote or Customisation";

  // Public: PLACE ORDER writes the configured piece into the shared cart state
  // and slides open the "Your Selection" drawer — never the account wall.
  // Secondary (both states) opens the brief-upload portal (QuoteBriefIntake).
  const openSelection = () => {
    onAddToCart?.(quantity);
    setMiniCartOpen(true);
  };
  const primaryAction = tradeApproved ? undefined : openSelection;
  const secondaryAction = () => setAccessOpen(true);

  // Sticky banners dispatch this instead of navigating to /cart. Only the
  // instance matching the current breakpoint reacts, so one drawer opens.
  useEffect(() => {
    if (tradeApproved) return;
    const handler = () => {
      const isDesktop =
        typeof window !== "undefined" &&
        window.matchMedia("(min-width: 768px)").matches;
      if (dockOnly === isDesktop) return;
      openSelection();
    };
    window.addEventListener("ma:open-selection", handler);
    return () => window.removeEventListener("ma:open-selection", handler);
  });

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!miniCartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [miniCartOpen]);

  const goToCheckout = () => {
    setMiniCartOpen(false);
    onPlaceOrder(quantity);
  };

  return (
    <>
      {/* Desktop / in-flow panel — public view relies on the page-level price
          at the top; only verified trade renders the Retail/Net block here */}
      {!dockOnly && (
      <div className="hidden md:flex flex-col gap-3 rounded-none border border-border/60 bg-muted/30 p-5 md:p-6">
        {leadTime && (
          <p className="font-body text-[11px] uppercase tracking-widest text-neutral-500">
            Production lead time: {cleanLeadTime(leadTime)}
          </p>
        )}
        {tradeApproved && displayNet ? (
          <PriceBlock rrpLabel={retailLabel} netLabel={displayNet} trade from={false} />
        ) : null}

        {tradeApproved ? (
          <Link to={workspaceHref} data-commerce-primary state={redirectTo ? { from: redirectTo } : undefined} className={primaryBtn}>
            {primaryLabel}
          </Link>
        ) : (
          <>
            <QuantitySelector value={quantity} onChange={setQuantity} />
            <button type="button" data-commerce-primary onClick={() => primaryAction()} disabled={placingOrder} className={primaryBtn}>
              {placingOrder && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
              {placingOrder ? "Opening checkout…" : primaryLabel}
            </button>
          </>
        )}

        <button type="button" data-commerce-secondary onClick={secondaryAction} className={secondaryBtn}>
          {secondaryLabel}
        </button>

        {/* Secondary utility links — Favorite / Pin / Finishes PDF, tucked
            inside the action panel under a faint hairline rule. */}
        {utilityLinks && (
          <div className="mt-1 border-t border-border/40 pt-4">
            {utilityLinks}
          </div>
        )}
      </div>
      )}

      {/* Mobile sticky bottom dock */}
      {dock && (
        <div
          className={cn(
            "md:hidden fixed bottom-0 left-0 right-0 z-[70]",
            "bg-background/95 backdrop-blur-md border-t border-border/60",
            "px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))]"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 shrink-0 max-w-[45%]">
              {tradeApproved && netLabel ? (
                <div className="flex flex-col">
                  <span className="font-body text-[9px] tracking-[0.04em] text-muted-foreground truncate">
                    Retail: {retailLabel ?? "—"}
                  </span>
                  <span className="font-display text-base leading-tight truncate">{netLabel}</span>
                </div>
              ) : (
                <span className="font-display text-base leading-tight truncate block">
                  {rrpLabel ?? retailLabel ?? "Price upon Request"}
                </span>
              )}
            </div>
            {tradeApproved ? (
              <Link
                to={workspaceHref}
                state={redirectTo ? { from: redirectTo } : undefined}
                className={cn(primaryBtn, "h-11 flex-1")}
              >
                Place Order
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => primaryAction()}
                disabled={placingOrder}
                className={cn(primaryBtn, "h-11 flex-1")}
              >
                {placingOrder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : primaryLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Slide-out mini-cart drawer (State A order confirmation) */}
      {!tradeApproved && (
        <div
          className={cn(
            "fixed inset-0 z-[90]",
            miniCartOpen ? "pointer-events-auto" : "pointer-events-none"
          )}
          aria-hidden={!miniCartOpen}
        >
          {/* Backdrop */}
          <div
            onClick={() => setMiniCartOpen(false)}
            className={cn(
              "absolute inset-0 bg-foreground/40 transition-opacity duration-300",
              miniCartOpen ? "opacity-100" : "opacity-0"
            )}
          />
          {/* Panel — slides right-to-left */}
          <aside
            role="dialog"
            aria-label="Your selection"
            className={cn(
              "absolute right-0 top-0 h-full w-full max-w-md",
              "bg-background border-l border-border/60 rounded-none",
              "flex flex-col transition-transform duration-300 ease-out will-change-transform",
              miniCartOpen ? "translate-x-0" : "translate-x-full"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 h-16 shrink-0">
              <h2 className="font-body text-xs uppercase tracking-[0.22em] text-foreground">
                Your Selection
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setMiniCartOpen(false)}
                className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Line item */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="flex gap-5">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={productTitle || "Selected piece"}
                    className="h-28 w-24 flex-none object-cover rounded-none border border-border/40"
                  />
                )}
                <div className="min-w-0">
                  {designerName && (
                    <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {designerName}
                    </p>
                  )}
                  <p className="mt-1 font-display text-base leading-snug text-foreground">
                    {productTitle}
                  </p>
                  {(orderFinishLabel || selectedFinishes.length > 0) && (
                    <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
                      {orderFinishLabel || selectedFinishes.join(" / ")}
                    </p>
                  )}
                  {leadTime && (
                    <p className="mt-1 font-body text-[11px] text-muted-foreground/80">
                      Lead time · {leadTime}
                    </p>
                  )}
                  {(retailLabel || rrpLabel) && (
                    <p className="mt-2 font-body text-sm text-foreground">
                      {retailLabel ?? rrpLabel}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <QuantitySelector value={quantity} onChange={setQuantity} />
              </div>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-border/60 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={goToCheckout}
                disabled={placingOrder}
                className={primaryBtn}
              >
                {placingOrder && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                {placingOrder ? "Opening checkout…" : "Go to Checkout"}
              </button>
              <button
                type="button"
                onClick={() => setMiniCartOpen(false)}
                className="mt-3 w-full text-center font-body text-[11px] uppercase tracking-widest text-muted-foreground underline underline-offset-4 decoration-border transition-colors hover:text-foreground"
              >
                Continue Browsing
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Quote / customisation → frictionless brief intake (State A) */}
      <Dialog open={accessOpen} onOpenChange={(o) => { setAccessOpen(o); if (!o) setManualForm(false); }}>
        <DialogContent className="flex w-[95vw] max-w-lg md:max-w-4xl lg:max-w-5xl h-auto max-h-[92vh] flex-col overflow-hidden rounded-none p-0 border-border/60">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <QuoteBriefIntake
              productTitle={productTitle}
              designerName={designerName}
              redirectTo={redirectTo}
              onDone={() => { setAccessOpen(false); setManualForm(false); }}
            />
          </div>

        </DialogContent>
      </Dialog>

    </>
  );
}
