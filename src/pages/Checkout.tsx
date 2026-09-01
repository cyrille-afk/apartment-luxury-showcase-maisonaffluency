import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Elements, PaymentElement, AddressElement, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { ChevronDown, Lock, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { getCart } from "@/lib/cart";
import {
  assertCheckoutCopy,
  buildVerifiedTotals,
  lineQuantity,
  lineTotalCents,
  reconcileBackendAmount,
} from "@/lib/checkoutGuardrails";


const logoIcon = cloudinaryUrl("affluency-logo-icon_mpchum", { width: 200, quality: "auto", crop: "fill" });
const CONCIERGE_WHATSAPP = "https://wa.me/6591393850";
const CHECKOUT_KEY = "ma_checkout_line";


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

/* All amounts below are derived only from cart line items — see checkoutGuardrails. */
const lineQty = (line: CheckoutLine) => lineQuantity(line);
const lineSubtotal = (line: CheckoutLine) => lineTotalCents(line);
const orderSubtotal = (lines: CheckoutLine[]) => buildVerifiedTotals(lines).totalCents;
const orderCurrency = (lines: CheckoutLine[]) => lines[0]?.currency || "usd";

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100);

/* ------------------------------------------------------------------ */
/* Order summary — every line item, with the math shown in full        */
/* ------------------------------------------------------------------ */
function OrderSummaryDrawer({ lines }: { lines: CheckoutLine[] }) {
  const [open, setOpen] = useState(true);
  const currency = orderCurrency(lines);
  const subtotal = orderSubtotal(lines);
  const pieces = lines.reduce((n, l) => n + lineQty(l), 0);

  return (
    <div className="border-y border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Order summary · {lines.length} {lines.length === 1 ? "item" : "items"}
          {pieces !== lines.length ? ` · ${pieces} pieces` : ""}
        </span>
        <span className="flex items-center gap-2 text-sm">
          {money(subtotal, currency)}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          <ul className="divide-y divide-border/50">
            {lines.map((line, i) => (
              <li key={`${line.title}-${line.finishLabel || ""}-${i}`} className="flex gap-4 py-4 first:pt-0">
                {line.imageUrl && (
                  <img
                    src={line.imageUrl}
                    alt={line.title}
                    className="h-20 w-20 flex-none object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  {line.designer && (
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {line.designer}
                    </p>
                  )}
                  <p className="truncate font-light">{line.title}</p>
                  {line.finishLabel && (
                    <p className="mt-1 text-xs text-muted-foreground">{line.finishLabel}</p>
                  )}
                  {line.leadTime && (
                    <p className="mt-1 text-xs text-muted-foreground">Lead time · {line.leadTime}</p>
                  )}
                  {/* Explicit per-line math: unit × qty = line total */}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {money(line.unitCents, line.currency)} × {lineQty(line)} ={" "}
                    <span className="text-foreground">{money(lineSubtotal(line), line.currency)}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex justify-between border-t border-border/60 pt-3 text-sm">
            <span className="text-muted-foreground">
              Subtotal · sum of {lines.length} {lines.length === 1 ? "line" : "lines"}
            </span>
            <span>{money(subtotal, currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conditional charges — shown so nothing is a surprise later          */
/* Every string passes the guardrail in @/lib/checkoutGuardrails.          */
/* ------------------------------------------------------------------ */
const CONDITIONAL_NOTES: { label: string; body: string }[] = [
  {
    label: "Delivery, installation & insurance",
    body: "quoted separately by your advisor once the destination is confirmed. Not charged on this page.",
  },
  {
    label: "Duties, import taxes & VAT",
    body: "assessed by the destination country and billed at import. Not included above.",
  },
  {
    label: "Trade net pricing",
    body: "applies only to verified trade accounts, on the trade portal. Prices here are retail.",
  },
  {
    label: "Bank wire transfer",
    body: "applies only when you select it above; it changes the payment method, not the amount.",
  },
].map((n) => ({
  label: assertCheckoutCopy(n.label, "conditional note label"),
  body: assertCheckoutCopy(n.body, "conditional note body"),
}));

function ConditionalNotes() {
  return (
    <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
      {CONDITIONAL_NOTES.filter((n) => n.body).map((n) => (
        <li key={n.label}>
          <span className="text-foreground">{n.label}</span> — {n.body}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Card / express payment form                                         */
/* ------------------------------------------------------------------ */
function PaymentForm({
  lines,
  email,
  setEmail,
  onPaid,
}: {
  lines: CheckoutLine[];
  email: string;
  setEmail: (v: string) => void;
  onPaid: (ref: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const total = orderSubtotal(lines);
  const currency = orderCurrency(lines);

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

      {/* 3 — Contact & delivery */}
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
      </section>

      {/* 4 — Payment */}
      <section className="space-y-4 px-5 pt-8">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Secure card payment
            </h2>
            <p className="mt-1 text-xs text-foreground">Visa · Mastercard · American Express</p>
          </div>
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Powered by Stripe
          </span>
        </div>
        <div className="relative min-h-28">
          {!paymentReady && (
            <div className="absolute inset-0 flex items-center justify-center border border-border" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="sr-only">Loading secure card fields</span>
            </div>
          )}
          <div className={cn(!paymentReady && "invisible")}>
            <PaymentElement options={{ layout: "tabs" }} onReady={() => setPaymentReady(true)} />
          </div>
        </div>
      </section>

      {/* 5 — Sticky summary & CTA */}
      {paymentReady && (
        <StickyTotals
          lines={lines}
          total={total}
          cta={`Confirm & securely pay ${money(total, currency)}`}
          busy={submitting}
          onSubmit={confirm}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sticky bottom summary                                               */
/* ------------------------------------------------------------------ */
function StickyTotals({
  lines,
  total,
  cta,
  busy,
  onSubmit,
}: {
  lines: CheckoutLine[];
  total: number;
  cta: string;
  busy: boolean;
  onSubmit: () => void;
}) {
  const currency = orderCurrency(lines);
  return (
    <div className="sticky bottom-0 z-30 mt-8 border-t border-border bg-background/95 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur">
      <dl className="space-y-1 text-sm">
        {lines.map((line, i) => (
          <div key={`t-${i}`} className="flex justify-between gap-4 text-muted-foreground">
            <dt className="min-w-0 truncate">
              {line.title}
              <span className="text-muted-foreground/70">
                {" "}
                — {money(line.unitCents, line.currency)} × {lineQty(line)}
              </span>
            </dt>
            <dd className="flex-none">{money(lineSubtotal(line), line.currency)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-border/60 pt-2 text-base">
          <dt>Total{lines.length > 1 ? ` (${lines.length} items)` : ""}</dt>
          <dd>{money(total, currency)}</dd>
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
      <ConditionalNotes />
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
function WireForm({ lines, email, setEmail, onDone }: {
  lines: CheckoutLine[];
  email: string;
  setEmail: (v: string) => void;
  onDone: (ref: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const total = orderSubtotal(lines);
  const currency = orderCurrency(lines);

  const submit = async () => {
    if (!name.trim() || !email.includes("@")) {
      toast.error("Please add your name and email.");
      return;
    }
    setBusy(true);
    try {
      const first = lines[0];
      const { data, error } = await supabase.functions.invoke("request-wire-transfer", {
        body: {
          title: lines.length > 1
            ? `${first.title} + ${lines.length - 1} more`
            : first.title,
          designer: first.designer || "",
          selectedFinish: first.finishLabel || "",
          currency,
          quantity: lines.reduce((n, l) => n + lineQty(l), 0),
          amountCents: total,
          items: lines.map((l) => ({
            title: l.title,
            designer: l.designer || "",
            finish: l.finishLabel || "",
            unitCents: l.unitCents,
            quantity: lineQty(l),
            lineCents: lineSubtotal(l),
          })),
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
        lines={lines}
        total={total}
        cta={`Request wire instructions · ${money(total, currency)}`}
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
  const [lines, setLines] = useState<CheckoutLine[] | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [wire, setWire] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialised = useRef(false);

  // Resolve the order from router state, then sessionStorage, then the saved
  // cart — so Place Order, Go to Checkout and a direct URL all load the same
  // contents instead of bouncing to the homepage.
  useEffect(() => {
    const valid = (l: any): l is CheckoutLine => !!l && Number(l.unitCents) > 0;

    const fromState = (location.state as any)?.line as CheckoutLine | undefined;
    const fromStateMany = (location.state as any)?.lines as CheckoutLine[] | undefined;
    const stateLines = (fromStateMany?.filter(valid) ?? []).length
      ? fromStateMany!.filter(valid)
      : valid(fromState) ? [fromState!] : [];
    if (stateLines.length) {
      sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(stateLines));
      setLines(stateLines);
      return;
    }

    try {
      const raw = sessionStorage.getItem(CHECKOUT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const stored: CheckoutLine[] = Array.isArray(parsed)
          ? parsed.filter(valid)
          : valid(parsed) ? [parsed] : [];
        if (stored.length) {
          setLines(stored);
          return;
        }
      }
    } catch { /* ignore */ }

    // Direct visit / new tab: rebuild the FULL cart, not just the first line.
    const cart = getCart();
    if (cart.length) {
      const fallback: CheckoutLine[] = cart.map((item) => ({
        title: item.title,
        designer: item.designerName,
        finishLabel: item.finishLabel,
        imageUrl: item.imageUrl,
        unitCents: item.unitPriceCents,
        currency: item.currency,
        leadTime: item.leadTime,
        productPath: item.designerSlug && item.productSlug
          ? `/designers/${item.designerSlug}/${item.productSlug}`
          : null,
        quantity: item.quantity,
      })).filter(valid);
      if (fallback.length) {
        sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(fallback));
        setLines(fallback);
        return;
      }
    }
    navigate("/", { replace: true });
  }, [location.state, navigate]);


  useEffect(() => {
    if (!lines?.length || initialised.current) return;
    initialised.current = true;
    const first = lines[0];
    (async () => {
      try {
        const [{ data: cfg, error: cfgErr }, { data: pi, error: piErr }] = await Promise.all([
          supabase.functions.invoke("stripe-config"),
          supabase.functions.invoke("create-payment-intent", {
            body: {
              // Backward-compatible single-item fields (first line) …
              title: first.title,
              designer: first.designer || "",
              price: first.unitCents / 100,
              currency: orderCurrency(lines),
              selectedFinish: first.finishLabel || "",
              quantity: lineQty(first),
              // … plus the full order, which the function charges when present.
              items: lines.map((l) => ({
                title: l.title,
                designer: l.designer || "",
                selectedFinish: l.finishLabel || "",
                price: l.unitCents / 100,
                quantity: lineQty(l),
              })),
            },
          }),
        ]);
        if (cfgErr || (cfg as any)?.error) throw new Error((cfg as any)?.error || "Stripe is not configured.");
        if (piErr || (pi as any)?.error) throw new Error((pi as any)?.error || "Unable to start checkout.");

        // Guardrail: the amount Stripe will charge must equal the cart-derived total.
        const check = reconcileBackendAmount(
          buildVerifiedTotals(lines),
          (pi as any)?.amount,
          (pi as any)?.currency,
        );
        if (check.ok === false) throw new Error(check.reason);

        setStripePromise(loadStripe((cfg as any).publishableKey));
        setClientSecret((pi as any).clientSecret);
      } catch (err: any) {
        setError(err?.message || "Unable to start checkout.");
      }
    })();
  }, [lines]);

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

  if (!lines?.length) return null;
  const homePath = lines[0].productPath || "/";

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
          A private advisor will contact you shortly to arrange delivery.
        </p>
        <button
          onClick={() => navigate(homePath)}
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
        <button onClick={() => navigate(homePath)} aria-label="Maison Affluency">
          <img src={logoIcon} alt="Maison Affluency" className="h-8 w-auto" />
        </button>
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <Lock className="h-3 w-3" /> 256-bit encrypted secure checkout
        </span>
      </header>

      <OrderSummaryDrawer lines={lines} />

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
          <span>Bank wire transfer</span>

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
        <WireForm lines={lines} email={email} setEmail={setEmail} onDone={setConfirmed} />
      ) : error ? (
        <div className="px-5 py-16 text-center text-sm text-muted-foreground">{error}</div>
      ) : stripePromise && clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
          <PaymentForm lines={lines} email={email} setEmail={setEmail} onPaid={setConfirmed} />
        </Elements>
      ) : (
        <div className="flex justify-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </main>
  );
}
