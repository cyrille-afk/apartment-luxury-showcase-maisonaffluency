import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Elements, PaymentElement, AddressElement, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Lock, Check, Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getCart, clearCart } from "@/lib/cart";
import { useAccountDiscount } from "@/hooks/useAccountDiscount";
import { useAuth } from "@/hooks/useAuth";
import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import { AccountPricingBadge } from "@/components/product/AccountPricingBadge";
import StripeBankTransferPanel from "@/components/checkout/StripeBankTransferPanel";
import { VisaMark, MastercardMark, BankTransferMark } from "@/components/checkout/PaymentMarks";
import { TransferReferenceNote } from "@/components/checkout/TransferReferenceNote";
import { useEstimatedShipping, ESTIMATED_SHIPPING_NOTE } from "@/hooks/useShippingCountry";
import { getCurrentDestination, useShippingDestination } from "@/lib/shippingDestination";
import { ArrowLeft } from "lucide-react";
import {
  assertCheckoutCopy,
  buildVerifiedTotals,
  lineQuantity,
  lineTotalCents,
  reconcileBackendAmount,
} from "@/lib/checkoutGuardrails";


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
  /** Freight class hints — drive the shipping estimate multiplier. */
  category?: string | null;
  shippingModifier?: number | null;
};

/* All amounts below are derived only from cart line items — see checkoutGuardrails. */
const lineQty = (line: CheckoutLine) => lineQuantity(line);
const lineSubtotal = (line: CheckoutLine) => lineTotalCents(line);
const orderSubtotal = (lines: CheckoutLine[]) => buildVerifiedTotals(lines).totalCents;
const orderCurrency = (lines: CheckoutLine[]) => lines[0]?.currency || "usd";

/* Clean integers, no decimals — identical to the cart / sign-in pages. */
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));


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
  /** Base freight estimated from the buyer's country. 0 when unknown. */
  estimatedShippingCents: number;
  /** Display name of the matched shipping zone (e.g. "Asia Pacific"). */
  shippingZoneLabel: string | null;
  /** Displayed total — includes the estimated freight when present. */
  totalCents: number;
  /** Amount actually charged now (excludes unconfirmed estimated freight). */
  chargeTotalCents: number;
};

