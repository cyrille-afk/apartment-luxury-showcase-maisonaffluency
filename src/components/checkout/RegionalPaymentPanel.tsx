/**
 * Regional bank-settlement panel
 * ------------------------------
 * ASEAN  → Corporate PayNow / local FAST transfer
 * GCC    → International SWIFT wire
 * ROW    → International SWIFT wire
 *
 * Records a pro-forma order, generates the branded pro-forma invoice PDF,
 * emails it to the buyer, and lets signed-in buyers attach their remittance
 * receipt for treasury reconciliation.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy, Download, Loader2, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  channelsForRegion,
  taxConfigForRegion,
  type PaymentChannelId,
  type RegionTier,
  type TradePaymentChannel,
} from "@/config/tradePaymentChannels";
import { buildProformaInvoicePdf, type ProformaLine } from "@/lib/proformaInvoicePdf";
import { computeTaxCents, resolveTaxRule, taxRowLabel } from "@/config/taxRules";

export interface RegionalPaymentPanelProps {
  orderRef: string;
  regionTier: RegionTier;
  country?: string | null;
  /** ISO 3166-1 alpha-2 destination code — drives the canonical tax rule. */
  countryIso?: string | null;
  currency: string;
  buyer: { name: string; email: string; phone?: string | null; address?: string | null };
  lines: ProformaLine[];
  subtotalCents: number;
  discountCents: number;
  discountLabel?: string | null;
  shippingCents: number;
  shippingLabel?: string | null;
  /** Called once the pro-forma order has been recorded. */
  onRecorded?: (orderId: string) => void;
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));

