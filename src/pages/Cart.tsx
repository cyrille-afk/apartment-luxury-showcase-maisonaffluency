import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Minus, Plus, Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useCart,
  setQuantity,
  removeFromCart,
  clearCart,
  cartSubtotalCents,
  cartShippingCents,
  formatMoney,
} from "@/lib/cart";

export default function Cart() {
  const items = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [pending, setPending] = useState<null | "card" | "bank_transfer">(null);

  useEffect(() => {
    if (params.get("status") === "cancelled") {
      toast("Checkout cancelled — your cart is still here.");
    }
  }, [params]);

  useEffect(() => {
    if (user?.email) setEmail((e) => e || user.email!);
  }, [user]);

  const currency = items[0]?.currency || "USD";
  const subtotal = useMemo(() => cartSubtotalCents(items), [items]);
  const shipping = cartShippingCents(subtotal);
  const total = subtotal + shipping;

  const checkout = async (method: "card" | "bank_transfer") => {
    if (!items.length) return;
    if (!user && !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setPending(method);
    try {
      const { data, error } = await supabase.functions.invoke("create-cart-checkout", {
        body: {
          method,
          email: email || undefined,
          fullName: fullName || undefined,
          items: items.map((i) => ({
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

      <div className="pt-[calc(env(safe-area-inset-top,0px)+7rem)] md:pt-36 pb-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-baseline justify-between border-b border-border pb-4">
          <h1 className="font-display font-normal text-[1.6rem] md:text-[2rem] tracking-[-0.01em]">Your Cart</h1>
          <Link
            to="/designers"
            className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Continue Shopping
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-body text-sm text-muted-foreground">Your cart is empty.</p>
            <Link
              to="/designers"
              className="mt-6 inline-flex items-center justify-center px-6 py-3 bg-foreground text-background font-body text-[10px] uppercase tracking-[0.22em]"
            >
              Browse the Collection
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.key} className="py-8">
                  {item.imageUrl && (
                    <div className="bg-muted/30 mb-6">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-auto max-h-[320px] object-contain mx-auto"
                      />
                    </div>
                  )}

                  <p className="font-body font-light text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                    {item.designerName}
                  </p>
                  <h2 className="font-display text-base md:text-lg mt-2">
                    <Link to={`/designers/${item.designerSlug}/${item.productSlug}`} className="hover:text-[hsl(var(--gold))] transition-colors">
                      {item.title}
                    </Link>
                  </h2>
                  {item.finishLabel && (
                    <p className="font-body text-sm text-muted-foreground mt-2">{item.finishLabel}</p>
                  )}

                  <div className="mt-5 inline-flex items-center border border-border">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity(item.key, item.quantity - 1)}
                      className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-5 font-body text-sm tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity(item.key, item.quantity + 1)}
                      className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <dl className="mt-6 space-y-2 font-body text-sm">
                    <div className="flex items-baseline justify-between">
                      <dt className="uppercase tracking-[0.16em] text-[11px] text-muted-foreground">Price</dt>
                      <dd className="tabular-nums">{formatMoney(item.unitPriceCents, item.currency)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <dt className="uppercase tracking-[0.16em] text-[11px] text-muted-foreground">Total</dt>
                      <dd className="tabular-nums">{formatMoney(item.unitPriceCents * item.quantity, item.currency)}</dd>
                    </div>
                  </dl>

                  {item.leadTime && (
                    <p className="mt-5 pt-4 border-t border-border/60 font-body text-sm">
                      Production lead time: {item.leadTime}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.key)}
                    className="mt-4 font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <section className="mt-10 border-t border-border pt-8">
              <h2 className="font-display text-lg">Order Summary</h2>

              <dl className="mt-6 space-y-3 font-body text-sm">
                <div className="flex items-baseline justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-6">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd className="tabular-nums text-right">Front Door Delivery: {formatMoney(shipping, currency)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <dt className="font-medium">Order Total</dt>
                  <dd className="tabular-nums font-medium">{formatMoney(total, currency)}</dd>
                </div>
              </dl>

              <p className="mt-3 font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
                Delivery is an estimate — duties and white-glove options confirmed by your concierge.
              </p>

              {!user && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-none"
                  />
                  <Input
                    placeholder="Full name (optional)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="rounded-none"
                  />
                </div>
              )}

              <div className="mt-6 space-y-4">
                <Button
                  onClick={() => checkout("card")}
                  disabled={pending !== null}
                  className="w-full rounded-none h-12 bg-foreground text-background hover:bg-foreground/90 font-body text-[11px] uppercase tracking-[0.22em]"
                >
                  {pending === "card" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Proceed to Checkout"}
                </Button>

                <p className="text-center font-body text-[11px] text-muted-foreground">- OR -</p>

                <Button
                  variant="outline"
                  onClick={() => checkout("bank_transfer")}
                  disabled={pending !== null}
                  className="w-full rounded-none h-12 border-foreground/40 font-body text-[11px] uppercase tracking-[0.22em]"
                >
                  {pending === "bank_transfer" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay by Bank Transfer"}
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
