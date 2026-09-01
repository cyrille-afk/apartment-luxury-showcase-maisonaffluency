import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { releaseBodyScroll } from "@/lib/bodyScrollLock";
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
  const { user } = useAuth();

  const method: Method = params.get("method") === "bank_transfer" ? "bank_transfer" : "card";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    releaseBodyScroll();
  }, []);

  useEffect(() => {
    if (!items.length) navigate("/cart", { replace: true });
  }, [items.length, navigate]);

  const currency = items[0]?.currency || "USD";
  const subtotal = useMemo(() => cartSubtotalCents(items), [items]);

  const startCheckout = async (contactEmail?: string, fullName?: string) => {
    if (!items.length) return;
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
            imageUrl: i.imageUrl,
            leadTime: i.leadTime,
            quantity: i.quantity,
          })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (method === "card" && (data as any)?.url) {
        window.location.href = (data as any).url;
        return;
      }
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
      await startCheckout(email);
    } catch (err: any) {
      toast.error(err?.message || "We couldn't sign you in.");
    } finally {
      setSigningIn(false);
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
            className="inline-flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
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
                      onChange={(e) => setEmail(e.target.value)}
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
                        onChange={(e) => setGuestEmail(e.target.value)}
                        className="rounded-none bg-background"
                      />
                      <Input
                        autoComplete="name"
                        placeholder="Full name (optional)"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
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
              <h2 className="font-display text-xl">Order Summary</h2>

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
                <div className="flex items-baseline justify-between gap-6">
                  <dt className="text-muted-foreground">Front Door Premium Delivery</dt>
                  <dd className="text-right text-muted-foreground">To be Quoted by Advisor</dd>
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