function CopyValue({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          toast.error("Copy unavailable — please select the value manually.");
        }
      }}
      className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      aria-label={`Copy ${value}`}
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export default function RegionalPaymentPanel(props: RegionalPaymentPanelProps) {
  const {
    orderRef,
    regionTier,
    country,
    countryIso,
    currency,
    buyer,
    lines,
    subtotalCents,
    discountCents,
    discountLabel,
    shippingCents,
    shippingLabel,
    onRecorded,
  } = props;

  const channels = useMemo(() => channelsForRegion(regionTier), [regionTier]);
  const [channelId, setChannelId] = useState<PaymentChannelId>(channels[0].id);
  const channel: TradePaymentChannel = channels.find((c) => c.id === channelId) ?? channels[0];

  // Single source of truth: the same rule engine the checkout summary and the
  // PaymentIntent use, so the invoiced total always matches the page total.
  const rule = useMemo(
    () => resolveTaxRule(countryIso ?? country, currency),
    [countryIso, country, currency],
  );
  const tax = useMemo(
    () =>
      rule
        ? { rate: rule.rate, label: taxRowLabel(rule) }
        : { rate: 0, label: taxConfigForRegion(regionTier, country).label },
    [rule, regionTier, country],
  );
  const taxableCents = Math.max(0, subtotalCents - discountCents) + shippingCents;
  const taxCents = computeTaxCents(
    Math.max(0, subtotalCents - discountCents),
    shippingCents,
    rule,
  );
  const totalCents = taxableCents + taxCents;

  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [issued, setIssued] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [receiptName, setReceiptName] = useState<string | null>(null);

  // Pro-forma orders and invoices now require a session (edge functions reject
  // anonymous calls with 401) — guests are asked to sign in first instead.
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAuthed(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      setIsAuthed(Boolean(session?.user));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const promptSignIn = () => {
    toast.error("Please sign in to issue a pro-forma invoice.");
    navigate("/trade/login", { state: { returnTo: window.location.pathname + window.location.search } });
  };

  const buildPdf = () =>
    buildProformaInvoicePdf({
      orderRef,
      currency,
      buyer,
      regionTier,
      lines,
      subtotalCents,
      discountCents,
      discountLabel,
      shippingCents,
      shippingLabel,
      taxCents,
      taxLabel: tax.label,
      totalCents,
      channel,
    });

  const recordOrder = async (): Promise<string | null> => {
    if (orderId) return orderId;
    const { data, error } = await supabase.functions.invoke("create-proforma-order", {
      body: {
        orderRef,
        regionTier,
        paymentChannel: channel.id,
        currency,
        buyer,
        lines,
        subtotalCents,
        discountCents,
        discountLabel,
        shippingCents,
        shippingLabel,
        taxCents,
        taxLabel: tax.label,
        totalCents,
      },
    });
    if (error) {
      console.error("create-proforma-order failed:", error);
      return null;
    }
    const id = (data as any)?.orderId ?? null;
    if (id) {
      setOrderId(id);
      onRecorded?.(id);
    }
    return id;
  };

  const issueInvoice = async () => {
    if (!buyer.email) {
      toast.error("Please add your email address above first.");
      return;
    }
    if (isAuthed === false) {
      promptSignIn();
      return;
    }
    setBusy(true);
    try {
      const id = await recordOrder();
      const doc = await buildPdf();
      doc.save(`Maison-Affluency-Proforma-${orderRef}.pdf`);

      const base64 = (doc.output("datauristring") as string).split(",")[1];
      const { error } = await supabase.functions.invoke("send-proforma-invoice", {
        body: {
          orderId: id,
          orderRef,
          recipientEmail: buyer.email,
          recipientName: buyer.name,
          currency,
          totalCents,
          channelLabel: channel.label,
          pdfBase64: base64,
        },
      });
      if (error) throw error;
      setIssued(true);
      toast.success("Pro-forma invoice downloaded and emailed to you.");
    } catch (err) {
      console.error("Pro-forma issue failed:", err);
      toast.error("The invoice was downloaded but the email could not be sent. Our concierge will follow up.");
      setIssued(true);
    } finally {
      setBusy(false);
    }
  };

  const uploadReceipt = async (file: File) => {
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        promptSignIn();
        return;
      }
      const id = await recordOrder();
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `${uid}/${orderRef}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payment-receipts").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw upErr;
      if (id) {
        const { error: rowErr } = await supabase
          .from("shop_orders")
          .update({ payment_receipt_path: path })
          .eq("id", id);
        if (rowErr) throw rowErr;
      }
      setReceiptName(file.name);
      toast.success("Receipt received — our treasury will confirm within one business day.");
    } catch (err) {
      console.error("Receipt upload failed:", err);
      toast.error("Upload failed. Please email your remittance advice to concierge@maisonaffluency.com.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-[11px] font-light uppercase tracking-[0.26em] text-muted-foreground">
          Settlement · {regionTier === "ASEAN" ? "Singapore & ASEAN" : regionTier === "GCC" ? "Gulf Cooperation Council" : "International"}
        </h2>
        <p className="text-sm font-light text-muted-foreground">
          {regionTier === "ASEAN"
            ? "Settle instantly from your corporate account — no card fees, no FX spread."
            : "Settled by international wire in your invoiced currency, all bank charges borne by the sender."}
        </p>
      </header>

      {channels.length > 1 && (
        <div className="flex gap-2">
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannelId(c.id)}
              className={cn(
                "flex-1 border px-4 py-3 text-left transition-colors",
                c.id === channelId
                  ? "border-foreground bg-foreground/[0.03]"
                  : "border-border hover:border-neutral-400",
              )}
            >
              <span className="block text-sm">{c.label}</span>
              <span className="block text-[11px] font-light text-muted-foreground">{c.hint}</span>
            </button>
          ))}
        </div>
      )}

      <dl className="divide-y divide-border border border-border">
        {channel.rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-3">
            <dt className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{row.label}</dt>
            <dd className="flex min-w-0 items-center gap-3 text-right">
              <span className="truncate text-sm tabular-nums">{row.value}</span>
              {row.copyable && <CopyValue value={row.value} />}
            </dd>
          </div>
        ))}
      </dl>

      <div className="border border-foreground px-4 py-4">
        <p className="text-sm">
          Reference Note: <span className="font-medium tabular-nums">{orderRef}</span>
        </p>
        <p className="mt-1 text-xs font-light text-muted-foreground">
          This reference must appear on your transfer. Payments received without it may be delayed in reconciliation.
        </p>
      </div>

      <ul className="space-y-1.5 text-xs font-light text-muted-foreground">
        {channel.instructions.map((note) => (
          <li key={note}>— {note}</li>
        ))}
      </ul>

      <dl className="space-y-2 border-t border-border pt-5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{money(subtotalCents, currency)}</dd>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <dt>{discountLabel || "Trade discount"}</dt>
            <dd className="tabular-nums">− {money(discountCents, currency)}</dd>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <dt>{shippingLabel || "Freight & white-glove delivery"}</dt>
          <dd className="tabular-nums">{shippingCents > 0 ? money(shippingCents, currency) : "To be quoted"}</dd>
        </div>
        <div className="flex justify-between gap-6 text-muted-foreground">
          <dt className="font-light">{tax.label}</dt>
          <dd className="shrink-0 tabular-nums">{taxCents > 0 ? money(taxCents, currency) : "—"}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-base">
          <dt>Total due</dt>
          <dd className="tabular-nums">{money(totalCents, currency)}</dd>
        </div>
      </dl>

      {isAuthed === false ? (
        <div className="border border-border bg-foreground/[0.03] px-5 py-5 text-center">
          <Lock className="mx-auto h-4 w-4 text-muted-foreground" />
          <p className="mt-2 text-sm">Sign in to issue your pro-forma invoice</p>
          <p className="mt-1 text-xs font-light text-muted-foreground">
            Pro-forma orders are tied to your trade account so our concierge can reconcile your transfer.
          </p>
          <button
            type="button"
            onClick={promptSignIn}
            className="mt-4 flex h-12 w-full items-center justify-center gap-3 bg-foreground text-sm uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-90"
          >
            Sign in to continue
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={issueInvoice}
          disabled={busy || isAuthed !== true}
          className="flex h-14 w-full items-center justify-center gap-3 bg-foreground text-sm uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? "Preparing" : "Issue pro-forma invoice"}
        </button>
      )}

      <div className={cn("space-y-3 border-t border-border pt-6", isAuthed === false && "hidden")}>
        <h3 className="text-[11px] font-light uppercase tracking-[0.26em] text-muted-foreground">
          Attach payment receipt
        </h3>
        <p className="text-xs font-light text-muted-foreground">
          Upload your remittance advice or transfer confirmation and we will reserve your pieces immediately, ahead of
          funds clearing.
        </p>
        <label
          className={cn(
            "flex h-14 w-full cursor-pointer items-center justify-center gap-3 border border-dashed border-neutral-300 text-sm transition-colors hover:border-foreground",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {receiptName ? `Attached · ${receiptName}` : uploading ? "Uploading" : "Upload receipt (PDF, JPG, PNG)"}
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadReceipt(file);
              e.target.value = "";
            }}
          />
        </label>
        {issued && (
          <p className="text-xs font-light text-muted-foreground">
            A copy of your pro-forma invoice has been sent to {buyer.email}.
          </p>
        )}
      </div>
    </section>
  );
}