/* Signed-in account confirmation — replaces blank email/name inputs.  */
function AccountBlock({ email, role }: { email: string; role: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-border bg-muted/30 px-4 py-3">
      <span className="text-[11px] font-light uppercase tracking-[0.24em] text-muted-foreground">Account</span>
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

  return (
    <aside className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] h-fit">
      <div className="border border-border/70 px-7 py-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">Order Summary</h2>
          <AccountPricingBadge />
        </div>

        <ul className="mt-6 space-y-4">
          {lines.map((line, i) => (
            <li
              key={`${line.title}-${line.finishLabel || ""}-${i}`}
              className="flex gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0"
            >
              <div className="w-16 shrink-0 bg-cream">
                {line.imageUrl ? (
                  <img
                    src={line.imageUrl}
                    alt={line.title}
                    loading="lazy"
                    className="w-16 h-16 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {line.designer && (
                  <p className="font-body font-light text-[9px] uppercase tracking-[0.24em] text-muted-foreground">
                    {line.designer}
                  </p>
                )}
                <p className="font-display text-sm mt-1 truncate">{line.title}</p>
                {line.finishLabel && (
                  <p className="font-body text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {line.finishLabel}
                  </p>
                )}
                {line.leadTime && (
                  <p className="font-body text-[11px] text-muted-foreground mt-1">
                    Lead time · {line.leadTime}
                  </p>
                )}
                <p className="font-body text-[10px] font-light uppercase tracking-[0.24em] text-muted-foreground mt-1">
                  Qty {lineQty(line)}
                </p>
              </div>
              <p className="font-body text-sm tabular-nums shrink-0">
                {money(lineSubtotal(line), line.currency)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-7 space-y-4 font-body text-sm border-t border-border pt-6">
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{money(summary.subtotalCents, currency)}</dd>
          </div>
          {summary.discountCents > 0 && summary.discountLabel && (
            <div className="flex items-baseline justify-between gap-6">
              <dt className="text-muted-foreground">{summary.discountLabel}</dt>
              <dd className="tabular-nums text-foreground">
                −{money(summary.discountCents, currency)}
              </dd>
            </div>
          )}
          <div>
            <div className="flex items-baseline justify-between gap-6">
              <dt className="text-muted-foreground flex items-baseline gap-2">
                <span>{summary.shippingLabel || "Front Door Premium Delivery"}</span>
                {summary.shippingZoneLabel && (
                  <span className="shrink-0 border border-border/70 px-1.5 py-px text-[9px] font-light uppercase tracking-[0.18em] text-muted-foreground/80">
                    {summary.shippingZoneLabel}
                  </span>
                )}
              </dt>
              {summary.shippingCents > 0 ? (
                <dd className="tabular-nums">{money(summary.shippingCents, currency)}</dd>
              ) : summary.estimatedShippingCents > 0 ? (
                <dd className="tabular-nums">{money(summary.estimatedShippingCents, currency)}</dd>
              ) : (
                <dd className="text-right text-muted-foreground">To be Quoted by Advisor</dd>
              )}
            </div>
            {summary.shippingCents === 0 && summary.estimatedShippingCents > 0 && (
              <p className="mt-1.5 italic font-light text-[10px] tracking-[0.06em] text-muted-foreground">
                {ESTIMATED_SHIPPING_NOTE}
              </p>
            )}
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <dt className="font-medium uppercase text-[11px] tracking-[0.2em]">Order Total</dt>
            <dd className="tabular-nums font-medium text-base">
              {money(summary.totalCents, currency)}
            </dd>
          </div>
        </dl>

        <div
          aria-label="Accepted payment methods"
          className="mt-8 flex items-center justify-center gap-10 text-foreground/80 [&_svg]:h-6"
        >
          <VisaMark />
          <MastercardMark />
          <BankTransferMark />
        </div>

      </div>
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
/* Delivery & payment options — shipping module + payment method tabs  */
/* ------------------------------------------------------------------ */
type PaymentMethod = "card" | "wire" | "wallet" | "paynow";

const METHOD_TABS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: "card", label: "Secure Card Payment", hint: "Visa · Mastercard · Amex" },
  { id: "wire", label: "Bank Wire Transfer", hint: "Instructions within one business hour" },
  { id: "wallet", label: "Digital Wallet", hint: "Google Pay · Apple Pay · Link" },
];

/**
 * PayNow tab — shown only for SGD-priced orders. Stripe's virtual-account bank
 * transfers (customer_balance) are not offered to Singapore merchants, so SGD
 * trade orders settle through PayNow QR instead.
 */
const PAYNOW_TAB: { id: PaymentMethod; label: string; hint: string } = {
  id: "paynow",
  label: "PayNow",
  hint: "Scan with any Singapore banking app",
};

function DeliveryPaymentOptions({
  method,
  setMethod,
  paynowAvailable,
}: {
  method: PaymentMethod;
  setMethod: (m: PaymentMethod) => void;
  paynowAvailable: boolean;
}) {
  const tabs = paynowAvailable ? [...METHOD_TABS, PAYNOW_TAB] : METHOD_TABS;
  return (
    <section className="mt-6 w-full space-y-5 border-t border-border pt-8">
      <h2 className="text-[11px] font-light uppercase tracking-[0.26em] text-muted-foreground">
        Delivery &amp; payment options
      </h2>
      <div
        role="radiogroup"
        aria-label="Payment method"
        className={cn(
          "grid w-full grid-cols-1 border border-neutral-200",
          tabs.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3",
        )}
      >
        {tabs.map((tab, i) => {
          const active = tab.id === method;
          return (
            <button
              key={tab.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMethod(tab.id)}
              className={cn(
                "flex flex-col items-start gap-1 px-4 py-4 text-left transition-colors",
                i > 0 && "border-t border-neutral-200 sm:border-l sm:border-t-0",
                active ? "bg-foreground text-background" : "hover:bg-muted/40",
              )}
            >
              <span className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.22em]">
                <span
                  className={cn(
                    "h-2.5 w-2.5 flex-none rounded-full border",
                    active ? "border-background bg-background" : "border-border",
                  )}
                />
                {tab.label}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-relaxed",
                  active ? "text-background/70" : "text-muted-foreground",
                )}
              >
                {tab.hint}
              </span>
            </button>
          );
        })}
      </div>
    </section>
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
  method,
  optionsSlot,
  onCountryChange,
}: {
  summary: CheckoutSummary;
  account: { email: string; role: string } | null;
  email: string;
  setEmail: (v: string) => void;
  onPaid: (ref: string) => void;
  method: PaymentMethod;
  optionsSlot: React.ReactNode;
  onCountryChange?: (code: string | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  // Header / "Shipping destination & currency" modal selection. Saving there
  // must immediately drive both the address field and the freight estimate.
  const destination = useShippingDestination();
  useEffect(() => {
    onCountryChange?.(destination.iso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination.iso]);
  const [submitting, setSubmitting] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  // Staged messaging so the wait for Stripe's iframe is legible, not a blank gap.
  const [loadStage, setLoadStage] = useState(0);
  useEffect(() => {
    if (paymentReady) return;
    const t = setTimeout(() => setLoadStage(1), 2500);
    return () => clearTimeout(t);
  }, [paymentReady]);

  const { chargeTotalCents: total, currency } = summary;

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
      {/* 1 — Contact & delivery */}
      <section className="space-y-4 pb-12">
        <h2 className="text-[11px] font-light uppercase tracking-[0.26em] text-muted-foreground">
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
            className="h-14 w-full rounded-none border border-neutral-200 bg-background px-5 text-base font-light outline-none transition-colors hover:border-neutral-300 focus:border-foreground"
          />
        )}
        <AddressElement
          // Remount when the header/modal destination changes so the
          // "Country or Region" field snaps to the newly saved country.
          key={destination.iso}
          options={{
            mode: "shipping",
            display: { name: "full" },
            fields: { phone: "always" },
            autocomplete: { mode: "automatic" },
            // Carry the country chosen in the cart forward so freight stays consistent.
            defaultValues: { address: { country: destination.iso } },
          }}

          onChange={(e) => {
            onCountryChange?.(e.value?.address?.country || null);
          }}
        />
      </section>

      {/* 2 — Delivery & payment options */}
      {optionsSlot}

      {/* 3 — Selected payment panel. Both Stripe elements stay mounted; the
          inactive one is hidden with CSS so the Elements instance is never
          destroyed and re-created when tabs switch. */}
      <section className={cn("space-y-5 pt-10", method !== "wallet" && "hidden")}>
        <p className="text-[11px] font-light uppercase tracking-[0.24em] text-muted-foreground">
          Pay with your digital wallet
        </p>
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
        <p className="text-xs font-light leading-relaxed text-muted-foreground">
          Wallet availability depends on your device and browser. Switch to secure card payment if
          no wallet appears.
        </p>
        <ConditionalNotes />
      </section>

      <div className={cn(method === "wallet" && "hidden")}>
          <section className="space-y-5 pt-10">

          <div className="relative min-h-32">
            {!paymentReady && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 border border-neutral-200 bg-muted/20"
                role="status"
                aria-live="polite"
              >
                <span className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.24em] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loadStage === 0 ? "Opening secure Stripe session" : "Preparing card fields"}
                </span>
                <span className="h-px w-28 overflow-hidden bg-border">
                  <span className="block h-full w-1/3 animate-pulse bg-foreground" />
                </span>
                <span className="text-[10px] font-light text-muted-foreground/70">
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

        {/* 4 — Sticky summary & CTA (disabled until card fields are mounted) */}
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
      </div>


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
      <button
        type="button"
        disabled={busy || !ready}
        onClick={onSubmit}
        aria-disabled={!ready}
        className="mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-none bg-[#0A0A0A] px-8 text-[11px] font-light uppercase tracking-[0.3em] text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
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
/* ------------------------------------------------------------------ */
/* Bank details — replace placeholder values with live credentials.    */
/* ------------------------------------------------------------------ */
const BANK_DETAILS: { label: string; value: string; copyable?: boolean }[] = [
  { label: "Beneficiary Name", value: "Maison Affluency Pte. Ltd." },
  { label: "Bank Name", value: "DBS Bank" },
  { label: "Bank Address", value: "12 Marina Boulevard, Marina Bay Financial Centre, Singapore 018982" },
  { label: "Account Number / IBAN", value: "000-000-000-0", copyable: true },
  { label: "SWIFT / BIC Code", value: "DBSSSGSGXXX", copyable: true },
];

function WireDetailsGrid({ reference }: { reference: string }) {
  return (
    <div className="w-full space-y-4">
      <div className="w-full border border-neutral-200">
        {BANK_DETAILS.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "flex items-center justify-between gap-x-6 gap-y-1 px-5 py-4",
              i > 0 && "border-t border-neutral-100",
            )}
          >
            <span className="flex-none text-[10px] font-light uppercase tracking-[0.22em] text-muted-foreground">
              {row.label}
            </span>
            <span className="flex min-w-0 items-center justify-end gap-3 text-right">
              <span className="truncate text-sm font-light">{row.value}</span>
              {row.copyable && <CopyButton value={row.value} label={row.label} />}
            </span>
          </div>
        ))}
      </div>
      <TransferReferenceNote value={reference} />
    </div>
  );
}

