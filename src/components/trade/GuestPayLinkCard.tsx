import { useEffect, useState } from "react";
import { Copy, Link2, Loader2, Check, Trash2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type PayLink = {
  id: string;
  token: string;
  amount_cents: number;
  currency: string;
  label: string;
  payer_email: string | null;
  status: string;
  created_at: string;
};

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", SGD: "S$", HKD: "HK$" };

const fmt = (cents: number, currency: string) =>
  `${SYMBOLS[currency.toUpperCase()] ?? ""}${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency.toUpperCase()}`;

interface Props {
  quoteId: string;
  currency: string;
  /** Full order total in quote currency (goods + crating + shipping + extras). */
  orderTotalCents?: number;
  /** Deposit share of the order total, e.g. 0.6 for 60%. */
  depositPct?: number;
  defaultEmail?: string | null;
}

/**
 * Admin-only: mint a login-free Stripe Checkout link for an agreed amount,
 * then copy it into WhatsApp or email. No trade account needed by the payer.
 */
export default function GuestPayLinkCard({ quoteId, currency, orderTotalCents = 0, depositPct = 0.6, defaultEmail }: Props) {
  const { toast } = useToast();
  const pctLabel = `${Math.round(depositPct * 100)}% deposit`;
  const autoDepositCents = Math.round(orderTotalCents * depositPct);
  const [links, setLinks] = useState<PayLink[]>([]);
  const [overrideAmount, setOverrideAmount] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [label, setLabel] = useState(pctLabel);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [emailTouched, setEmailTouched] = useState(false);

  // Keep the auto amount and prefilled client email in sync with the live quote.
  const amount = overrideAmount
    ? manualAmount
    : autoDepositCents
      ? (autoDepositCents / 100).toFixed(2)
      : "";

  useEffect(() => {
    if (!emailTouched && defaultEmail) setEmail(defaultEmail);
  }, [defaultEmail, emailTouched]);

  useEffect(() => {
    if (!overrideAmount) setLabel(pctLabel);
  }, [overrideAmount, pctLabel]);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("quote_payment_links")
      .select("id, token, amount_cents, currency, label, payer_email, status, created_at")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false });
    setLinks((data as PayLink[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  const linkUrl = (token: string) => `${window.location.origin}/pay/${token}`;

  const handleCreate = async () => {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast({ title: "Enter an amount", description: "Add the agreed amount before creating the link.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("quote_payment_links")
      .insert({
        quote_id: quoteId,
        amount_cents: cents,
        currency: currency.toUpperCase(),
        label: label.trim() || "Full payment",
        payer_email: email.trim() || null,
      })
      .select("id, token, amount_cents, currency, label, payer_email, status, created_at")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Could not create link", description: error?.message ?? "Please try again.", variant: "destructive" });
      return;
    }
    setLinks((prev) => [data as PayLink, ...prev]);
    await navigator.clipboard.writeText(linkUrl((data as PayLink).token)).catch(() => {});
    toast({ title: "Pay Now link created", description: "The link is copied — paste it into WhatsApp or email." });
  };


  const handleEmailClient = async () => {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast({ title: "Enter an amount", description: "Add the agreed amount before emailing the client.", variant: "destructive" });
      return;
    }
    if (!email.trim()) {
      toast({ title: "Client email required", description: "Add the client's email address to send the quotation.", variant: "destructive" });
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-client-quote-payment", {
      body: {
        quoteId,
        recipientEmail: email.trim(),
        amountCents: cents,
        currency: currency.toUpperCase(),
        label: label.trim() || "Full payment",
      },
    });
    setSending(false);
    const err = (data as { error?: string } | null)?.error;
    if (error || err) {
      toast({ title: "Email not sent", description: err ?? "Please try again.", variant: "destructive" });
      return;
    }
    await load();
    toast({ title: "Quotation sent", description: `Pay Now link emailed to ${email.trim()}.` });
  };

  const handleCopy = async (link: PayLink) => {
    await navigator.clipboard.writeText(linkUrl(link.token)).catch(() => {});
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRevoke = async (link: PayLink) => {
    if (!confirm("Revoke this payment link? It will stop working immediately.")) return;
    const { error } = await supabase.from("quote_payment_links").update({ status: "revoked" }).eq("id", link.id);
    if (error) {
      toast({ title: "Could not revoke link", description: error.message, variant: "destructive" });
      return;
    }
    setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, status: "revoked" } : l)));
  };

  return (
    <div className="border-t border-border p-4 md:p-6 lg:p-8 print:hidden space-y-4">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.15em] text-foreground mb-1">Guest Pay Now Link</p>
        <p className="font-body text-[11px] text-muted-foreground max-w-xl">
          The {pctLabel} is calculated automatically from this quote&apos;s order total
          {orderTotalCents > 0 ? ` (${fmt(orderTotalCents, currency)})` : ""}. Override it only if the agreed amount or FX differs.
          The client pays by card on Stripe with no account or sign-in.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[130px_1fr_1fr_auto_auto] items-center">
        <input
          value={amount}
          onChange={(e) => setManualAmount(e.target.value)}
          readOnly={!overrideAmount}
          inputMode="decimal"
          placeholder={`Amount (${currency.toUpperCase()})`}
          title={overrideAmount ? "Manual amount" : `Auto: ${pctLabel} of the order total`}
          className={`px-3 py-2 border border-border rounded-md font-body text-xs ${overrideAmount ? "bg-background" : "bg-muted/40 text-muted-foreground cursor-default"}`}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. 60% deposit)"
          className="px-3 py-2 border border-border rounded-md bg-background font-body text-xs"
        />
        <input
          value={email}
          onChange={(e) => { setEmailTouched(true); setEmail(e.target.value); }}
          type="email"
          onFocus={() => setEmailTouched(true)}
          placeholder="Client email"
          className="px-3 py-2 border border-border rounded-md bg-background font-body text-xs"
        />
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-foreground text-background font-body text-[10px] uppercase tracking-[0.1em] rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          {creating ? "Creating…" : "Create link"}
        </button>
        <button
          onClick={handleEmailClient}
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-foreground text-foreground font-body text-[10px] uppercase tracking-[0.1em] rounded-md hover:bg-foreground/5 transition-colors disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
          {sending ? "Sending…" : "Email client"}
        </button>
      </div>

      <label className="flex items-center gap-2 font-body text-[11px] text-muted-foreground">
        <input
          type="checkbox"
          checked={overrideAmount}
          onChange={(e) => {
            const on = e.target.checked;
            setOverrideAmount(on);
            if (on) setManualAmount(autoDepositCents ? (autoDepositCents / 100).toFixed(2) : "");
          }}
          className="h-3.5 w-3.5 accent-foreground"
        />
        Override amount (incorrect total or FX adjustment)
      </label>

      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="flex flex-wrap items-center gap-2 justify-between rounded-md border border-border px-3 py-2">
              <div className="font-body text-[11px] text-foreground/80 min-w-0">
                <span className="font-medium">{fmt(link.amount_cents, link.currency)}</span> · {link.label}
                <span className={`ml-2 uppercase tracking-widest text-[9px] ${link.status === "paid" ? "text-primary" : link.status === "revoked" ? "text-destructive" : "text-muted-foreground"}`}>
                  {link.status}
                </span>
                <div className="truncate text-[10px] text-muted-foreground">{linkUrl(link.token)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(link)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md font-body text-[10px] uppercase tracking-[0.1em] hover:bg-muted transition-colors"
                >
                  {copiedId === link.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedId === link.id ? "Copied" : "Copy"}
                </button>
                {link.status === "active" && (
                  <button
                    onClick={() => handleRevoke(link)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-destructive/30 text-destructive rounded-md font-body text-[10px] uppercase tracking-[0.1em] hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
