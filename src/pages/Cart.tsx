import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Minus, Plus, Loader2, Heart } from "lucide-react";
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
import { useShippingDestination } from "@/lib/shippingDestination";


import {
  useCart,
  setQuantity,
  removeFromCart,
  clearCart,
  cartSubtotalCents,
  formatMoney,
} from "@/lib/cart";

export default function Cart() {
  const items = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [pending, setPending] = useState<null | "card" | "bank_transfer">(null);

  // Landing here always means every overlay is gone — never inherit a stray
  // scroll lock from a drawer that was open when we navigated.
  useEffect(() => {
    releaseBodyScroll();
  }, []);

  useEffect(() => {

    if (params.get("status") === "cancelled") {
      toast("Checkout cancelled — your cart is still here.");
    }
  }, [params]);

  const currency = items[0]?.currency || "USD";
  const subtotal = useMemo(() => cartSubtotalCents(items), [items]);
  // Account-level tier discount (admin / verified trade), resolved from the
  // backend and re-applied server-side before payment.
  const discount = useAccountDiscount();
  // Delivery is quoted by the advisor post-purchase, so the displayed total
  // is the goods subtotal less any tier discount (no invented shipping figure).
  const destination = useShippingDestination();
  const freightEstimate = useEstimatedShipping(items, destination.iso);
  const total = discount.totalFor(subtotal) + freightEstimate.cents;


  // "Continue Selection" returns to the curator's picks of the designer whose
  // piece was added last, rather than the generic designers landing page.
  const continueHref = items.length
    ? `/designers/${items[items.length - 1].designerSlug}`
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
              to="/designers"
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
                        <p className="font-body text-sm text-muted-foreground mt-2 leading-relaxed">
                          {item.finishLabel}
                        </p>
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

                    {/* Col 4 — price */}
                    <div className="text-left sm:text-right">
                      <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Total</p>
                      <p className="font-display text-lg tabular-nums mt-1">
                        {formatMoney(item.unitPriceCents * item.quantity, item.currency)}
                      </p>
                      {item.quantity > 1 && (
                        <p className="font-body text-[11px] text-muted-foreground mt-1 tabular-nums">
                          {formatMoney(item.unitPriceCents, item.currency)} each
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
                      <Link to="/contact" className="hover:text-[hsl(var(--gold))] transition-colors">
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
                    <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
                  </div>
                  {discount.eligible && (
                    <div className="flex items-baseline justify-between gap-6">
                      <dt className="text-muted-foreground">{discount.label}</dt>
                      <dd className="tabular-nums text-foreground">
                        −{formatMoney(discount.amountFor(subtotal), currency)}
                      </dd>
                    </div>
                  )}
                  <div>
                    <div className="flex items-baseline justify-between gap-6">
                      <dt className="text-muted-foreground">Front Door Premium Delivery</dt>
                      {freightEstimate.cents > 0 ? (
                        <dd className="tabular-nums">{formatMoney(freightEstimate.cents, currency)}</dd>
                      ) : (
                        <dd className="text-right text-muted-foreground">To be Quoted by Advisor</dd>
                      )}
                    </div>
                    {freightEstimate.cents > 0 && (
                      <p className="mt-1.5 font-light text-[10px] tracking-[0.06em] text-muted-foreground">
                        {ESTIMATED_SHIPPING_NOTE}
                      </p>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between border-t border-border pt-4">
                    <dt className="font-medium uppercase text-[11px] tracking-[0.2em]">Order Total</dt>
                    <dd className="tabular-nums font-medium text-base">{formatMoney(total, currency)}</dd>
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
                  <p className="text-center font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
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
