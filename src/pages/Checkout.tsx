import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Elements, PaymentElement, AddressElement, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Lock, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { getCart } from "@/lib/cart";
import { useAccountDiscount } from "@/hooks/useAccountDiscount";
import { useAuth } from "@/hooks/useAuth";
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


export type ConfirmedShipping = { cents: number; label: string };

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
/* Order summary math — gross prices, one cart-level discount row      */
/* ------------------------------------------------------------------ */
export type CheckoutSummary = {
  currency: string;
  subtotalCents: number;
  discountCents: number;
  discountLabel: string | null;
  shippingCents: number;
  shippingLabel: string | null;
  totalCents: number;
};

/* Signed-in account confirmation — replaces blank email/name inputs.  */
function AccountBlock({ email, role }: { email: string; role: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-border bg-muted/30 px-4 py-3">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Account</span>
      <span className="truncate text-sm">
        {email} <span className="text-muted-foreground">({role})</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Order summary — persistent sidebar showing the true unit prices,    */
/* the subtotal, one explicit discount row, and the final total.       */
/* ------------------------------------------------------------------ */
function OrderSummary({ lines, summary }: { lines: CheckoutLine[]; summary: CheckoutSummary }) {
  const { currency } = summary;
  const pieces = lines.reduce((n, l) => n + lineQty(l), 0);

  return (
    <aside className="h-fit border border-border bg-background p-6 lg:sticky lg:top-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Order summary · {lines.length} {lines.length === 1 ? "item" : "items"}
        {pieces !== lines.length ? ` · ${pieces} pieces` : ""}
      </p>

      <ul className="mt-5 divide-y divide-border/50">
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
              {/* Standard catalogue unit price — never a discounted rate */}
              <p className="mt-2 text-xs text-muted-foreground">
                {money(line.unitCents, line.currency)} × {lineQty(line)}
              </p>
            </div>
            <div className="flex-none text-sm">{money(lineSubtotal(line), line.currency)}</div>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-2 border-t border-border/60 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{money(summary.subtotalCents, currency)}</dd>
        </div>
        {summary.discountCents > 0 && summary.discountLabel && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{summary.discountLabel}</dt>
            <dd>−{money(summary.discountCents, currency)}</dd>
          </div>
        )}
        {summary.shippingCents > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {summary.shippingLabel || "Delivery & installation"}
            </dt>
            <dd>{money(summary.shippingCents, currency)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border/60 pt-3 text-base">
          <dt>Order total</dt>
          <dd>{money(summary.totalCents, currency)}</dd>
        </div>
      </dl>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Conditional charges — shown so nothing is a surprise later          */
/* Every string passes the guardrail in @/lib/checkoutGuardrails.          */
/* ------------------------------------------------------------------ */
const CONDITIONAL_NOTES: { label: string; body: string }[] = [
  {
    label: "Delivery, installation & insurance",
    body: "quoted separately by your advisor once the destination is confirmed. Charged here only after you add the confirmed quote above.",
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
  summary,
  account,
  email,
  setEmail,
  onPaid,
}: {
  summary: CheckoutSummary;
  account: { email: string; role: string } | null;
  email: string;
  setEmail: (v: string) => void;
  onPaid: (ref: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  // Staged messaging so the wait for Stripe's iframe is legible, not a blank gap.
  const [loadStage, setLoadStage] = useState(0);
  useEffect(() => {
    if (paymentReady) return;
    const t = setTimeout(() => setLoadStage(1), 2500);
    return () => clearTimeout(t);
  }, [paymentReady]);
  const { totalCents: total, currency } = summary;

  const confirm = async () => {
    if (!paymentReady || !stripe || !elements) return;
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
      <section className="pt-2">
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
      <section className="space-y-4">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Contact & delivery
        </h2>
        {account ? (
          <AccountBlock email={account.email} role={account.role} />
        ) : (
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="h-12 w-full rounded-none border border-border bg-background px-4 text-base outline-none focus:border-foreground"
          />
        )}
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
      <section className="space-y-4 pt-8">
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
        <div className="relative min-h-32">
          {!paymentReady && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 border border-border bg-muted/30"
              role="status"
              aria-live="polite"
            >
              <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadStage === 0 ? "Opening secure Stripe session" : "Preparing card fields"}
              </span>
              <span className="h-px w-28 overflow-hidden bg-border">
                <span className="block h-full w-1/3 animate-pulse bg-foreground" />
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                Secure card form loading — this takes a few seconds
              </span>
            </div>
          )}
          <div className={cn(!paymentReady && "invisible")}>
            <PaymentElement
              options={{ layout: "tabs", paymentMethodOrder: ["card"] }}
              onReady={() => setPaymentReady(true)}
            />
          </div>
        </div>
      </section>

      {/* 5 — Sticky summary & CTA (disabled until card fields are mounted) */}
      <StickyTotals
        summary={summary}
        ready={paymentReady}
        cta={
          paymentReady
            ? `Confirm & securely pay ${money(total, currency)}`
            : "Preparing secure payment…"
        }
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
  summary,
  cta,
  busy,
  ready = true,
  onSubmit,
}: {
  summary: CheckoutSummary;
  cta: string;
  busy: boolean;
  ready?: boolean;
  onSubmit: () => void;
}) {
  const { currency } = summary;
  return (
    <div className="sticky bottom-0 z-30 mt-8 border-t border-border bg-background/95 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <dt>Subtotal</dt>
          <dd>{money(summary.subtotalCents, currency)}</dd>
        </div>
        {summary.discountCents > 0 && summary.discountLabel && (
          <div className="flex justify-between text-muted-foreground">
            <dt>{summary.discountLabel}</dt>
            <dd>−{money(summary.discountCents, currency)}</dd>
          </div>
        )}
        {summary.shippingCents > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <dt>{summary.shippingLabel || "Delivery & installation"}</dt>
            <dd>{money(summary.shippingCents, currency)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border/60 pt-2 text-base text-foreground">
          <dt>Order total</dt>
          <dd>{money(summary.totalCents, currency)}</dd>
        </div>
      </dl>

      <button
        type="button"
        disabled={busy || !ready}
        onClick={onSubmit}
        aria-disabled={!ready}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-none bg-[#0A0A0A] text-[12px] uppercase tracking-[0.2em] text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {!ready && !busy && <Loader2 className="h-4 w-4 animate-spin" />}
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
function WireForm({ lines, summary, account, email, setEmail, onDone }: {
  lines: CheckoutLine[];
  summary: CheckoutSummary;
  account: { email: string; role: string } | null;
  email: string;
  setEmail: (v: string) => void;
  onDone: (ref: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const { totalCents: total, currency } = summary;

  const submit = async () => {
    if (!account && (!name.trim() || !email.includes("@"))) {
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
          name: account ? account.email : name,
          email: account ? account.email : email,
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
      <section className="space-y-4 pt-6">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Bank wire — contact & delivery
        </h2>
        {account ? (
          <AccountBlock email={account.email} role={account.role} />
        ) : (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" className={field} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" inputMode="email" autoComplete="email" className={field} />
          </>
        )}
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel" inputMode="tel" autoComplete="tel" className={field} />
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address" rows={3} className="w-full rounded-none border border-border bg-background p-4 text-base outline-none focus:border-foreground" />
        <p className="text-xs text-muted-foreground">
          Our concierge will send fully-insured wiring instructions within one business hour.
        </p>
      </section>
      <StickyTotals
        summary={summary}
        cta={`Request wire instructions · ${money(total, currency)}`}
        busy={busy}
        onSubmit={submit}
      />
    </>
  );
}


/* ------------------------------------------------------------------ */
/* Shipping quote — nothing is charged until an advisor quote is added */
/* ------------------------------------------------------------------ */
function ShippingQuoteCard({
  currency,
  shipping,
  busy,
  onConfirm,
  onClear,
}: {
  currency: string;
  shipping: ConfirmedShipping | null;
  busy: boolean;
  onConfirm: (s: ConfirmedShipping) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  const submit = () => {
    const value = Number(String(amount).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter the shipping amount from your advisor quote.");
      return;
    }
    onConfirm({ cents: Math.round(value * 100), label: label.trim() });
    setOpen(false);
  };

  return (
    <section className="mx-5 mt-5 border border-border">
      <div className="flex items-start justify-between gap-4 px-4 py-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Delivery &amp; installation
          </p>
          <p className="mt-1 text-sm">
            {shipping
              ? shipping.label || "Confirmed advisor quote"
              : "To be Quoted by Advisor"}
          </p>
          {!shipping && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Not part of the amount below until you add your advisor quote.
            </p>
          )}
        </div>
        <div className="flex-none text-right text-sm">
          {shipping ? money(shipping.cents, currency) : "—"}
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-border/60 px-4 py-3">
        {shipping ? (
          <button
            type="button"
            disabled={busy}
            onClick={onClear}
            className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground underline underline-offset-4 disabled:opacity-40"
          >
            Remove shipping quote
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] uppercase tracking-[0.18em] underline underline-offset-4 disabled:opacity-40"
          >
            {open ? "Cancel" : "Add confirmed shipping quote"}
          </button>
        )}
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {open && !shipping && (
        <div className="space-y-3 border-t border-border/60 px-4 py-4">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Shipping amount (${(currency || "usd").toUpperCase()})`}
            inputMode="decimal"
            className="h-12 w-full rounded-none border border-border bg-background px-4 text-base outline-none focus:border-foreground"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Quote reference (optional)"
            className="h-12 w-full rounded-none border border-border bg-background px-4 text-base outline-none focus:border-foreground"
          />
          <button
            type="button"
            onClick={submit}
            className="h-12 w-full rounded-none bg-[#1A1A1A] text-[11px] uppercase tracking-[0.2em] text-white"
          >
            Confirm shipping quote
          </button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [grossLines, setLines] = useState<CheckoutLine[] | null>(null);
  // Account-level tier discount. The hook drives the first paint; the value
  // returned by the PaymentIntent is authoritative once it arrives, so the
  // displayed total always equals the amount Stripe will charge.
  const { pct: hookDiscountPct, label: discountRowLabel } = useAccountDiscount();
  const [serverDiscountPct, setServerDiscountPct] = useState<number | null>(null);
  const effectiveDiscountPct = serverDiscountPct ?? hookDiscountPct;
  // Shipping stays "To be Quoted by Advisor" until the buyer confirms an
  // advisor-issued quote; only then is it added to the Stripe payload.
  const [shipping, setShipping] = useState<ConfirmedShipping | null>(null);
  // Signed-in account — replaces blank email/name inputs with a confirmation.
  const { user, isAdmin, isSuperAdmin, isTradeUser } = useAuth();
  const account = user?.email
    ? {
        email: user.email,
        role: isAdmin || isSuperAdmin ? "Admin" : isTradeUser ? "Trade" : "Member",
      }
    : null;
  // Summary math: line items keep their standard catalogue prices; the tier
  // discount is applied once at cart level, exactly like the backend charge.
  const summary = useMemo<CheckoutSummary | null>(() => {
    if (!grossLines?.length) return null;
    const currency = orderCurrency(grossLines);
    const subtotalCents = orderSubtotal(grossLines);
    const discountCents =
      effectiveDiscountPct > 0 ? Math.round(subtotalCents * effectiveDiscountPct) : 0;
    const shippingCents = shipping?.cents ?? 0;
    return {
      currency,
      subtotalCents,
      discountCents,
      discountLabel: discountCents > 0 ? discountRowLabel : null,
      shippingCents,
      shippingLabel: shipping?.label ?? null,
      totalCents: subtotalCents - discountCents + shippingCents,
    };
  }, [grossLines, effectiveDiscountPct, discountRowLabel, shipping]);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  // Wire mode can be pre-selected by the "Your Selection" drawer
  // ("Proceed to Wire Instructions") via a one-shot sessionStorage flag.
  const [wire, setWire] = useState(() => {
    try {
      if (sessionStorage.getItem("ma_checkout_wire") === "1") {
        sessionStorage.removeItem("ma_checkout_wire");
        return true;
      }
    } catch {
      /* private mode — default to online */
    }
    return false;
  });
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialised = useRef(false);
  const intentIdRef = useRef<string>("");
  const [syncing, setSyncing] = useState(false);

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


  // Creates (or re-prices) the PaymentIntent. Re-runs whenever the buyer
  // confirms or clears a shipping quote so Stripe always matches the UI total.
  const syncIntent = useCallback(
    async (nextShipping: ConfirmedShipping | null) => {
      if (!grossLines?.length) return;
      const first = grossLines[0];
      setError(null);
      setSyncing(true);
      try {
        const piBody: Record<string, unknown> = {
          // Backward-compatible single-item fields (first line) …
          title: first.title,
          designer: first.designer || "",
          price: first.unitCents / 100,
          currency: orderCurrency(grossLines),
          selectedFinish: first.finishLabel || "",
          quantity: lineQty(first),
          // … plus the full order, which the function charges when present.
          // Gross prices — the tier rate is re-derived server-side.
          items: grossLines.map((l) => ({
            title: l.title,
            designer: l.designer || "",
            selectedFinish: l.finishLabel || "",
            price: l.unitCents / 100,
            quantity: lineQty(l),
          })),
          // Shipping is only ever sent once explicitly confirmed.
          shippingConfirmed: !!nextShipping,
          shippingCents: nextShipping?.cents ?? 0,
          shippingLabel: nextShipping?.label ?? "",
          paymentIntentId: intentIdRef.current || undefined,
        };

        const needsConfig = !stripePromise;
        const [cfgRes, piRes] = await Promise.all([
          needsConfig
            ? supabase.functions.invoke("stripe-config")
            : Promise.resolve({ data: null, error: null } as any),
          supabase.functions.invoke("create-payment-intent", { body: piBody }),
        ]);
        const cfg = (cfgRes as any)?.data;
        if (needsConfig && ((cfgRes as any)?.error || cfg?.error)) {
          throw new Error(cfg?.error || "Stripe is not configured.");
        }
        const pi = (piRes as any)?.data;
        if ((piRes as any)?.error || pi?.error) {
          throw new Error(pi?.error || "Unable to start checkout.");
        }

        // Guardrail: the amount Stripe will charge must equal the cart-derived
        // total. The tier rate is applied once at cart level — never per unit.
        const serverPct = Number(pi?.discountPct) || 0;
        setServerDiscountPct(serverPct);
        const serverShippingCents = Number(pi?.shippingCents) || 0;
        const totals = buildVerifiedTotals(grossLines);
        const expectedCents =
          totals.totalCents -
          (serverPct > 0 ? Math.round(totals.totalCents * serverPct) : 0) +
          serverShippingCents;
        const check = reconcileBackendAmount(
          { ...totals, totalCents: expectedCents },
          pi?.amount,
          pi?.currency,
        );
        if (check.ok === false) throw new Error(check.reason);

        intentIdRef.current = String(pi?.paymentIntentId || "");
        setShipping(
          serverShippingCents > 0
            ? { cents: serverShippingCents, label: String(pi?.shippingLabel || "") }
            : null,
        );
        if (needsConfig) setStripePromise(loadStripe(cfg.publishableKey));
        setClientSecret(pi.clientSecret);
      } catch (err: any) {
        setError(err?.message || "Unable to start checkout.");
      } finally {
        setSyncing(false);
      }
    },
    [grossLines, stripePromise],
  );

  useEffect(() => {
    if (!grossLines?.length || initialised.current) return;
    initialised.current = true;
    void syncIntent(null);
  }, [grossLines, syncIntent]);

  // Maison Affluency monochrome theme for Stripe Elements: sharp 0px corners,
  // pure-black focus/primary states, thin hairline borders, serif labels.
  const appearance = useMemo(
    () => ({
      theme: "flat" as const,
      variables: {
        colorPrimary: "#0A0A0A",
        colorBackground: "#FFFFFF",
        colorText: "#0A0A0A",
        colorTextSecondary: "#6B6B6B",
        colorTextPlaceholder: "#A3A3A3",
        colorDanger: "#B42318",
        colorIconCardCvc: "#6B6B6B",
        borderRadius: "0px",
        fontFamily: "'Lora', Georgia, serif",
        fontSizeBase: "15px",
        fontWeightNormal: "400",
        spacingUnit: "4px",
      },
      rules: {
        ".Input": {
          border: "1px solid #E4E2DE",
          borderRadius: "0px",
          boxShadow: "none",
          backgroundColor: "#FFFFFF",
          padding: "12px 14px",
        },
        ".Input:hover": { border: "1px solid #C9C6C0", boxShadow: "none" },
        ".Input:focus": {
          border: "1px solid #0A0A0A",
          boxShadow: "none",
          outline: "none",
        },
        ".Input--invalid": { borderColor: "#B42318", boxShadow: "none" },
        ".Label": {
          fontSize: "10px",
          fontWeight: "500",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#6B6B6B",
          marginBottom: "6px",
        },
        ".Tab": {
          border: "1px solid #E4E2DE",
          borderRadius: "0px",
          boxShadow: "none",
        },
        ".Tab:hover": { border: "1px solid #C9C6C0", boxShadow: "none" },
        ".Tab--selected": {
          border: "1px solid #0A0A0A",
          boxShadow: "none",
          backgroundColor: "#FFFFFF",
        },
        ".TabIcon--selected": { color: "#0A0A0A" },
        ".TabLabel--selected": { color: "#0A0A0A" },
        ".Block": {
          border: "1px solid #E4E2DE",
          borderRadius: "0px",
          boxShadow: "none",
        },
        ".Block:focus": { border: "1px solid #0A0A0A", boxShadow: "none" },
        ".PickerItem": { borderRadius: "0px" },
        ".MenuAction:hover": { backgroundColor: "#F5F4F2" },
        ".CheckboxInput": { borderRadius: "0px" },
        ".CheckboxInput--checked": {
          backgroundColor: "#0A0A0A",
          borderColor: "#0A0A0A",
        },
      },
    }),
    [],
  );

  // Load the site's serif into Stripe's iframe so inputs match the page type.
  const stripeFonts = useMemo(
    () => [
      {
        cssSrc:
          "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&display=swap",
      },
    ],
    [],
  );

  if (!grossLines?.length || !summary) return null;
  const homePath = grossLines[0].productPath || "/";

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
    <main className="mx-auto min-h-[100dvh] max-w-6xl bg-background pb-16">
      {/* 1 — Minimalist header */}
      <header className="flex flex-col items-center gap-2 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-6">
        <button onClick={() => navigate(homePath)} aria-label="Maison Affluency">
          <img src={logoIcon} alt="Maison Affluency" className="h-8 w-auto" />
        </button>
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <Lock className="h-3 w-3" /> 256-bit encrypted secure checkout
        </span>
      </header>

      {/* Two-column split: actions left, persistent order summary right */}
      <div className="grid gap-10 px-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:px-10">
        {/* Right — order summary (shown first on mobile) */}
        <div className="order-first lg:order-last">
          <OrderSummary lines={grossLines} summary={summary} />
        </div>

        {/* Left — checkout actions */}
        <div className="min-w-0">
          <ShippingQuoteCard
            currency={summary.currency}
            shipping={shipping}
            busy={syncing}
            onConfirm={(s) => void syncIntent(s)}
            onClear={() => void syncIntent(null)}
          />

          {/* Payment method switch */}
          <div className="pt-5">
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
            <WireForm
              lines={grossLines}
              summary={summary}
              account={account}
              email={email}
              setEmail={setEmail}
              onDone={setConfirmed}
            />
          ) : error ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{error}</div>
          ) : stripePromise && clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance, fonts: stripeFonts }}>
              <PaymentForm
                summary={summary}
                account={account}
                email={email}
                setEmail={setEmail}
                onPaid={setConfirmed}
              />
            </Elements>
          ) : (
            <div className="flex justify-center py-24">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
