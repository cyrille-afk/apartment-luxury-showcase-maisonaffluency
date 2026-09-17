import { useProductConfigOptional } from "@/contexts/ProductConfigContext";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { getCart, shouldUseFullPageCart, useCart } from "@/lib/cart";
import { Loader2, Minus, Plus } from "lucide-react";
import SelectionDrawer, { type PaymentMethod } from "@/components/product/SelectionDrawer";
import BespokeConfigurationDialog from "@/components/product/BespokeConfigurationDialog";
import OrderIntakeSheet, { type OrderIntakeDetails } from "@/components/product/OrderIntakeSheet";
import { useCheckoutForm } from "@/contexts/CheckoutFormContext";

import { useTradeProductPricing } from "@/hooks/useTradeProductPricing";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useClientSafeMode } from "@/lib/clientSafeMode";
import { cn } from "@/lib/utils";
import { setStickyCommerceDockHeight } from "@/lib/stickyCommerceDock";

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
  const [bespokeOpen, setBespokeOpen] = useState(false);
  // 3-step intent capture (Intent → Project → Contact) gating both the order
  // and the bespoke/quote path. Null = no gate open.
  const [intakeFor, setIntakeFor] = useState<null | "order" | "bespoke">(null);
  // Detail captured in the 3 steps, carried into whatever opens next.
  const [intakeDetails, setIntakeDetails] = useState<OrderIntakeDetails | null>(null);
  const [desktopDirectBespoke, setDesktopDirectBespoke] = useState(false);
  const checkoutForm = useCheckoutForm();
  // True when the open drawer holds a piece with no public price.
  const [quoteOnlySelection, setQuoteOnlySelection] = useState(false);
  const cartItems = useCart();

  
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
    // Pieces without a public price still open the same drawer — the line reads
    // "Price upon Request" and its footer routes to the bespoke quotation.
    if (added === false) {
      setQuoteOnlySelection(true);
      setMiniCartOpen(true);
      return;
    }
    setQuoteOnlySelection(false);
    if (shouldUseFullPageCart(getCart())) {
      setMiniCartOpen(false);
      navigate("/cart");
      return;
    }
    setMiniCartOpen(true);
  };
  /**
   * Intent gate: public visitors qualify themselves (designer vs private
   * client), state the project city and leave contact detail before either the
   * order drawer or the bespoke dialog opens. Captured once per session —
   * returning visitors go straight through.
   */
  // Captured once per browsing session (not forever): stored details only skip
  // the gate after the visitor has actually completed it in this tab.
  const intakeCaptured = Boolean(
    checkoutForm.buyerProfile &&
      checkoutForm.projectCity.trim() &&
      checkoutForm.email.trim() &&
      (() => {
        try {
          return sessionStorage.getItem("ma_intake_done") === "1";
        } catch {
          return true;
        }
      })(),
  );

  const runIntent = (target: "order" | "bespoke") => {
    if (target === "order") openSelection();
    else setBespokeOpen(true);
  };

  const startIntent = (target: "order" | "bespoke") => {
    const desktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
    if (target === "bespoke" && desktop) {
      setDesktopDirectBespoke(true);
      setIntakeFor(target);
      return;
    }
    setDesktopDirectBespoke(false);
    if (tradeApproved || intakeCaptured) {
      runIntent(target);
      return;
    }
    setIntakeFor(target);
  };

  const completeIntake = (details: OrderIntakeDetails) => {
    const target = intakeFor ?? "order";
    // A direct desktop bespoke submission owns its Step 4 confirmation inside
    // this same drawer. Keep it mounted until the visitor explicitly closes it.
    if (!(target === "bespoke" && desktopDirectBespoke)) setIntakeFor(null);
    setIntakeDetails(details);
    try {
      sessionStorage.setItem("ma_intake_done", "1");
    } catch {
      /* private mode */
    }
    checkoutForm.update({
      email: details.email,
      projectCity: details.city,
      buyerProfile: details.profile,
    });
    // One continuous motion: the sheet finishes closing before the selection
    // drawer / bespoke dialog takes the canvas — never both on screen at once.
    if (!(target === "bespoke" && desktopDirectBespoke)) {
      window.setTimeout(() => runIntent(target), 260);
    }
  };

  const primaryAction = tradeApproved ? undefined : () => startIntent("order");

  /**
   * Secondary CTA: bespoke / customisation enquiries open a centred overlay
   * dialog on the product canvas — never the Trade Account registration page.
   */
  const openBespoke = () => startIntent("bespoke");

  // Unpriced pieces: the page asks for the in-canvas bespoke dialog rather than
  // sending a shopper to the corporate Trade Account form.
  useEffect(() => {
    const handler = () => {
      if (tradeApproved) return;
      const isDesktop =
        typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
      if (dockOnly === isDesktop) return;
      startIntent("bespoke");
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

  // Publish the dock's measured height so the floating action buttons can lift
  // above it. Height is 0 when the dock is display:none (desktop) or unmounted.
  const dockMeasureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      setStickyCommerceDockHeight(0);
      return;
    }
    const publish = () => setStickyCommerceDockHeight(node.getBoundingClientRect().height);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(node);
    const mql = window.matchMedia("(min-width: 768px)");
    mql.addEventListener("change", publish);
  }, []);

  // Mobile: PLACE ORDER follows the same in-canvas selection drawer path.
  const handleMobilePrimary = () => {
    if (tradeApproved) {
      onPlaceOrder(quantity);
      return;
    }
    startIntent("order");
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
      startIntent("order");
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
            {/* Price-upon-Request pieces are quote-only: the Place Order CTA
                and quantity stepper are unmounted entirely, and the bespoke
                request becomes the single primary action. */}
            {!isUnpriced && (
              <>
                <QuantitySelector value={quantity} onChange={setQuantity} />
                <button
                  type="button"
                  data-commerce-primary
                  onClick={() => (finishSelectionRequired ? scrollToFinishes() : primaryAction())}
                  disabled={placingOrder}
                  className={primaryBtn}
                >
                  {placingOrder && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                  {placingOrder ? "Opening checkout…" : finishSelectionRequired ? "Choose Finishes" : primaryLabel}
                </button>
              </>
            )}
            {/* High-touch / contract buyers — opens the bespoke configuration
                dialog on the product canvas. Elevated to the primary block
                when the piece is Price upon Request. */}
            <button
              type="button"
              data-commerce-quote
              onClick={openBespoke}
              className={isUnpriced ? primaryBtn : secondaryBtn}
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

      {/* Mobile dock: portaled directly under body, outside every product/layout
          wrapper. Its position and height never depend on page scroll state. */}
      {dock && typeof document !== "undefined" && createPortal(
        <div
          data-mobile-commerce-dock
          ref={dockMeasureRef}
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 pt-3 pb-[env(safe-area-inset-bottom,16px)]"
        >
          <div className="flex min-h-11 w-full items-center justify-between gap-3">
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
                onClick={() => (finishSelectionRequired ? scrollToFinishes() : handleMobilePrimary())}
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
          priceLabel={
            quoteOnlySelection ? "Price upon Request" : retailLabel || rrpLabel || null
          }
          imageUrl={imageUrl}
          quantity={quantity}
          onQuantityChange={quoteOnlySelection ? setQuantity : handleDrawerQuantity}
          quoteOnly={quoteOnlySelection}
          onCheckout={
            quoteOnlySelection
              ? () => {
                  setMiniCartOpen(false);
                  setBespokeOpen(true);
                }
              : handleCheckout
          }
          placing={placingOrder}
        />
      )}

      {/* Bespoke configuration dialog (secondary action — any breakpoint).
          Centred overlay on the product canvas; never the account wall. */}
      {(
        <BespokeConfigurationDialog
          isTradeAuthorized={!!tradeApproved}
          isOpen={bespokeOpen}
          onClose={() => setBespokeOpen(false)}
          productId={productId}
          productTitle={productTitle}
          designerName={designerName}
          finishLabel={
            orderFinishLabel ||
            (selectedFinishes.length ? selectedFinishes.join(" / ") : null) ||
            // Nothing manually chosen: fall back to the finish currently
            // highlighted on the canvas (first selectable swatch).
            finishOptions?.[0] ||
            null
          }
          imageUrl={imageUrl}
          prefillEmail={intakeDetails?.email || checkoutForm.email || null}
          prefillPhone={intakeDetails?.phone || null}
          prefillNotes={intakeDetails?.notes || null}
        />
      )}

      {/* 3-step intent capture — mobile sheet / centred desktop panel. Runs
          ahead of both the order drawer and the bespoke dialog. */}
      {(!tradeApproved || intakeFor === "bespoke") && (
        <OrderIntakeSheet
          isOpen={intakeFor !== null}
          onClose={() => setIntakeFor(null)}
          onComplete={completeIntake}
          mode={desktopDirectBespoke ? "quote" : "order"}
          isTradeAuthorized={tradeApproved}
          finalLabel={
            intakeFor === "bespoke"
              ? desktopDirectBespoke ? "Submit Specifications" : "Continue to Bespoke Details"
              : "Continue to Your Selection"
          }
          productId={productId}
          productTitle={productTitle}
          designerName={designerName}
          priceLabel={retailLabel || rrpLabel || "Price upon Request"}
          finishLabel={
            orderFinishLabel ||
            (selectedFinishes.length ? selectedFinishes.join(" / ") : null) ||
            finishOptions?.[0] ||
            null
          }
          finishOptions={finishOptions}
          finishVariants={finishVariants}
          baseImageUrl={imageUrl}
        />
      )}
    </>

  );
}