/**
 * Stable per-cart wire reference (e.g. TRADE-ORDER-#10243) so the buyer sees
 * the same string across reloads and our treasury can pre-match the transfer.
 */
function stableOrderReference(fingerprint: string): string {
  try {
    const saved = JSON.parse(window.localStorage.getItem("ma_trade_order_ref") || "null");
    if (saved?.hash === fingerprint && typeof saved?.ref === "string") return saved.ref;
  } catch { /* ignore corrupt storage */ }
  let h = 0;
  for (let i = 0; i < fingerprint.length; i++) h = (h * 31 + fingerprint.charCodeAt(i)) >>> 0;
  const ref = `TRADE-ORDER-#${10000 + (h % 90000)}`;
  try {
    window.localStorage.setItem("ma_trade_order_ref", JSON.stringify({ hash: fingerprint, ref }));
  } catch { /* storage unavailable — ref simply regenerates */ }
  return ref;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copied`);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Unable to copy — please select the text manually.");
        }
      }}
      className={cn(
        "flex-none rounded-none border p-1.5 transition-colors",
        copied
          ? "border-foreground text-foreground"
          : "border-neutral-200 text-muted-foreground hover:border-foreground hover:text-foreground",
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Bank wire — payment by transfer, no card data collected             */
/* ------------------------------------------------------------------ */
function WireForm({ lines, summary, account, email, setEmail, onDone, optionsSlot }: {
  lines: CheckoutLine[];
  summary: CheckoutSummary;
  account: { email: string; role: string } | null;
  email: string;
  setEmail: (v: string) => void;
  onDone: (ref: string) => void;
  optionsSlot: React.ReactNode;
}) {

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const { chargeTotalCents: total, currency } = summary;
  const orderRef = useMemo(
    () =>
      stableOrderReference(
        JSON.stringify({
          c: currency,
          i: lines.map((l) => [l.title, l.finishLabel || "", lineQty(l)]),
        }),
      ),
    [currency, lines],
  );

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

  const field = "h-14 w-full rounded-none border border-neutral-200 bg-background px-5 text-base font-light outline-none transition-colors hover:border-neutral-300 focus:border-foreground";

  return (
    <>
      <section className="space-y-4 pt-6">
        <h2 className="text-[11px] font-light uppercase tracking-[0.26em] text-muted-foreground">
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
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address" rows={3} className="w-full rounded-none border border-neutral-200 bg-background p-5 text-base font-light outline-none transition-colors hover:border-neutral-300 focus:border-foreground" />
      </section>

      {optionsSlot}

      <section className="space-y-5 pt-8">
        <StripeBankTransferPanel
          currency={currency}
          email={account ? account.email : email}
          orderReference={orderRef}
          items={lines.map((l) => ({
            title: l.title,
            designer: l.designer || "",
            selectedFinish: l.finishLabel || "",
            price: l.unitCents / 100,
            quantity: lineQty(l),
          }))}
          shippingConfirmed={summary.shippingCents > 0}
          shippingCents={summary.shippingCents}
          fallback={
            <div className="space-y-5">
              <p className="text-xs text-muted-foreground">
                Our concierge will also email these fully-insured wiring instructions within one business hour.
              </p>
              <WireDetailsGrid reference={orderRef} />
            </div>
          }
        />
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
    <section className="border border-neutral-200">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[10px] font-light uppercase tracking-[0.24em] text-muted-foreground">
            Delivery &amp; installation
          </p>
          <p className="mt-0.5 truncate text-sm">
            {shipping
              ? shipping.label || "Confirmed advisor quote"
              : "To be Quoted by Advisor"}
          </p>
        </div>
        <div className="flex flex-none items-center gap-4">
          <span className="text-sm">{shipping ? money(shipping.cents, currency) : "—"}</span>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <button
            type="button"
            disabled={busy}
            onClick={() => (shipping ? onClear() : setOpen((v) => !v))}
            className="h-10 rounded-none border border-neutral-300 px-5 text-[10px] font-light uppercase tracking-[0.24em] transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:opacity-40"
          >
            {shipping ? "Remove" : open ? "Cancel" : "Add confirmed shipping quote"}
          </button>
        </div>
      </div>


      {open && !shipping && (
        <div className="space-y-3 border-t border-border/60 px-4 py-4">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Shipping amount (${(currency || "usd").toUpperCase()})`}
            inputMode="decimal"
            className="h-14 w-full rounded-none border border-neutral-200 bg-background px-5 text-base font-light outline-none transition-colors hover:border-neutral-300 focus:border-foreground"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Quote reference (optional)"
            className="h-14 w-full rounded-none border border-neutral-200 bg-background px-5 text-base font-light outline-none transition-colors hover:border-neutral-300 focus:border-foreground"
          />
          <button
            type="button"
            onClick={submit}
            className="h-12 w-full rounded-none bg-[#1A1A1A] text-[10px] font-light uppercase tracking-[0.28em] text-white"
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
  // Country picked in the "Country or Region" field of the delivery address —
  // drives the estimated base freight row in the Order Summary.
  const [formCountry, setFormCountry] = useState<string | null>(null);
  // Signed-in account — replaces blank email/name inputs with a confirmation.
  const { user, isAdmin, isSuperAdmin, isTradeUser } = useAuth();
  const account = user?.email
    ? {
        email: user.email,
        role: isAdmin || isSuperAdmin ? "Admin" : isTradeUser ? "Trade" : "Member",
      }
    : null;
  // Signed-in buyers never retype their email.
  useEffect(() => {
    if (user?.email) setEmail((v) => v || user.email!);
  }, [user]);
  // Summary math: line items keep their standard catalogue prices; the tier
  // discount is applied once at cart level, exactly like the backend charge.
  const estimate = useEstimatedShipping(
    (grossLines ?? []).map((l) => ({
      title: l.title,
      category: l.category ?? null,
      shippingModifier: l.shippingModifier ?? null,
      quantity: lineQty(l),
      unitPriceCents: l.unitCents,
    })),
    formCountry,
  );
  const summary = useMemo<CheckoutSummary | null>(() => {
    if (!grossLines?.length) return null;
    const currency = orderCurrency(grossLines);
    const subtotalCents = orderSubtotal(grossLines);
    const discountCents =
      effectiveDiscountPct > 0 ? Math.round(subtotalCents * effectiveDiscountPct) : 0;
    const shippingCents = shipping?.cents ?? 0;
    // Country-based base freight is indicative only: it is displayed and added
    // to the shown Order Total, but never charged until an advisor confirms it.
    const estimatedShippingCents = shippingCents > 0 ? 0 : estimate.cents;
    const chargeTotalCents = subtotalCents - discountCents + shippingCents;
    return {
      currency,
      subtotalCents,
      discountCents,
      discountLabel: discountCents > 0 ? discountRowLabel : null,
      shippingCents,
      shippingLabel: shipping?.label ?? null,
      estimatedShippingCents,
      shippingZoneLabel: estimate.zoneLabel ?? null,
      totalCents: chargeTotalCents + estimatedShippingCents,
      chargeTotalCents,
    };
  }, [grossLines, effectiveDiscountPct, discountRowLabel, shipping, estimate.cents, estimate.zoneLabel]);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  // Wire mode can be pre-selected by the "Your Selection" drawer
  // ("Proceed to Wire Instructions") via a one-shot sessionStorage flag.
  const [method, setMethod] = useState<PaymentMethod>(() => {
    try {
      if (sessionStorage.getItem("ma_checkout_wire") === "1") {
        sessionStorage.removeItem("ma_checkout_wire");
        return "wire";
      }
    } catch {
      /* private mode — default to online */
    }
    return "card";
  });
  const wire = method === "wire";

  const [confirmed, setConfirmed] = useState<string | null>(null);
  // Once payment (card or wire) succeeds the basket must be emptied, otherwise
  // the header bag keeps the purchased lines and re-entering /checkout would
  // rebuild — and re-charge — the same order.
  const completeOrder = useCallback((reference: string) => {
    clearCart();
    try {
      sessionStorage.removeItem(CHECKOUT_KEY);
    } catch {
      /* private mode */
    }
    setConfirmed(reference);
  }, []);
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
          border: "1px solid #E7E5E1",
          borderRadius: "0px",
          boxShadow: "none",
          backgroundColor: "#FFFFFF",
          padding: "16px 20px",
        },
        ".Input:hover": { border: "1px solid #D6D3CD", boxShadow: "none" },
        ".Input:focus": {
          border: "1px solid #0A0A0A",
          boxShadow: "none",
          outline: "none",
        },
        ".Input--invalid": { borderColor: "#B42318", boxShadow: "none" },
        ".Label": {
          fontSize: "10px",
          fontWeight: "300",
          letterSpacing: "0.24em",
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
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Secure Checkout — Maison Affluency</title>
        <meta name="description" content="Complete your Maison Affluency acquisition through our encrypted secure checkout." />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <Navigation borderless />

      <main className="pt-[var(--header-h)] pb-24 max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="pt-8">
          <Link
            to="/cart"
            className="inline-flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to cart
          </Link>
        </div>

        <div className="flex items-baseline justify-between gap-6 border-b border-border pb-6 pt-5">
          <h1 className="font-display font-normal text-[1.6rem] md:text-[2.25rem] tracking-[-0.01em]">
            Secure Checkout
          </h1>
          <span className="flex items-center gap-1.5 font-body text-[10px] font-light uppercase tracking-[0.24em] text-muted-foreground">
            <Lock className="h-3 w-3" /> 256-bit Encrypted
          </span>
        </div>

        {/* Two-column split: actions left, persistent order summary right */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-12 lg:gap-16 pt-12">
        {/* Left — checkout actions */}
        <div className="min-w-0">
          {(() => {
            const optionsSlot = (
              <DeliveryPaymentOptions method={method} setMethod={setMethod} />
            );
            if (method === "wire") {
              return (
                <WireForm
                  lines={grossLines}
                  summary={summary}
                  account={account}
                  email={email}
                  setEmail={setEmail}
                  onDone={completeOrder}
                  optionsSlot={optionsSlot}
                />
              );
            }
            if (error) {
              return <div className="py-16 text-center text-sm text-muted-foreground">{error}</div>;
            }
            if (stripePromise && clientSecret) {
              return (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance, fonts: stripeFonts }}>
                  <PaymentForm
                    summary={summary}
                    account={account}
                    email={email}
                    setEmail={setEmail}
                    onPaid={completeOrder}
                    onCountryChange={setFormCountry}
                    method={method}
                    optionsSlot={optionsSlot}
                  />
                </Elements>
              );
            }
            return (
              <div className="flex justify-center py-24">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            );
          })()}


        </div>

        {/* Right — persistent order summary */}
        <OrderSummary lines={grossLines} summary={summary} />
        </div>
      </main>
    </div>
  );
}
