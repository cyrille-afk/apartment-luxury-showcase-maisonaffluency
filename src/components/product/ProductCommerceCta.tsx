import { useProductConfigOptional } from "@/contexts/ProductConfigContext";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { getCart, shouldUseFullPageCart, useCart } from "@/lib/cart";
import { Loader2, Minus, Plus } from "lucide-react";
import SelectionDrawer, { type PaymentMethod } from "@/components/product/SelectionDrawer";
import OrderIntakeSheet, { type OrderIntakeDetails } from "@/components/product/OrderIntakeSheet";

import { useTradeProductPricing } from "@/hooks/useTradeProductPricing";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useClientSafeMode } from "@/lib/clientSafeMode";
import { setStickyCommerceDockHeight } from "@/lib/stickyCommerceDock";
import { isPwaStandaloneDisplay } from "@/lib/pwaMode";
import { cn } from "@/lib/utils";

/**
 * Multi-tier product commerce CTA.
 *
 * STATE A (public / logged out): quantity stepper + a single "Place Order"
 * action that adds the configured piece to the cart / selection drawer.
 * Strictly transactional — no quote or enquiry paths.
 *
 * STATE B (verified trade): two-line price (Retail / Net Trade Price) +
 * quantity stepper + "Proceed to Order" (direct checkout at the net trade
 * rate) + a secondary outlined "Add to Co-Pilot Workspace" link. The
 * Axonometric Studio entry lives outside this box, directly under the finish
 * selectors (see AxonometricStudioButton).
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
  onAddToCart?: (quantity: number) => boolean | void;
  placingOrder?: boolean;
  /** Trade: finish selection carried to the workspace */
  selectedFinishes?: string[];
  /** Display-accurate finish label (axis reference merged with swatch colourway). */
  orderFinishLabel?: string | null;
  /** All selectable finishes — enables the quote sheet's finish selector. */
  finishOptions?: string[];
  /** Per-finish price + image, powering live re-pricing inside the intake sheet. */
  finishVariants?: { label: string; priceLabel?: string | null; imageUrl?: string | null }[];
  /** Public priced pieces with no finish chosen yet: the CTA invites a finish
      choice and smooth-scrolls to the swatches instead of placing an order. */
  finishSelectionRequired?: boolean;
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
  selectedFinishes = [],
  orderFinishLabel = null,
  finishOptions,
  finishVariants,
  finishSelectionRequired = false,
  redirectTo,
  dock = true,
  dockOnly = false,
  productTitle,
  designerName,
  imageUrl,
  leadTime,
  utilityLinks,
}: ProductCommerceCtaProps) {
  const navigate = useNavigate();
  // Quantity lives in the container engine so both layout variants share it;
  // falls back to local state when rendered outside ProductPageContainer.
  const productConfig = useProductConfigOptional();
  const [localQuantity, setLocalQuantity] = useState(1);
  const quantity = productConfig ? productConfig.quantity : localQuantity;
  const setQuantity = productConfig ? productConfig.setQuantity : setLocalQuantity;
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const cartItems = useCart();

  // The mobile dock stays fixed at the viewport bottom for the full product
  // journey; it must never tuck behind cookie banners, footers, or content.

  // Notify floating action buttons (e.g., the image-gallery presentation menu)
  // how much of the bottom of the viewport the mobile commerce dock owns.
  // Measured, not hardcoded: iOS Safari's collapsing toolbar and multi-line
  // price copy both change the dock's real height.
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const update = () => {
      const mobileOrPwa = mql.matches || isPwaStandaloneDisplay();
      const visible = dock && mobileOrPwa;
      const el = dockRef.current;
      setStickyCommerceDockHeight(visible && el ? el.getBoundingClientRect().height : 0);
    };
    update();
    mql.addEventListener("change", update);
    window.addEventListener("resize", update, { passive: true });
    window.visualViewport?.addEventListener("resize", update);
    const ro = dockRef.current ? new ResizeObserver(update) : null;
    if (ro && dockRef.current) ro.observe(dockRef.current);
    return () => {
      mql.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      ro?.disconnect();
      setStickyCommerceDockHeight(0);
    };
  }, [dock]);

  
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

  const primaryLabel = tradeApproved ? "Proceed to Order" : "Place Order";

  // Public mobile dock: pieces without a displayed RRP move from a direct
  // order CTA to a quote & customization request, while keeping the same
  // single-tap action path.
  const isUnpriced =
    !tradeApproved &&
    (!rrpLabel || rrpLabel.trim().toLowerCase() === "price upon request");
  const mobilePrimaryLabel = finishSelectionRequired
    ? "Choose Finishes"
    : isUnpriced
      ? "Request Quote & Customization"
      : primaryLabel;

  // Public: PLACE ORDER writes the configured piece into the shared cart state
  // and slides open the "Your Selection" drawer — never the account wall.
  // Display-routing controller (price-agnostic): a single-item cart stays in
  // the drawer; 2+ items route to the full-page /cart layout.
  const openSelection = () => {
    const added = onAddToCart?.(quantity);
    // Pieces without a public price never enter the cart — route those to the
    // concierge enquiry instead of opening an empty drawer over a locked page.
    if (added === false) {
      onPlaceOrder(quantity);
      return;
    }
    if (shouldUseFullPageCart(getCart())) {
      setMiniCartOpen(false);
      navigate("/cart");
      return;
    }
    setMiniCartOpen(true);
  };
  const primaryAction = tradeApproved ? undefined : openSelection;

  /**
   * Secondary CTA: bespoke / contract enquiries go to the Trade Account
   * inquiry form. The primary PLACE ORDER path never touches this route.
   */
  const goToTradeInquiry = () => {
    navigate(
      `/contact?${new URLSearchParams({
        subject: `Bespoke Quote / Customisation — ${productTitle || "Product"}${designerName ? ` by ${designerName}` : ""}`,
        productId,
        productName: productTitle || "",
        designerName: designerName || "",
        back: typeof window !== "undefined" ? window.location.pathname + window.location.search : "",
      }).toString()}#contact`,
    );
  };

  // Unpriced pieces: the page asks for the in-page quote sheet rather than
  // sending a shopper to the corporate Trade Account form.
  useEffect(() => {
    const handler = () => {
      if (tradeApproved) return;
      const isDesktop =
        typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
      if (dockOnly === isDesktop) return;
      setQuoteOpen(true);
    };
    window.addEventListener("ma:open-quote", handler);
    return () => window.removeEventListener("ma:open-quote", handler);
  });

  // No finish chosen yet: the primary action becomes a gentle guide that
  // smooth-scrolls straight to the finish swatches instead of ordering.
  const scrollToFinishes = () => {
    const el = document.getElementById("finish-selectors");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Fallback: first swatch control anywhere on the page.
    document
      .querySelector<HTMLElement>("[data-finish-selectors], [aria-label*='finish' i]")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Mobile: PLACE ORDER opens the conversational 3-step intake sheet first;
  // its completion hands off to the existing selection / checkout flow.
  const handleMobilePrimary = () => {
    if (finishSelectionRequired) {
      scrollToFinishes();
      return;
    }
    if (tradeApproved) {
      onPlaceOrder(quantity);
      return;
    }
    setIntakeOpen(true);
  };

  const handleIntakeComplete = (details: OrderIntakeDetails) => {
    try {
      sessionStorage.setItem("ma_order_intake", JSON.stringify({ ...details, productId }));
    } catch {
      /* private mode — intake is a soft capture, never blocks the order */
    }
    // Quote requests are already submitted by the sheet, which then shows its
    // own thank-you screen. Never hand those off to cart / account flows.
    if (isUnpriced) return;
    setIntakeOpen(false);
    openSelection();
  };

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

  // The mobile sticky mini bar's compact CTA dispatches this event; only the
  // dock instance (mobile) reacts, opening the same intake/quote sheet as the
  // bottom dock's primary button (or direct checkout for verified trade).
  useEffect(() => {
    const handler = () => {
      if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) return;
      if (!dock) return;
      handleMobilePrimary();
    };
    window.addEventListener("ma:open-intake", handler);
    return () => window.removeEventListener("ma:open-intake", handler);
  });

  // Safety net: if the cart reaches 2+ lines while the drawer is open (a write
  // that landed after the click, or another tab), hand off to the full page.
  useEffect(() => {
    if (!miniCartOpen) return;
    if (shouldUseFullPageCart(cartItems)) {
      setMiniCartOpen(false);
      navigate("/cart");
    }
  }, [miniCartOpen, cartItems, navigate]);


  // Drawer quantity stepper: quantity alone never changes the layout — only a
  // 2nd unique line routes to the full-page cart. Keep the line in sync.
  const handleDrawerQuantity = (q: number) => {
    setQuantity(q);
    onAddToCart?.(q);
  };

  const goToCheckout = () => {
    setMiniCartOpen(false);
    onPlaceOrder(quantity);
  };

  // Drawer footer: online → Stripe checkout; wire → checkout with the wire
  // method pre-selected via a one-shot flag.
  const handleCheckout = (method: PaymentMethod) => {
    if (method === "wire") {
      try {
        sessionStorage.setItem("ma_checkout_wire", "1");
      } catch {
        /* private mode — falls back to the online flow */
      }
    }
    goToCheckout();
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
          <>
            <QuantitySelector value={quantity} onChange={setQuantity} />
            {/* Primary: direct order at the net trade rate — no workspace detour. */}
            <button type="button" data-commerce-primary onClick={() => onPlaceOrder(quantity)} disabled={placingOrder} className={primaryBtn}>
              {placingOrder && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
              {placingOrder ? "Opening checkout…" : primaryLabel}
            </button>
            {/* Secondary: co-pilot workspace planning. */}
            <Link to={workspaceHref} data-commerce-secondary state={redirectTo ? { from: redirectTo } : undefined} className={secondaryBtn}>
              Add to Co-Pilot Workspace
            </Link>
          </>
        ) : (
          <>
            <QuantitySelector value={quantity} onChange={setQuantity} />
            <button type="button" data-commerce-primary onClick={() => primaryAction()} disabled={placingOrder} className={primaryBtn}>
              {placingOrder && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
              {placingOrder ? "Opening checkout…" : primaryLabel}
            </button>
            {/* Secondary: high-touch / contract buyers — routes explicitly to
                the Trade Account inquiry form. */}
            <button
              type="button"
              data-commerce-quote
              onClick={goToTradeInquiry}
              className={secondaryBtn}
            >
              Request a Bespoke Quote / Customisation
            </button>
          </>
        )}

        {/* Secondary utility links — Favorite / Pin / Finishes PDF, tucked
            inside the action panel under a faint hairline rule. */}
        {utilityLinks && (
          <div className="mt-1 border-t border-border/40 pt-4">
            {utilityLinks}
          </div>
        )}
      </div>
      )}

      {/* Mobile sticky bottom dock — anchored to the viewport window so it
          always floats above page content, technical specs, footer, and any
          translucent background blocks while scrolling. */}
      {dock && typeof document !== "undefined" && createPortal(
        <div
          ref={dockRef}
          className={cn(
            "md:hidden fixed bottom-[env(safe-area-inset-bottom,0px)] left-0 z-[100] w-full",
            "bg-background border-t border-border/50 shadow-[0_-6px_18px_rgba(0,0,0,0.06)]",
            "px-4 pb-3 pt-3.5"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {tradeApproved && netLabel ? (
                <div className="flex flex-col">
                  <span className="font-body text-[9px] tracking-[0.04em] text-muted-foreground truncate">
                    Retail: {retailLabel ?? "—"}
                  </span>
                  <span className="font-display text-base leading-tight truncate">{netLabel}</span>
                </div>
              ) : (
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "font-display leading-tight truncate block",
                      finishSelectionRequired ? "text-sm" : "text-base"
                    )}
                  >
                    {finishSelectionRequired
                      ? "Select Finishes for Pricing"
                      : rrpLabel ?? retailLabel ?? "Price upon Request"}
                  </span>
                  {!finishSelectionRequired && (
                    <span className="font-body text-[9px] uppercase tracking-[0.12em] text-muted-foreground/80 truncate">
                      Excl. shipping &amp; duties
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleMobilePrimary}
              disabled={placingOrder}
              className={cn(
                primaryBtn,
                "h-11 shrink-0 w-auto px-7 whitespace-nowrap",
                isUnpriced && "px-4 text-[11px] tracking-wide",
                "active:scale-[0.98] transition-transform duration-150"
              )}
            >
              {placingOrder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mobilePrimaryLabel}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Slide-out mini-cart drawer (State A order confirmation) */}
      {!tradeApproved && (
        <SelectionDrawer
          isOpen={miniCartOpen}
          onClose={() => setMiniCartOpen(false)}
          brand={designerName}
          title={productTitle}
          configuration={orderFinishLabel || (selectedFinishes.length ? selectedFinishes.join(" / ") : null)}
          leadTime={leadTime}
          priceLabel={retailLabel || rrpLabel || null}
          imageUrl={imageUrl}
          quantity={quantity}
          onQuantityChange={handleDrawerQuantity}
          onCheckout={handleCheckout}
          placing={placingOrder}
        />
      )}

      {/* Bespoke quote sheet (secondary white button — any breakpoint). The
          sheet handles submission + its own thank-you state; no cart handoff. */}
      {!tradeApproved && (
        <OrderIntakeSheet
          isOpen={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          onComplete={() => {
            /* Quote requests end on the sheet's thank-you screen. */
          }}
          productTitle={productTitle}
          designerName={designerName}
          priceLabel={retailLabel || rrpLabel || null}
          finishLabel={
            orderFinishLabel || (selectedFinishes.length ? selectedFinishes.join(" / ") : null)
          }
          finishOptions={finishOptions}
          finishVariants={finishVariants}
          baseImageUrl={imageUrl}
          submitting={placingOrder}
          mode="quote"
          productId={productId}
        />
      )}

      {/* Mobile 3-step order intake bottom sheet */}
      {!tradeApproved && (
        <OrderIntakeSheet
          isOpen={intakeOpen}
          onClose={() => setIntakeOpen(false)}
          onComplete={handleIntakeComplete}
          productTitle={productTitle}
          designerName={designerName}
          priceLabel={retailLabel || rrpLabel || null}
          finishLabel={
            orderFinishLabel || (selectedFinishes.length ? selectedFinishes.join(" / ") : null)
          }
          finishOptions={finishOptions}
          finishVariants={finishVariants}
          baseImageUrl={imageUrl}
          submitting={placingOrder}
          mode={isUnpriced ? "quote" : "order"}
          productId={productId}
        />
      )}
    </>
  );
}
