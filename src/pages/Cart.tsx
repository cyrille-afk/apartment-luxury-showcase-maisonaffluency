import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Minus, Plus, Loader2, Heart, ChevronRight } from "lucide-react";
import { looksLikeDimension } from "@/lib/rugPricing";
import { isHighTicketEuropeanFulfillment } from "@/lib/europeanLogistics";
import Navigation from "@/components/Navigation";
import FavoriteFolderPicker from "@/components/FavoriteFolderPicker";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccountDiscount } from "@/hooks/useAccountDiscount";
import { AccountPricingBadge } from "@/components/product/AccountPricingBadge";
import { releaseBodyScroll } from "@/lib/bodyScrollLock";
import { VisaMark, MastercardMark, BankTransferMark } from "@/components/checkout/PaymentMarks";
import { useEstimatedShipping, ESTIMATED_SHIPPING_NOTE } from "@/hooks/useShippingCountry";
import { useUsdToSgdRate } from "@/hooks/useUsdToSgdRate";
import { useShippingDestination } from "@/lib/shippingDestination";
import { ShippingCountryIndicator } from "@/components/checkout/ShippingCountryIndicator";
import { getFxRates, convertCentsWithFallback } from "@/lib/fxRates";
import { resolveBaseCurrency } from "@/lib/checkout/multiCurrency";



import {
  useCart,
  setQuantity,
  removeFromCart,
  clearCart,
  
  formatMoney,
  refreshCartFx,
} from "@/lib/cart";

