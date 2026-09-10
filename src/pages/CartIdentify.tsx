import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { useAccountDiscount } from "@/hooks/useAccountDiscount";
import { AccountPricingBadge } from "@/components/product/AccountPricingBadge";
import { releaseBodyScroll } from "@/lib/bodyScrollLock";
import { useEstimatedShipping, ESTIMATED_SHIPPING_NOTE } from "@/hooks/useShippingCountry";
import { useShippingDestination } from "@/lib/shippingDestination";
import { useCheckoutForm } from "@/contexts/CheckoutFormContext";

import {
  useCart,
  clearCart,
  cartSubtotalCents,
  formatMoney,
  type CartItem,
} from "@/lib/cart";

type Method = "card" | "bank_transfer";

/**
 * Step 2 of the checkout sequence — the identity gateway.
 *
 * The cart page never collects contact details any more; it hands off here,
 * where the collector either signs in, creates an account, or continues as a
 * guest. The order summary persists on the right in a condensed form.
 */
export default function CartIdentify() {
  const items = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, refreshRoles, profile, tradeStatus, isTradeUser } = useAuth();
  // Approved trade profiles carry their corporate identity into checkout.
  const tradeApproved = tradeStatus === "approved" || isTradeUser;
  const tradeCompany = tradeApproved ? profile?.company?.trim() || "" : "";

  const method: Method = params.get("method") === "bank_transfer" ? "bank_transfer" : "card";

  // Global checkout form state — the email typed here pre-fills every later
  // stage (contact, shipping, billing, review) and the final payload.
  const checkoutForm = useCheckoutForm();
  const [email, setEmail] = useState(checkoutForm.email);
  const [password, setPassword] = useState("");
  const [guestEmail, setGuestEmail] = useState(checkoutForm.email);
  const [guestName, setGuestName] = useState(checkoutForm.guestName);
  const [signingIn, setSigningIn] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    releaseBodyScroll();
  }, []);

  useEffect(() => {
    if (!items.length) navigate("/cart", { replace: true });
  }, [items.length, navigate]);

  const currency = items[0]?.currency || "USD";
  const subtotal = useMemo(() => cartSubtotalCents(items), [items]);
  // Tier discount for the authenticated account (admin / verified trade).
  const discount = useAccountDiscount();
  const shipDest = useShippingDestination();
  const freightEstimate = useEstimatedShipping(items, shipDest.iso);
  const orderTotal = discount.totalFor(subtotal) + freightEstimate.cents;


  const startCheckout = async (contactEmail?: string, fullName?: string) => {
    if (!items.length) return;
    // Card payments use the branded in-page checkout (/checkout) so the
    // collector never leaves Maison Affluency's design system. Bank transfer
    // still creates the order + wire instructions via the edge function.
    if (method === "card") {
      navigate("/checkout", {
        state: {
          lines: items.map((i: CartItem) => ({
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
    setPending(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-cart-checkout", {
        body: {
          method,
          email: contactEmail || undefined,
          fullName: fullName || undefined,
          items: items.map((i: CartItem) => ({
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
      setPending(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    setSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Do NOT jump straight to Stripe: roles and tier are re-read first so the
      // summary can show the account's discount before payment.
      await refreshRoles?.();
      toast.success("Signed in — your account pricing has been applied.");
    } catch (err: any) {
      toast.error(err?.message || "We couldn't sign you in.");
    } finally {
      setSigningIn(false);
    }

  };

  /**
   * Trade profile sign-in. On return the session is restored, roles are
   * re-read, and the signed-in branch takes over: the guest form disappears
   * and the approved tier discount is applied to the summary.
   */
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.redirected) return; // browser is navigating to Google
      if (result.error) {
        toast.error(result.error.message || "We couldn't sign you in with Google.");
        return;
      }
      await refreshRoles?.();
      toast.success("Signed in — trade pricing will apply if your account is approved.");
    } catch (err: any) {
      toast.error(err?.message || "We couldn't sign you in with Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(guestEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    await startCheckout(guestEmail, guestName || undefined);
  };

  const busy = pending || signingIn;
  const ctaLabel = method === "bank_transfer" ? "Continue to Wire Instructions" : "Continue to Payment";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Checkout — Sign In or Continue as Guest</title>
        <meta
          name="description"
          content="Sign in, create an account, or continue as a guest to complete your Maison Affluency order."
        />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <Navigation borderless />

      <div className="pt-[var(--header-h)] pb-24 max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="pt-8">
          <Link
            to="/cart"
            className="-my-2 inline-flex min-h-[44px] min-w-[44px] items-center gap-2 py-2 pr-3 font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3 shrink-0" />
            Back to cart
          </Link>
        </div>

        <div className="flex items-baseline justify-between border-b border-border pb-6 pt-5">
          <h1 className="font-display font-normal text-[1.6rem] md:text-[2.25rem] tracking-[-0.01em]">
            Sign In or Guest Checkout
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-12 lg:gap-16 pt-12">
          {/* ── Left column · identity gateway ─────────────────────── */}
          <div className="space-y-6">
            {user ? (
              <section className="border border-border/70 bg-card px-6 py-8 sm:px-8">
                <h2 className="font-body text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Signed In
                </h2>
                <p className="mt-4 font-body text-sm">
                  Continuing as <span className="text-foreground">{user.email}</span>
                </p>
                {tradeCompany && (
                  <p className="mt-2 font-body text-sm text-muted-foreground">
                    {tradeCompany}
                  </p>
                )}
                {discount.eligible && (
                  <p className="mt-2 font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {discount.label} applied to this order
                  </p>
                )}
                <Button
                  onClick={() => startCheckout(user.email || undefined)}
                  disabled={busy}
                  className="mt-6 w-full rounded-none h-12 bg-foreground text-background hover:bg-foreground/90 font-body text-[11px] uppercase tracking-[0.22em]"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : ctaLabel}
                </Button>
              </section>
            ) : (
              <>
                {/* Sign in */}
                <section className="border border-border/70 bg-card px-6 py-8 sm:px-8">
                  <h2 className="font-body text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Sign In
                  </h2>
                  <form onSubmit={handleSignIn} className="mt-5 space-y-4">
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        checkoutForm.setEmail(e.target.value);
                      }}
                      className="rounded-none"
                    />
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="rounded-none"
                    />
                    <Button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-none h-12 bg-foreground text-background hover:bg-foreground/90 font-body text-[11px] uppercase tracking-[0.22em]"
                    >
                      {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In & Continue"}
                    </Button>
                    <div className="flex items-center justify-between pt-1">
                      <Link
                        to="/collector-signup"
                        className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Create an Account
                      </Link>
                      <Link
                        to="/reset-password"
                        className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Forgot Password
                      </Link>
                    </div>
                  </form>

                  {/* Trade profile · Google OAuth */}
                  <div className="mt-8 border-t border-border/70 pt-6">
                    <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      Or Continue with Trade Profile
                    </p>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={busy || googleLoading}
                      className="mt-4 flex w-full items-center justify-center gap-3 border border-border bg-background h-12 font-body text-[11px] uppercase tracking-[0.22em] text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      {googleLoading ? "Connecting…" : "Continue with Google"}
                    </button>
                    <p className="mt-3 font-body text-[11px] leading-relaxed text-muted-foreground">
                      Approved trade accounts skip the guest form — your tier discount and business
                      details are applied automatically.
                    </p>
                  </div>
                </section>

                {/* Guest checkout */}
                <section className="border border-border/70 bg-cream px-6 py-8 sm:px-8">
                  <h2 className="font-body text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Continue as Guest
                  </h2>
                  <p className="mt-3 font-body text-sm text-muted-foreground max-w-md leading-relaxed">
                    No account required. We use your email solely for the order confirmation and
                    delivery coordination.
                  </p>
                  <form onSubmit={handleGuest} className="mt-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="Email address"
                        value={guestEmail}
                        onChange={(e) => {
                          setGuestEmail(e.target.value);
                          checkoutForm.setEmail(e.target.value);
                        }}
                        className="rounded-none bg-background"
                      />
                      <Input
                        autoComplete="name"
                        placeholder="Full name (optional)"
                        value={guestName}
                        onChange={(e) => {
                          setGuestName(e.target.value);
                          checkoutForm.setGuestName(e.target.value);
                        }}
                        className="rounded-none bg-background"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={busy}
                      className="w-full rounded-none h-12 border-foreground text-foreground hover:bg-muted/60 font-body text-[11px] uppercase tracking-[0.22em]"
                    >
                      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : ctaLabel}
                    </Button>
                  </form>
                </section>
              </>
            )}
          </div>

          {/* ── Right column · condensed order summary ─────────────── */}
          <aside className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] h-fit">
            <div className="border border-border/70 px-7 py-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl">Order Summary</h2>
                <AccountPricingBadge />
              </div>

              <ul className="mt-6 space-y-4">
                {items.map((item) => (
                  <li key={item.key} className="flex gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0">
                    <div className="w-16 shrink-0 bg-cream">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          loading="lazy"
                          className="w-16 h-16 object-contain"
                        />
                      ) : (
                        <div className="w-16 h-16" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body font-light text-[9px] uppercase tracking-[0.24em] text-muted-foreground">
                        {item.designerName}
                      </p>
                      <p className="font-display text-sm mt-1 truncate">{item.title}</p>
                      {item.finishLabel && (
                        <p className="font-body text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {item.finishLabel}
                        </p>
                      )}
                      <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
                        Qty {item.quantity}
                      </p>
                    </div>
                    <p className="font-body text-sm tabular-nums shrink-0">
                      {formatMoney(item.unitPriceCents * item.quantity, item.currency)}
                    </p>
                  </li>
                ))}
              </ul>

              <dl className="mt-7 space-y-4 font-body text-sm border-t border-border pt-6">
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
                    <p className="mt-1.5 font-light italic text-[10px] tracking-[0.06em] text-muted-foreground">
                      {ESTIMATED_SHIPPING_NOTE}
                    </p>
                  )}
                </div>
                <div className="flex items-baseline justify-between border-t border-border pt-4">
                  <dt className="font-medium uppercase text-[11px] tracking-[0.2em]">Order Total</dt>
                  <dd className="tabular-nums font-medium text-base">{formatMoney(orderTotal, currency)}</dd>
                </div>
              </dl>


              <p className="mt-6 text-center font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {method === "bank_transfer" ? "Bank Wire Transfer" : "Secure Card Payment"}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
