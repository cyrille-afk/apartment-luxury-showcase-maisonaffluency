import { useState } from "react";
import { Check, Loader2, Mail, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CURRENCIES = ["USD", "EUR", "GBP", "SGD", "HKD", "AED", "CHF"] as const;
const SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  SGD: "S$",
  HKD: "HK$",
  AED: "AED",
  CHF: "CHF",
};

interface Props {
  label: string;
  email: string | null;
  quoteId?: string | null;
  /** Dashboard card identity — mapped back by the Stripe webhook. */
  cardId?: string | null;
  cardStage?: string | null;
  recipientName?: string | null;
  productName?: string | null;
  finish?: string | null;
  leadTime?: string | null;
  maisonRef?: string | null;
  className?: string;
}

const FunnelPayLinkBlock = ({
  label,
  email,
  quoteId,
  cardId,
  cardStage,
  recipientName,
  productName,
  finish,
  leadTime,
  maisonRef,
  className,
}: Props) => {
  const { toast } = useToast();
  const [currency, setCurrency] = useState<string>("USD");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [paymentKind, setPaymentKind] = useState<"full" | "deposit">("full");

  const handleGenerate = async () => {
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value < 1) {
      toast({ title: "Enter an amount first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-adhoc-payment-link", {
        body: {
          amountCents: Math.round(value * 100),
          currency,
          label,
          payerEmail: email,
          quoteId: quoteId ?? null,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(data?.error || "No link returned");
      try {
        await navigator.clipboard.writeText(data.url);
      } catch {
        window.prompt("Copy this payment link", data.url);
      }
      setPaymentUrl(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 6000);
    } catch (err) {
      toast({
        title: "Could not create the payment link",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!email) {
      toast({ title: "No recipient email", variant: "destructive" });
      return;
    }
    if (!paymentUrl) {
      toast({ title: "Generate a payment link first", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "quote-confirmation-payment-link",
          recipientEmail: email,
          idempotencyKey: `quote-confirm-${quoteId ?? label}-${Date.now()}`,
          templateData: {
            recipientName: recipientName || undefined,
            productName: productName || label,
            finish,
            leadTime,
            paymentLink: paymentUrl,
            maisonRef: maisonRef || (quoteId ? `QU-${quoteId.slice(0, 6).toUpperCase()}` : undefined),
          },
        },
      });
      if (error) throw error;
      setEmailSent(true);
      toast({ title: "Confirmation email sent" });
      setTimeout(() => setEmailSent(false), 6000);
    } catch (err) {
      toast({
        title: "Could not send confirmation email",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className={cn("mt-3 space-y-2 border-t border-border/70 pt-3 font-body", className)}>
      <div className="flex items-stretch border border-border bg-background focus-within:border-gold">
        <label className="sr-only" htmlFor={`amt-${quoteId ?? label}`}>
          Payment amount
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          aria-label="Currency"
          className="border-r border-border bg-muted/50 px-2 font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground outline-none"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} ({SYMBOL[c]})
            </option>
          ))}
        </select>
        <input
          id={`amt-${quoteId ?? label}`}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="0.00"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 font-body text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      <Button
        type="button"
        size="sm"
        onClick={handleGenerate}
        disabled={loading}
        className={cn(
          "h-8 w-full rounded-none font-body text-[10px] font-semibold uppercase tracking-[0.14em]",
          copied
            ? "bg-emerald-600 text-white hover:bg-emerald-600"
            : "bg-gold text-accent-foreground hover:bg-gold/90",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Generating
          </>
        ) : copied ? (
          <>
            <Check className="h-3 w-3" /> Link copied
          </>
        ) : (
          <>
            <Zap className="h-3 w-3" /> Generate Stripe link
          </>
        )}
      </Button>

      {paymentUrl && email ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleSendEmail}
          disabled={sendingEmail || emailSent}
          className={cn(
            "h-8 w-full rounded-none border font-body text-[10px] font-semibold uppercase tracking-[0.14em]",
            emailSent
              ? "border-emerald-600 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/10"
              : "border-border bg-background text-foreground hover:bg-muted",
          )}
        >
          {sendingEmail ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Sending email
            </>
          ) : emailSent ? (
            <>
              <Check className="h-3 w-3" /> Email sent
            </>
          ) : (
            <>
              <Mail className="h-3 w-3" /> Send confirmation email
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
};

export default FunnelPayLinkBlock;
