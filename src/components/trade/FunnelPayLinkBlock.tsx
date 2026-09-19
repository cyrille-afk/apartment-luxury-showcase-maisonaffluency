import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, FileText, FlaskConical, Loader2, Mail, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { signedQuotePdfUrl } from "@/lib/publishQuotePdf";

const CURRENCIES = ["USD", "EUR", "GBP", "SGD", "HKD", "AED", "CHF"] as const;
const INTERNAL_COPY_RECIPIENTS = [
  "cyrille@maisonaffluency.com",
  "gregoire@maisonaffluency.com",
];
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
  const queryClient = useQueryClient();
  const [emailSent, setEmailSent] = useState(false);
  const [paymentKind, setPaymentKind] = useState<"full" | "deposit">("full");
  const [testMode, setTestMode] = useState(false);
  const [hasExistingLink, setHasExistingLink] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfChecked, setPdfChecked] = useState(false);

  // Surface whether a formal quote PDF is on file for this quote, so the
  // operator can see before sending whether the email will carry it.
  useEffect(() => {
    if (!quoteId) {
      setPdfChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = await signedQuotePdfUrl(quoteId);
        if (!cancelled) setPdfUrl(url);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setPdfChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  // Cards already carrying a Stripe link (e.g. Awaiting Settlement after a
  // reload) prefill the amount/currency and unlock the resend-email button.
  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("quote_payment_links")
        .select("amount_cents, currency, status")
        .eq("quote_id", quoteId)
        .in("status", ["active", "paid"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setHasExistingLink(true);
      if (data.amount_cents) setAmount((data.amount_cents / 100).toLocaleString("en-US"));
      if (data.currency && CURRENCIES.includes(data.currency as (typeof CURRENCIES)[number])) {
        setCurrency(data.currency);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

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
          label: testMode ? `[TEST] ${label}` : label,
          payerEmail: email,
          quoteId: quoteId ?? null,
          cardId: cardId ?? quoteId ?? null,
          cardStage: cardStage ?? null,
          paymentKind,
          testMode,
          expectedTotalCents: paymentKind === "full" ? Math.round(value * 100) : null,
        },
      });
      if (error) {
        const response = (error as { context?: Response }).context;
        const responseBody = response
          ? ((await response.clone().json().catch(() => null)) as { error?: string } | null)
          : null;
        throw new Error(responseBody?.error ?? error.message);
      }
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
    let url = paymentUrl;
    if (!url) {
      if (!quoteId || !hasExistingLink) {
        toast({ title: "Generate a payment link first", variant: "destructive" });
        return;
      }
      // Re-fetch the stored checkout session URL for this quote.
      try {
        const { data, error } = await supabase.functions.invoke("create-adhoc-payment-link", {
          body: { reuseExisting: true, quoteId, amountCents: 100, currency },
        });
        if (error) {
          const response = (error as { context?: Response }).context;
          const responseBody = response
            ? ((await response.clone().json().catch(() => null)) as { error?: string } | null)
            : null;
          throw new Error(responseBody?.error ?? error.message);
        }
        if (!data?.url) throw new Error(data?.error || "No link returned");
        url = data.url;
        setPaymentUrl(data.url);
      } catch (err) {
        toast({
          title: "Could not recover the payment link",
          description: (err as Error).message,
          variant: "destructive",
        });
        return;
      }
    }
    setSendingEmail(true);
    try {
      // The email system cannot carry binary attachments, so the formal quote
      // PDF travels as a secure 90-day signed download link.
      if (!quoteId) {
        throw new Error("This email requires a formal quote PDF.");
      }
      const quotePdfUrl = await signedQuotePdfUrl(quoteId);
      if (!quotePdfUrl) {
        throw new Error(
          "The formal quote PDF link could not be verified. Open the quote and wait for ‘Client PDF up to date’ before sending.",
        );
      }

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
            paymentLink: url,
            quotePdfUrl,
            maisonRef: maisonRef || (quoteId ? `QU-${quoteId.slice(0, 6).toUpperCase()}` : undefined),
          },
        },
      });
      if (error) throw error;

      const numericAmount = Number(amount.replace(/,/g, "")) || 0;
      const formattedAmount = `${SYMBOL[currency] || currency}${numericAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

      const internalResults = await Promise.all(
        INTERNAL_COPY_RECIPIENTS.map((copyEmail) =>
          supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "quote-confirmation-internal-copy",
              recipientEmail: copyEmail,
              idempotencyKey: `quote-confirm-internal-${quoteId ?? label}-${copyEmail}-${Date.now()}`,
              templateData: {
                clientEmail: email,
                productName: productName || label,
                finish,
                leadTime,
                paymentLink: url,
                quotePdfUrl,
                maisonRef: maisonRef || (quoteId ? `QU-${quoteId.slice(0, 6).toUpperCase()}` : undefined),
                amount: formattedAmount,
                currency,
                paymentKind: paymentKind === "deposit" ? "Deposit · balance to follow" : "Full settlement",
                testMode,
              },
            },
          })
        )
      );

      let internalFailures = internalResults.filter((r) => r.error);
      if (internalFailures.length > 0) {
        // One silent retry — a stale bundle or transient 4xx must not swallow the copy.
        const retry = await Promise.all(
          INTERNAL_COPY_RECIPIENTS.map((copyEmail) =>
            supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "quote-confirmation-internal-copy",
                recipientEmail: copyEmail,
                idempotencyKey: `quote-confirm-internal-retry-${quoteId ?? label}-${copyEmail}-${Date.now()}`,
                templateData: {
                  clientEmail: email,
                  productName: productName || label,
                  finish,
                  leadTime,
                  paymentLink: url,
                  quotePdfUrl,
                  maisonRef: maisonRef || (quoteId ? `QU-${quoteId.slice(0, 6).toUpperCase()}` : undefined),
                  amount: formattedAmount,
                  currency,
                  paymentKind: paymentKind === "deposit" ? "Deposit · balance to follow" : "Full settlement",
                  testMode,
                },
              },
            })
          )
        );
        internalFailures = retry.filter((r) => r.error);
      }
      if (internalFailures.length > 0) {
        console.warn("Internal copy failures", internalFailures);
        toast({
          title: "Your internal copy did not send",
          description:
            "The client email went out, but the copy to Cyrille and Gregoire failed. Reload the page and resend.",
          variant: "destructive",
        });
      }


      // Move the quote out of "Action Required" into "Awaiting Settlement"
      if (quoteId) {
        const { error: statusError } = await supabase
          .from("trade_quotes")
          .update({ status: "submitted", submitted_at: new Date().toISOString() })
          .eq("id", quoteId)
          .eq("status", "draft");
        if (statusError) {
          console.warn("Could not update quote status", statusError);
        } else {
          queryClient.invalidateQueries({ queryKey: ["sales-funnel"] });
        }
      }

      setEmailSent(true);
      toast({
        title: "Confirmation email sent",
        description: [
          "Secure formal quote PDF download link included.",
          internalFailures.length === 0
            ? "Internal copy sent to Cyrille and Gregoire."
            : "Internal copy failed for some recipients.",
        ].join(" "),
      });
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

      <select
        value={paymentKind}
        onChange={(e) => setPaymentKind(e.target.value as "full" | "deposit")}
        aria-label="Payment type"
        className="w-full border border-border bg-background px-2 py-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground outline-none focus:border-gold"
      >
        <option value="full">Full settlement</option>
        <option value="deposit">Deposit · balance to follow</option>
      </select>

      <label
        className={cn(
          "flex cursor-pointer items-center gap-2 border px-2 py-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.1em]",
          testMode
            ? "border-amber-500/60 bg-amber-500/10 text-amber-700"
            : "border-border bg-background text-muted-foreground",
        )}
      >
        <input
          type="checkbox"
          checked={testMode}
          onChange={(e) => setTestMode(e.target.checked)}
          className="h-3 w-3 accent-amber-600"
        />
        Test mode · card 4242 4242 4242 4242
      </label>

      <Button
        type="button"
        size="sm"
        onClick={handleGenerate}
        disabled={loading}
        className={cn(
          "h-8 w-full rounded-none font-body text-[10px] font-semibold uppercase tracking-[0.14em]",
          copied
            ? "bg-emerald-600 text-white hover:bg-emerald-600"
            : testMode
              ? "bg-amber-600 text-white hover:bg-amber-600/90"
              : "bg-gold text-accent-foreground hover:bg-gold/90",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Generating
          </>
        ) : copied ? (
          <>
            <Check className="h-3 w-3" /> Link copied · not sent yet
          </>
        ) : (
          <>
            <Zap className="h-3 w-3" /> {testMode ? "Generate test link" : "Generate Stripe link"}
          </>
        )}
      </Button>

      {paymentUrl ? (
        <div
          className={cn(
            "space-y-1 border px-2 py-1.5 font-body text-[10px]",
            paymentUrl.includes("cs_test_") || testMode
              ? "border-amber-500/60 bg-amber-500/10 text-amber-700"
              : "border-emerald-600/50 bg-emerald-600/10 text-emerald-700",
          )}
        >
          <div className="font-semibold uppercase tracking-[0.1em]">
            {paymentUrl.includes("cs_test_") || testMode
              ? "Test link created — no real payment possible"
              : "Live link created — nothing emailed yet"}
          </div>
          <a href={paymentUrl} target="_blank" rel="noreferrer" className="block break-all underline">
            {paymentUrl}
          </a>
        </div>
      ) : null}


      {quoteId && pdfChecked ? (
        <div
          className={cn(
            "flex items-center justify-between gap-2 border px-2 py-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.1em]",
            pdfUrl
              ? "border-emerald-600/50 bg-emerald-600/10 text-emerald-700"
              : "border-amber-500/60 bg-amber-500/10 text-amber-700",
          )}
        >
          <span className="flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            {pdfUrl ? "Quote PDF link ready" : "No quote PDF link"}
          </span>
          {pdfUrl ? (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="underline">
              View
            </a>
          ) : (
            <a href={`/trade/quotes?quote=${quoteId}`} className="underline">
              Publish
            </a>
          )}
        </div>
      ) : null}

      {(paymentUrl || (quoteId && hasExistingLink)) && email ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleSendEmail}
          disabled={sendingEmail || emailSent || !pdfChecked || !pdfUrl}
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