export default function Cart() {
  const items = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, isTradeUser, isAdmin, tradeStatus } = useAuth();
  const [pending, setPending] = useState<null | "card" | "bank_transfer">(null);

  // Landing here always means every overlay is gone — never inherit a stray
  // scroll lock from a drawer that was open when we navigated.
  useEffect(() => {
    releaseBodyScroll();
    // Re-price any converted lines with the current live FX rate — stored
    // lines may carry a stale/offline rate from add-to-cart time.
    refreshCartFx();
  }, []);

  useEffect(() => {

    if (params.get("status") === "cancelled") {
      toast("Checkout cancelled — your cart is still here.");
    }
  }, [params]);

  // Display currency: a single-currency cart keeps its own currency; a mixed
  // cart (e.g. a USD lamp + a EUR armchair) is normalised to USD so the
  // subtotal is a real converted sum, never a raw addition of two currencies.
  const currency = useMemo(
    () =>
      resolveBaseCurrency(
        items.map((i) => ({
          currency: i.currency,
          unitCents: i.unitPriceCents,
          quantity: i.quantity,
        })),
      ),
    [items],
  );

  // Live FX rates for every line currency → display currency.
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const fxPairsKey = useMemo(
    () =>
      [...new Set(items.map((i) => (i.currency || "USD").toUpperCase()))]
        .filter((c) => c !== currency)
        .sort()
        .join(","),
    [items, currency],
  );
  useEffect(() => {
    let cancelled = false;
    const srcs = fxPairsKey ? fxPairsKey.split(",") : [];
    if (srcs.length === 0) {
      setFxRates({});
      return;
    }
    getFxRates(srcs.map((src) => ({ src, tgt: currency }))).then((r) => {
      if (!cancelled) setFxRates(r);
    });
    return () => {
      cancelled = true;
    };
  }, [fxPairsKey, currency]);

  /** Convert a line amount into the display currency (safe fallback table). */
  const toDisplay = (cents: number, code?: string | null) =>
    convertCentsWithFallback(cents, (code || currency).toUpperCase(), currency, fxRates);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + toDisplay(i.unitPriceCents * i.quantity, i.currency),
        0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, currency, fxRates],
  );

  // Account-level tier discount (admin / verified trade), resolved from the
  // backend and re-applied server-side before payment.
  const discount = useAccountDiscount();
  // Delivery is quoted by the advisor post-purchase, so the displayed total
  // is the goods subtotal less any tier discount (no invented shipping figure).
  const destination = useShippingDestination();
  // Freight is capped at 15% of the discounted goods value; above that the
  // figure shown is an initial deposit pending advisor validation.
  const freightEstimate = useEstimatedShipping(
    items,
    destination.iso,
    currency,
    discount.totalFor(subtotal),
  );
  // Payable now = goods less tier discount. The Estimated Total adds the
  // indicative freight figure (advisor-verified, invoiced separately) so the
  // headline number is the true landed-estimate: subtotal + delivery.
  const total = discount.totalFor(subtotal);
  const estimatedGrandTotal = total + freightEstimate.cents;
  // Headline figure: when a freight estimate exists it is the full sum;
  // otherwise (freight to be quoted) fall back to the goods total.
  const estimatedTotal = freightEstimate.cents > 0 ? estimatedGrandTotal : total;

  /** Show the Paris logistics advisory when a high-ticket European piece is in the cart. */
  const showEuropeanLogisticsNotice = useMemo(
    () =>
      items.some((item) =>
        isHighTicketEuropeanFulfillment(
          item.unitPriceCents,
          item.origin,
          item.pickupCountry,
          item.sourceCurrency,
        ),
      ),
    [items],
  );

  const sgdRate = useUsdToSgdRate();
  const sgdEquivalent = useMemo(() => {
    if (currency !== "USD") return null;
    // Convert the true estimated total (subtotal + shipping), not the subtotal.
    return Math.round((estimatedTotal / 100) * sgdRate.rate);
  }, [estimatedTotal, sgdRate.rate, currency]);

  const formatUsd = (cents: number, code = currency) =>
    code === "USD" ? `USD ${formatMoney(cents, code)}` : formatMoney(cents, code);


  // "Continue Selection" returns to the curator's picks of the designer whose
  // piece was added last, rather than the generic designers landing page.
  // Trade members (and admins) keep their full trade catalogue context rather
  // than being dropped back onto the public template.
  const hasTradeAccess = isAdmin || (isTradeUser && tradeStatus === "approved");
  const lastSlug = items.length ? items[items.length - 1].designerSlug : null;
  const continueHref = hasTradeAccess
    ? lastSlug
      ? // Trade atelier pages open the full portrait biography by default;
        // the summary flag lands on the product catalogue view instead.
        `/trade/designers/${lastSlug}?portrait=summary`
      : "/trade/designers"
    : lastSlug
      ? `/designers/${lastSlug}`
      : "/designers";

  // Step 1 hands off to the identity gateway (step 2), where the collector
  // signs in, creates an account, or continues as a guest. Signed-in
  // collectors skip straight through to the payment session.
  const goToIdentity = async (method: "card" | "bank_transfer") => {
    if (!items.length) return;
    if (!user) {
      navigate(`/cart/identify?method=${method}`);
      return;
    }
    // Card payments use the branded in-page checkout (/checkout) so the
    // collector never leaves Maison Affluency's design system. Bank transfer
    // still creates the order + wire instructions via the edge function.
    if (method === "card") {
      navigate("/checkout", {
        state: {
          lines: items.map((i) => ({
            title: i.title,
            designer: i.designerName,
            finishLabel: i.finishLabel,
            imageUrl: i.imageUrl,
            unitCents: i.unitPriceCents,
            currency: i.currency,
            leadTime: i.leadTime,
            productPath:
              i.designerSlug && i.productSlug
                ? `/designers/${i.designerSlug}/${i.productSlug}`
                : null,
            quantity: i.quantity,
            origin: i.origin ?? null,
            pickupCountry: i.pickupCountry ?? null,
          })),
        },
      });
      return;
    }
    setPending(method);
    try {
      const { data, error } = await supabase.functions.invoke("create-cart-checkout", {
        body: {
          method,
          email: user.email || undefined,
          items: items.map((i) => ({
            pickId: i.pickId,
            productSlug: i.productSlug,
            designerSlug: i.designerSlug,
            title: i.title,
            designerName: i.designerName,
            finishLabel: i.finishLabel,
            variant: i.variant ?? null,
            expectedUnitPriceCents: i.unitPriceCents,
            imageUrl: i.imageUrl,
            leadTime: i.leadTime,
            quantity: i.quantity,
          })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      clearCart();
      navigate(`/order-confirmation?ref=${(data as any).orderRef}&status=bank_transfer`);
    } catch (e: any) {
      toast.error(e?.message || "We couldn't start your checkout. Please try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Your Cart — Maison Affluency</title>
        <meta name="description" content="Review your selected collectible design pieces, delivery estimate and order total before checkout." />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <Navigation borderless />

      <div className="pt-[var(--header-h)] pb-24 max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="flex items-baseline justify-between border-b border-border pb-6 pt-8">
          <h1 className="font-display font-normal text-[1.6rem] md:text-[2.25rem] tracking-[-0.01em]">Your Cart</h1>
          <Link
            to={continueHref}
            state={{ smoothScroll: false }}
            className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Continue Selection
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-body text-sm text-muted-foreground">Your cart is empty.</p>
            <Link
              to={hasTradeAccess ? "/trade/designers" : "/designers"}
              state={{ smoothScroll: false }}
              className="mt-6 inline-flex items-center justify-center px-6 py-3 bg-foreground text-background font-body text-[10px] uppercase tracking-[0.22em]"
            >
              Explore Our Designers
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-12 lg:gap-16 pt-12">
            {/* ── Left column · item cards ──────────────────────────── */}
            <div>
              <ul className="space-y-5">
                {items.map((item) => (
                  <li
                    key={item.key}
                    className="border border-border/70 bg-card px-6 py-7 sm:px-8 grid grid-cols-1 gap-6 sm:grid-cols-[140px_minmax(0,1fr)_auto_140px] sm:gap-8 sm:items-center"
                  >
                    {/* Col 1 — image */}
                    <div className="bg-cream">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-36 object-contain"
                        />
                      ) : (
                        <div className="h-36" />
                      )}
                    </div>

                    {/* Col 2 — details */}
                    <div className="min-w-0">
                      <p className="font-body font-light text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                        {item.designerName}
                      </p>
                      <h2 className="font-display text-lg mt-2">
                        <Link
                          to={`/designers/${item.designerSlug}/${item.productSlug}`}
                          className="hover:text-[hsl(var(--gold))] transition-colors"
                        >
                          {item.title}
                        </Link>
                      </h2>
                      {item.finishLabel && (
                        <>
                          {(() => {
                            const parts = item.finishLabel.split(" / ").map((s) => s.trim()).filter(Boolean);
                            const finishParts = parts.filter((p) => !looksLikeDimension(p));
                            const dimParts = parts.filter((p) => looksLikeDimension(p));
                            return (
                              <>
                                {finishParts.length > 0 && (
                                  <p className="font-body text-sm text-muted-foreground mt-2 leading-relaxed">
                                    {finishParts.join(" / ")}
                                  </p>
                                )}
                                {dimParts.length > 0 && (
                                  <p className="font-body text-xs text-zinc-500 mt-1 leading-relaxed">
                                    {dimParts.join(" / ")}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </>
                      )}
                      {item.leadTime && (
                        <p className="mt-4 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Production lead time: {item.leadTime}
                        </p>
                      )}
                    </div>

                    {/* Col 3 — quantity + actions */}
                    <div className="flex flex-row sm:flex-col items-center sm:items-stretch gap-4">
                      <div className="inline-flex items-center justify-center border border-border">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => setQuantity(item.key, item.quantity - 1)}
                          className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center font-body text-sm tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => setQuantity(item.key, item.quantity + 1)}
                          className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-5 sm:justify-center">
                        <FavoriteFolderPicker pickId={item.pickId} align="start">
                          <button
                            type="button"
                            aria-label="Add to wishlist"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Heart className="h-3.5 w-3.5" />
                          </button>
                        </FavoriteFolderPicker>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.key)}
                          className="font-body text-[9px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Col 4 — price (always shown in the cart display currency) */}
                    <div className="text-left sm:text-right">
                      <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Total</p>
                      <p className="font-display text-lg tabular-nums mt-1 whitespace-nowrap">
                        {formatUsd(toDisplay(item.unitPriceCents * item.quantity, item.currency))}
                      </p>
                       {item.quantity > 1 && (
                         <p className="font-body text-[11px] text-muted-foreground mt-1 tabular-nums">
                           {formatUsd(toDisplay(item.unitPriceCents, item.currency))} each
                         </p>
                       )}
                       {(item.currency || "USD").toUpperCase() !== currency && (
                         <p className="font-body text-[10px] italic text-muted-foreground mt-1 tabular-nums">
                           Converted from {formatMoney(item.unitPriceCents * item.quantity, item.currency)}
                         </p>
                       )}
                    </div>

                  </li>
                ))}
              </ul>

              {/* Need Help? — concierge channels */}
              <section className="mt-10 border border-border/70 bg-cream px-6 py-10 sm:px-8">
                <h2 className="font-display text-xl">Need Help?</h2>
                <p className="mt-3 font-body text-sm text-muted-foreground max-w-md leading-relaxed">
                  A private advisor can assist with configuration, lead times, delivery planning and
                  payment arrangements before you confirm your order.
                </p>
                <dl className="mt-8 grid gap-6 sm:grid-cols-3 font-body text-sm">
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Concierge</dt>
                    <dd className="mt-2">
                      <a href="mailto:concierge@maisonaffluency.com" className="hover:text-[hsl(var(--gold))] transition-colors">
                        concierge@maisonaffluency.com
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Trade Program</dt>
                    <dd className="mt-2">
                      <a href="mailto:trade@maisonaffluency.com" className="hover:text-[hsl(var(--gold))] transition-colors">
                        trade@maisonaffluency.com
                      </a>
                    </dd>
                    <dd className="mt-1">
                      <Link to="/trade" className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors">
                        Discover the Trade Program
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Direct Line</dt>
                    <dd className="mt-2">
                      <span className="text-muted-foreground">
                        Chat with an Advisor on WhatsApp
                      </span>
                    </dd>
                    <dd className="mt-1 text-muted-foreground space-y-0.5">
                      <a
                        href="https://wa.me/6591393850"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:text-[hsl(var(--gold))] transition-colors"
                      >
                        • Singapore: +65 9139 3850
                      </a>
                      <a
                        href="https://wa.me/33616237460"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:text-[hsl(var(--gold))] transition-colors"
                      >
                        • Paris &amp; EU: +33 6 1623 7460
                      </a>
                    </dd>
                    <dd className="mt-2">
                      <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                        Request a call back
                      </Link>
                    </dd>
                    <dd className="mt-1">
                      <a href="mailto:hello@maisonaffluency.com" className="text-muted-foreground hover:text-foreground transition-colors">
                        hello@maisonaffluency.com
                      </a>
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            {/* ── Right column · order summary card ──────────────────── */}
            <aside className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] h-fit">
              <div className="border border-border/70 px-7 py-8">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-xl">Order Summary</h2>
                  <AccountPricingBadge />
                </div>

                <dl className="mt-7 space-y-4 font-body text-sm">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="tabular-nums">{formatUsd(subtotal)}</dd>
                  </div>
                  {discount.eligible && (
                    <div className="flex items-baseline justify-between gap-6">
                      <dt className="text-muted-foreground">{discount.label}</dt>
                      <dd className="tabular-nums text-foreground">
                        −{formatUsd(discount.amountFor(subtotal))}
                      </dd>
                    </div>
                  )}
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="min-w-0 text-muted-foreground">
                        <span className="block">Front Door Premium Delivery</span>
                        {freightEstimate.cents > 0 && freightEstimate.zoneLabel && (
                          <span className="mt-1.5 inline-block border border-border/70 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                            {freightEstimate.zoneLabel}
                          </span>
                        )}
                      </dt>
                      {freightEstimate.cents > 0 ? (
                        <dd className="shrink-0 tabular-nums whitespace-nowrap">
                          {formatUsd(freightEstimate.cents)}
                        </dd>
                      ) : (
                        <dd className="shrink-0 text-right text-muted-foreground whitespace-nowrap">
                          To be Quoted by Advisor
                        </dd>
                      )}
                    </div>
                    {freightEstimate.capped && freightEstimate.notice && (
                      <p className="mt-1.5 font-light text-[10px] tracking-[0.06em] text-foreground">
                        {freightEstimate.notice}
                      </p>
                    )}
                    {showEuropeanLogisticsNotice && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500 italic">
                        Note: For European fulfillments, this shipping fee serves as an initial transit deposit. Our Paris logistics team manually reviews every order within 24 hours to secure the optimal white-glove courier route and transit pricing for your specific pieces.
                      </p>
                    )}
                  </div>


                  <div className="border-t border-border pt-4">
                    <div className="flex items-baseline justify-between gap-6">
                      <dt className="font-medium uppercase text-[11px] tracking-[0.2em]">
                        Estimated Total ({currency})
                      </dt>
                      <dd className="tabular-nums font-medium text-base whitespace-nowrap">{formatUsd(estimatedTotal)}</dd>
                    </div>
                    {sgdEquivalent !== null && (
                      <p className="mt-1.5 font-body text-xs text-muted-foreground tabular-nums">
                        (Approx. SGD ${sgdEquivalent.toLocaleString("en-US")})
                      </p>
                    )}

                    {/* All fine print consolidated into one quiet disclosure. */}
                    <details className="group mt-3 border-t border-border/60 pt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors">
                        View Shipping &amp; Import Tax Details
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-90" />
                      </summary>
                      <div className="mt-3 space-y-2 font-body text-[10px] leading-relaxed text-muted-foreground">
                        {freightEstimate.cents > 0 && <p className="italic">{ESTIMATED_SHIPPING_NOTE}</p>}
                        <ShippingCountryIndicator />
                        <p>
                          Final settlement will be in {currency}. Local import duties and GST are not
                          included — they will be assessed separately upon customs entry
                          {destination.iso === "SG" ? " to Singapore" : " at destination"}.
                        </p>
                        {freightEstimate.cents > 0 && (
                          <p>
                            Payable now · {formatUsd(total)}. Estimated freight ·{" "}
                            {formatUsd(freightEstimate.cents)} — invoiced separately once confirmed by
                            your advisor.
                          </p>
                        )}
                      </div>
                    </details>
                  </div>


                </dl>


                <div className="mt-7 space-y-3">
                  <Button
                    onClick={() => goToIdentity("card")}
                    disabled={pending !== null}
                    className="w-full rounded-none h-12 bg-foreground text-background hover:bg-foreground/90 font-body text-[11px] uppercase tracking-[0.22em]"
                  >
                    {pending === "card" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Proceed to Checkout"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => goToIdentity("bank_transfer")}
                    disabled={pending !== null}
                    className="w-full rounded-none h-12 border-foreground text-foreground hover:bg-muted/60 font-body text-[11px] uppercase tracking-[0.22em]"
                  >
                    {pending === "bank_transfer" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Pay via Bank Wire Transfer"
                    )}
                  </Button>
                  <p className="pt-1 text-center font-body text-[10px] tracking-widest text-zinc-400">
                    Preferred for Trade &amp; Corporate Accounts
                  </p>

                </div>

                {/* Payment methods — monochrome marks, borderless */}
                <div className="mt-8 flex items-center justify-center gap-12 border-t border-border/60 pt-6 text-foreground/80">
                  <VisaMark />
                  <MastercardMark />
                  <BankTransferMark />
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
