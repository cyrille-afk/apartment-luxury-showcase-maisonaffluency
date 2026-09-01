import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Elements, PaymentElement, AddressElement, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { ChevronDown, Lock, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { cloudinaryUrl } from "@/lib/cloudinary";

const logoIcon = cloudinaryUrl("affluency-logo-icon_mpchum", { width: 200, quality: "auto", crop: "fill" });
const CONCIERGE_WHATSAPP = "https://wa.me/6591393850";
const CHECKOUT_KEY = "ma_checkout_line";
const WIRE_DISCOUNT = 0.015;

export type CheckoutLine = {
  title: string;
  designer?: string | null;
  finishLabel?: string | null;
  imageUrl?: string | null;
  unitCents: number;
  currency: string;
  leadTime?: string | null;
  productPath?: string | null;
  quantity?: number;
};

const lineQty = (line: CheckoutLine) => Math.max(1, line.quantity ?? 1);
const lineSubtotal = (line: CheckoutLine) => line.unitCents * lineQty(line);

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100);

/* ------------------------------------------------------------------ */
/* Order summary                                                       */
/* ------------------------------------------------------------------ */
function OrderSummaryDrawer({ line }: { line: CheckoutLine }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-y border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Order summary
        </span>
        <span className="flex items-center gap-2 text-sm">
          {money(lineSubtotal(line), line.currency)}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="flex gap-4 px-5 pb-5">
          {line.imageUrl && (
            <img
              src={line.imageUrl}
              alt={line.title}
              className="h-20 w-20 flex-none object-cover"
              loading="lazy"
            />
          )}
          <div className="min-w-0 text-sm">
            {line.designer && (
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {line.designer}
              </p>
            )}
            <p className="truncate font-light">{line.title}</p>
            {line.finishLabel && (
              <p className="mt-1 text-xs text-muted-foreground">{line.finishLabel}</p>
            )}
            {lineQty(line) > 1 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Qty {lineQty(line)} · {money(line.unitCents, line.currency)} each
              </p>
            )}
            {line.leadTime && (
              <p className="mt-1 text-xs text-muted-foreground">Lead time · {line.leadTime}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card / express payment form                                         */
/* ------------------------------------------------------------------ */
function PaymentForm({
  line,
  email,
  setEmail,
  onPaid,
}: {
  line: CheckoutLine;
  email: string;
  setEmail: (v: string) => void;
  onPaid: (ref: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) throw new Error(submitError.message);
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: `${window.location.origin}/checkout` },
      });
      if (error) throw new Error(error.message);
      if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
        onPaid(paymentIntent.id);
        return;
      }
      throw new Error("Payment could not be completed.");
    } catch (err: any) {
      toast.error(err?.message || "Payment could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* 2 — Express tier */}
      <section className="px-5 pt-6">
        <ExpressCheckoutElement
          options={{ buttonHeight: 48, layout: { maxColumns: 1, maxRows: 3 } }}
          onConfirm={async () => {
            if (!stripe || !elements) return;
            const { error: submitError } = await elements.submit();
            if (submitError) {
              toast.error(submitError.message || "Payment could not be completed.");
              return;
            }
            const { error, paymentIntent } = await stripe.confirmPayment({
              elements,
              redirect: "if_required",
              confirmParams: { return_url: `${window.location.origin}/checkout` },
            });
            if (error) {
              toast.error(error.message || "Payment could not be completed.");
              return;
            }
            if (paymentIntent) onPaid(paymentIntent.id);
          }}
        />
        <div className="my-6 flex items-center gap-4">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Or continue with secure checkout
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
      </section>

      {/* 3 — Contact & white-glove delivery */}
      <section className="space-y-4 px-5">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Contact & delivery
        </h2>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="h-12 w-full rounded-none border border-border bg-background px-4 text-base outline-none focus:border-foreground"
        />
        <AddressElement
          options={{
            mode: "shipping",
            display: { name: "full" },
            fields: { phone: "always" },
            autocomplete: { mode: "automatic" },
          }}
        />
        <div className="flex items-start gap-3 border border-foreground/70 bg-muted/40 p-4">
          <Check className="mt-0.5 h-4 w-4 flex-none" />
          <div>
            <p className="text-sm">Complimentary fully-insured white-glove delivery & installation</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Included on every acquisition. Our concierge schedules placement with your team.
            </p>
          </div>
        </div>
      </section>

      {/* 4 — Payment */}
      <section className="space-y-4 px-5 pt-8">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Payment</h2>
        <PaymentElement options={{ layout: "tabs" }} />
      </section>

      {/* 5 — Sticky summary & CTA */}
      <StickyTotals
        line={line}
        total={lineSubtotal(line)}
        cta={`Confirm & securely pay ${money(lineSubtotal(line), line.currency)}`}
        busy={submitting}
        onSubmit={confirm}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sticky bottom summary                                               */
/* ------------------------------------------------------------------ */
function StickyTotals({
  line,
  total,
  cta,
  busy,
  onSubmit,
  savings,
}: {
  line: CheckoutLine;
  total: number;
  cta: string;
  busy: boolean;
  onSubmit: () => void;
  savings?: number;
}) {
  return (
    <div className="sticky bottom-0 z-30 mt-8 border-t border-border bg-background/95 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur">
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <dt>Subtotal{lineQty(line) > 1 ? ` (${lineQty(line)} × ${money(line.unitCents, line.currency)})` : ""}</dt>
          <dd>{money(lineSubtotal(line), line.currency)}</dd>
        </div>
        {savings ? (
          <div className="flex justify-between text-muted-foreground">
            <dt>Concierge discount (1.5%)</dt>
            <dd>−{money(savings, line.currency)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between text-muted-foreground">
          <dt>White-glove delivery</dt>
          <dd>Complimentary</dd>
        </div>
        <div className="flex justify-between pt-1 text-base">
          <dt>Total</dt>
          <dd>{money(total, line.currency)}</dd>
        </div>
      </dl>
      <button
        type="button"
        disabled={busy}
        onClick={onSubmit}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-none bg-[#1A1A1A] text-[12px] uppercase tracking-[0.2em] text-white disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {cta}
      </button>
      <a
        href={CONCIERGE_WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block text-center text-xs text-muted-foreground underline underline-offset-4"
      >
        Need assistance with card limits? Text a private concierge advisor instantly
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wire transfer form                                                  */
/* ------------------------------------------------------------------ */
function WireForm({ line, email, setEmail, onDone }: {
  line: CheckoutLine;
  email: string;
  setEmail: (v: string) => void;
  onDone: (ref: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const savings = Math.round(lineSubtotal(line) * WIRE_DISCOUNT);
  const total = lineSubtotal(line) - savings;

  const submit = async () => {
    if (!name.trim() || !email.includes("@")) {
      toast.error("Please add your name and email.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-wire-transfer", {
        body: {
          title: line.title,
          designer: line.designer || "",
          selectedFinish: line.finishLabel || "",
          currency: line.currency,
          quantity: lineQty(line),
          amountCents: total,
          name,
          email,
          phone,
          address,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      onDone((data as any)?.reference || "");
    } catch (err: any) {
      toast.error(err?.message || "Unable to submit your request.");
    } finally {
      setBusy(false);
    }
  };

  const field = "h-12 w-full rounded-none border border-border bg-background px-4 text-base outline-none focus:border-foreground";

  return (
    <>
      <section className="space-y-4 px-5 pt-6">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Bank wire — contact & delivery
        </h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" className={field} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" inputMode="email" autoComplete="email" className={field} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel" inputMode="tel" autoComplete="tel" className={field} />
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address" rows={3} className="w-full rounded-none border border-border bg-background p-4 text-base outline-none focus:border-foreground" />
        <p className="text-xs text-muted-foreground">
          Our concierge will send fully-insured wiring instructions within one business hour.
        </p>
      </section>
      <StickyTotals
        line={line}
        total={total}
        savings={savings}
        cta={`Request wire instructions · ${money(total, line.currency)}`}
        busy={busy}
        onSubmit={submit}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [line, setLine] = useState<CheckoutLine | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [wire, setWire] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialised = useRef(false);

  // Resolve the line item from router state, falling back to sessionStorage
  // so a refresh keeps the checkout alive.
  useEffect(() => {
    const fromState = (location.state as any)?.line as CheckoutLine | undefined;
    if (fromState?.unitCents) {
      sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(fromState));
      setLine(fromState);
      return;
    }
    try {
      const raw = sessionStorage.getItem(CHECKOUT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CheckoutLine;
        if (parsed?.unitCents) {
          setLine(parsed);
          return;
        }
      }
    } catch { /* ignore */ }
    // Direct visit / new tab: fall back to the saved selection so the page
    // mounts Stripe instead of silently bouncing to the homepage.
    const cart = getCart();
    if (cart.length) {
      const first = cart[0];
      const fallback: CheckoutLine = {
        title: first.title,
        designer: first.designerName,
        finishLabel: first.finishLabel,
        imageUrl: first.imageUrl,
        unitCents: first.unitPriceCents,
        currency: first.currency,
        leadTime: first.leadTime,
        productPath: first.designerSlug && first.productSlug
          ? `/designers/${first.designerSlug}/${first.productSlug}`
          : null,
        quantity: first.quantity,
      };
      sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(fallback));
      setLine(fallback);
      return;
    }
    navigate("/", { replace: true });
  }, [location.state, navigate]);


  useEffect(() => {
    if (!line || initialised.current) return;
    initialised.current = true;
    (async () => {
      try {
        const [{ data: cfg, error: cfgErr }, { data: pi, error: piErr }] = await Promise.all([
          supabase.functions.invoke("stripe-config"),
          supabase.functions.invoke("create-payment-intent", {
            body: {
              title: line.title,
              designer: line.designer || "",
              price: line.unitCents / 100,
              currency: line.currency,
              selectedFinish: line.finishLabel || "",
              quantity: lineQty(line),
            },
          }),
        ]);
        if (cfgErr || (cfg as any)?.error) throw new Error((cfg as any)?.error || "Stripe is not configured.");
        if (piErr || (pi as any)?.error) throw new Error((pi as any)?.error || "Unable to start checkout.");
        setStripePromise(loadStripe((cfg as any).publishableKey));
        setClientSecret((pi as any).clientSecret);
      } catch (err: any) {
        setError(err?.message || "Unable to start checkout.");
      }
    })();
  }, [line]);

  const appearance = useMemo(
    () => ({
      theme: "stripe" as const,
      variables: {
        colorPrimary: "#1A1A1A",
        colorText: "#14201c",
        borderRadius: "0px",
        fontFamily: "inherit",
        spacingUnit: "4px",
      },
    }),
    [],
  );

  if (!line) return null;

  if (confirmed) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <Check className="h-8 w-8" />
        <h1 className="mt-6 text-2xl font-light">Thank you</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {wire
            ? "Your wire instructions are on their way. Reference "
            : "Your acquisition is confirmed. Reference "}
          <span className="text-foreground">{confirmed}</span>.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          A private advisor will contact you shortly to arrange white-glove delivery.
        </p>
        <button
          onClick={() => navigate(line.productPath || "/")}
          className="mt-8 h-12 w-full max-w-xs rounded-none border border-foreground text-[11px] uppercase tracking-[0.2em]"
        >
          Continue browsing
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-xl bg-background pb-4">
      {/* 1 — Minimalist header */}
      <header className="flex flex-col items-center gap-2 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
        <button onClick={() => navigate(line.productPath || "/")} aria-label="Maison Affluency">
          <img src={logoIcon} alt="Maison Affluency" className="h-8 w-auto" />
        </button>
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <Lock className="h-3 w-3" /> 256-bit encrypted secure checkout
        </span>
      </header>

      <OrderSummaryDrawer line={line} />

      {/* Payment method switch */}
      <div className="px-5 pt-5">
        <button
          type="button"
          onClick={() => setWire((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between border px-4 py-3 text-left text-sm",
            wire ? "border-foreground bg-muted/40" : "border-border",
          )}
        >
          <span>
            Bank wire transfer
            <span className="ml-2 text-xs text-muted-foreground">Save 1.5% concierge discount</span>
          </span>
          <span
            className={cn(
              "h-5 w-9 flex-none rounded-full border transition-colors",
              wire ? "border-foreground bg-foreground" : "border-border bg-muted",
            )}
          >
            <span
              className={cn(
                "block h-4 w-4 translate-y-[1px] rounded-full bg-background transition-transform",
                wire ? "translate-x-[18px]" : "translate-x-[2px]",
              )}
            />
          </span>
        </button>
      </div>

      {wire ? (
        <WireForm line={line} email={email} setEmail={setEmail} onDone={setConfirmed} />
      ) : error ? (
        <div className="px-5 py-16 text-center text-sm text-muted-foreground">{error}</div>
      ) : stripePromise && clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
          <PaymentForm line={line} email={email} setEmail={setEmail} onPaid={setConfirmed} />
        </Elements>
      ) : (
        <div className="flex justify-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </main>
  );
}
