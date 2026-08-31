import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TradeExclusiveCard } from "@/components/product/PublicSpecTable";
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
  /** Direct Stripe checkout — receives the chosen quantity */
  onPlaceOrder: (quantity?: number) => void;
  placingOrder?: boolean;
  onRequestQuote: () => void;
  /** Trade: finish selection carried to the workspace */
  selectedFinishes?: string[];
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
}

/** Compact luxury quantity stepper: "QUANTITY: − 1 +" */
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
        "flex items-center justify-between border-b border-border/60",
        compact ? "py-1.5" : "py-2"
      )}
    >
      <span className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Quantity:
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={value <= 1}
          onClick={() => onChange(Math.max(1, value - 1))}
          className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-all hover:text-foreground disabled:opacity-30"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-5 text-center font-body text-xs tabular-nums text-foreground">
          {value}
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          disabled={value >= 99}
          onClick={() => onChange(Math.min(99, value + 1))}
          className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-all hover:text-foreground disabled:opacity-30"
        >
          <Plus className="h-3 w-3" />
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
        <p className="font-body text-[11px] tracking-[0.04em] text-muted-foreground">
          {rrpLabel ? `Retail: ${from ? "From " : ""}${rrpLabel} (Before Tax)` : "Retail on request (Before Tax)"}
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
  onPlaceOrder,
  placingOrder = false,
  onRequestQuote,
  selectedFinishes = [],
  redirectTo,
  dock = true,
  dockOnly = false,
  productTitle,
  designerName,
  imageUrl,
  leadTime,
}: ProductCommerceCtaProps) {
  const [accessOpen, setAccessOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [miniCartOpen, setMiniCartOpen] = useState(false);
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

  const retailLabel = fmt(baseRrpCents) ?? rrpLabel ?? null;
  const netLabel = tradeApproved && !clientSafe ? fmt(netCents) : null;
  const displayNet = netLabel ?? (tradeApproved && rrpLabel && discountPct ? null : null);

  const finishQuery = selectedFinishes.length
    ? `?finish=${encodeURIComponent(selectedFinishes.join(" / "))}`
    : "";
  const workspaceHref = `/trade/products/${productId}${finishQuery}`;

  const openStudio = () => {
    window.dispatchEvent(new CustomEvent("concierge:stage", { detail: { openPanel: true } }));
  };

  const primaryLabel = tradeApproved ? "Add to Co-Pilot Workspace & Order" : "Place Order";
  const secondaryLabel = tradeApproved
    ? "Open 3D Studio & Axonometric Planning"
    : "Request a Quote or Customisation";

  // Public: PLACE ORDER opens the slide-out mini-cart drawer (order confirmation),
  // which then hands off to checkout with the chosen quantity.
  const primaryAction = tradeApproved ? undefined : () => setMiniCartOpen(true);
  const secondaryAction = tradeApproved ? openStudio : () => setAccessOpen(true);

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
        {tradeApproved && displayNet ? (
          <PriceBlock rrpLabel={retailLabel} netLabel={displayNet} trade from={false} />
        ) : null}

        {tradeApproved ? (
          <Link to={workspaceHref} state={redirectTo ? { from: redirectTo } : undefined} className={primaryBtn}>
            {primaryLabel}
          </Link>
        ) : (
          <>
            <QuantitySelector value={quantity} onChange={setQuantity} />
            <button type="button" onClick={() => primaryAction()} disabled={placingOrder} className={primaryBtn}>
              {placingOrder && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
              {placingOrder ? "Opening checkout…" : primaryLabel}
            </button>
          </>
        )}

        <button type="button" onClick={secondaryAction} className={secondaryBtn}>
          {secondaryLabel}
        </button>
      </div>
      )}

      {/* Mobile sticky bottom dock */}
      {dock && (
        <div
          className={cn(
            "md:hidden fixed bottom-0 left-0 right-0 z-[70]",
            "bg-background/95 backdrop-blur-md border-t border-border/60",
            "px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
                className={cn(primaryBtn, "h-11 flex-1 text-[10px]")}
              >
                {primaryLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={primaryAction}
                disabled={placingOrder}
                className={cn(primaryBtn, "h-11 flex-1 text-[10px]")}
              >
                {placingOrder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : primaryLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quote / customisation → Trade Exclusive Access modal (State A) */}
      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="max-w-md rounded-none p-0 border-border/60">
          <div className="p-4 md:p-5">
            <TradeExclusiveCard redirectTo={redirectTo} rrpLabel={rrpLabel} onRequestQuote={onRequestQuote} />
            <button
              type="button"
              onClick={() => {
                setAccessOpen(false);
                onRequestQuote();
              }}
              className="mt-3 w-full text-center font-body text-[11px] uppercase tracking-widest text-muted-foreground underline underline-offset-4 decoration-border hover:text-foreground transition-colors"
            >
              Or request a quote / customisation directly
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
