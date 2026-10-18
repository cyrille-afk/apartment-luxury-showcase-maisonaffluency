import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import { clearCart } from "@/lib/cart";
import { clearSecureBasket } from "@/lib/checkout/secureBasket";
import { applyServerTotals, getTransferConfirmation, listTransferConfirmations, saveTransferConfirmation, type TransferConfirmation } from "@/lib/checkout/transferConfirmations";
import { TransferReferenceNote } from "@/components/checkout/TransferReferenceNote";

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

function SavedTransfer({ c }: { c: TransferConfirmation }) {
  return <div className="mt-8 space-y-8">
    <section aria-label="Bank transfer instructions">
      <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Bank transfer instructions · issued {new Date(c.issuedAt).toLocaleString()}</p>
      {c.rails.map(rail => <div key={rail.label} className="mb-4 border border-border">
        <p className="border-b border-border px-5 py-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{rail.label}</p>
        {rail.rows.map(r => <div key={r.label} className="flex justify-between gap-6 border-t border-border/60 px-5 py-3 first:border-t-0">
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{r.label}</span>
          <span className="select-all text-right text-sm font-light tabular-nums">{r.value}</span>
        </div>)}
      </div>)}
      <TransferReferenceNote value={c.reference} />
      {c.hostedUrl && <a href={c.hostedUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[10px] uppercase tracking-[0.24em] underline underline-offset-4">View secure Stripe instructions</a>}
    </section>
    <section aria-label="Order summary">
      <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Order summary</p>
      <ul className="divide-y divide-border border-y border-border">
        {c.lines.map((l, i) => <li key={i} className="flex justify-between gap-4 py-3 text-sm">
          <span className="min-w-0"><span className="block">{l.title}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</span>
            {(l.designer || l.finishLabel) && <span className="block text-xs text-muted-foreground">{[l.designer, l.finishLabel].filter(Boolean).join(" · ")}</span>}</span>
          <span className="tabular-nums">{money(l.unitCents * l.quantity, c.currency)}</span>
        </li>)}
      </ul>
      <dl className="mt-3 space-y-1 text-sm">
        {(c.discountCents ?? 0) > 0 && <div className="flex justify-between text-muted-foreground"><dt>Discount</dt><dd className="tabular-nums">−{money(c.discountCents!, c.currency)}</dd></div>}
        {c.deliveryCents > 0 && <div className="flex justify-between text-muted-foreground"><dt>Delivery</dt><dd className="tabular-nums">{money(c.deliveryCents, c.currency)}</dd></div>}
        {c.taxCents > 0 && <div className="flex justify-between text-muted-foreground"><dt>{c.taxLabel || "Tax"}</dt><dd className="tabular-nums">{money(c.taxCents, c.currency)}</dd></div>}
        {c.taxUpdatedAt && <p className="pt-1 text-xs text-muted-foreground">Tax updated by our team on {new Date(c.taxUpdatedAt).toLocaleDateString()} — please transfer the total below.</p>}
        <div className="flex justify-between font-medium"><dt>Total to transfer</dt><dd className="tabular-nums">{money(c.totalCents, c.currency)}</dd></div>
      </dl>
    </section>
  </div>;
}

export default function OrderConfirmation() {
  const [params] = useSearchParams();
  const ref = params.get("ref");
  const status = params.get("status");
  const initial = useMemo(() => (ref ? getTransferConfirmation(ref) : null), [ref]);
  const [saved, setSaved] = useState<TransferConfirmation | null>(initial);
  useEffect(() => { setSaved(initial); }, [initial]);
  // Instant transfers: pick up tax/VAT corrections the team made after issue.
  useEffect(() => {
    if (!initial || initial.method !== "instant" || !initial.paymentIntentId) return;
    let off = false;
    supabase.rpc("get_instant_transfer_totals", { _ref: initial.reference, _intent: initial.paymentIntentId })
      .then(({ data }) => {
        const next = applyServerTotals(initial, Array.isArray(data) ? data[0] : null);
        if (off || !next) return;
        saveTransferConfirmation(next);
        setSaved(next);
      });
    return () => { off = true; };
  }, [initial]);
  const others = useMemo(() => (ref ? [] : listTransferConfirmations()), [ref]);
  const bank = status === "bank_transfer" || !!saved;

  useEffect(() => {
    if (status === "paid") { clearCart(); clearSecureBasket("order"); }
  }, [status]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Order Received — Maison Affluency</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <Navigation borderless />

      <div className="pt-[var(--header-h)] pb-24 max-w-2xl mx-auto px-4 sm:px-6">
        <h1 className="font-display font-normal text-[1.6rem] md:text-[2rem] tracking-[-0.01em]">
          {!ref && others.length ? "Your bank transfer orders" : bank ? "Order Reserved" : "Thank You for Your Order"}
        </h1>

        {ref && (
          <p className="mt-4 font-body text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Reference {ref}
          </p>
        )}

        {!(!ref && others.length) && <p className="mt-6 font-body text-sm leading-relaxed text-muted-foreground">
          {saved
            ? "Your pieces are reserved. Transfer the total below using these instructions and include the reference so your payment is matched. These details stay available on this device for 90 days."
            : bank
            ? "Your pieces are reserved. Our concierge will email you the bank transfer details and a pro-forma invoice within one business day. Production begins once funds are received."
            : "Your payment has been received. The tax and customs treatment agreed at checkout is recorded on your order confirmation. Our concierge will confirm production lead times and delivery scheduling within one business day."}
        </p>}

        {saved && <SavedTransfer c={saved} />}

        {!ref && others.length > 0 && <ul className="mt-6 divide-y divide-border border-y border-border">
          {others.map(c => <li key={c.reference}><Link to={`/order-confirmation?ref=${encodeURIComponent(c.reference)}&status=bank_transfer`} className="flex justify-between gap-4 py-3 text-sm hover:text-muted-foreground">
            <span>{c.reference}<span className="block text-xs text-muted-foreground">{new Date(c.issuedAt).toLocaleDateString()}</span></span>
            <span className="tabular-nums">{money(c.totalCents, c.currency)}</span>
          </Link></li>)}
        </ul>}

        <Link
          to="/designers"
          className="mt-10 inline-flex items-center justify-center px-6 py-3 bg-foreground text-background font-body text-[10px] uppercase tracking-[0.22em]"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
