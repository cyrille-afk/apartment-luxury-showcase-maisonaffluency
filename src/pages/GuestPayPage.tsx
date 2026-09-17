import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type LinkInfo = {
  quoteNumber: string;
  clientName: string | null;
  amountCents: number;
  currency: string;
  label: string;
};

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", SGD: "S$", HKD: "HK$" };

const formatAmount = (cents: number, currency: string) =>
  `${currency} ${SYMBOLS[currency] ?? ""}${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function GuestPayPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const paymentState = searchParams.get("payment");

  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: fnError } = await supabase.functions.invoke("guest-quote-checkout", {
        body: { token, action: "info" },
      });
      if (cancelled) return;
      if (fnError || !data || (data as { error?: string }).error) {
        setError((data as { error?: string } | null)?.error ?? "This payment link is not valid.");
      } else {
        setInfo(data as LinkInfo);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handlePay = async () => {
    setRedirecting(true);
    const { data, error: fnError } = await supabase.functions.invoke("guest-quote-checkout", {
      body: { token, action: "checkout" },
    });
    const url = (data as { url?: string } | null)?.url;
    if (fnError || !url) {
      setError((data as { error?: string } | null)?.error ?? "Could not open the secure payment page.");
      setRedirecting(false);
      return;
    }
    window.location.href = url;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-16">
      <Helmet>
        <title>Secure Payment · Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="w-full max-w-md border border-border rounded-lg p-7 md:p-9 bg-card">
        <p className="font-display text-[11px] uppercase tracking-[0.35em] text-muted-foreground mb-6">
          Maison Affluency
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground font-body text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your payment details…
          </div>
        ) : paymentState === "success" ? (
          <div className="space-y-3">
            <CheckCircle2 className="h-7 w-7 text-primary" />
            <h1 className="font-display text-lg text-foreground">Payment received</h1>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              Thank you. Your payment has been confirmed and our team has been notified. A receipt has been
              emailed to you.
            </p>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <h1 className="font-display text-lg text-foreground">Payment unavailable</h1>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">{error}</p>
            <p className="font-body text-xs text-muted-foreground">
              Please contact your Maison Affluency advisor for an updated link.
            </p>
          </div>
        ) : info ? (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-xl text-foreground mb-1">{info.label}</h1>
              <p className="font-body text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Quote {info.quoteNumber}
                {info.clientName ? ` · ${info.clientName}` : ""}
              </p>
            </div>

            <div className="border-t border-b border-border py-5">
              <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Amount due
              </p>
              <p className="font-display text-2xl text-foreground">
                {formatAmount(info.amountCents, info.currency)}
              </p>
            </div>

            {paymentState === "cancelled" && (
              <p className="font-body text-xs text-muted-foreground">
                Payment was cancelled — you can try again below.
              </p>
            )}

            <button
              onClick={handlePay}
              disabled={redirecting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {redirecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {redirecting ? "Opening secure checkout…" : "Pay now"}
            </button>

            <p className="font-body text-[10px] text-muted-foreground text-center leading-relaxed">
              Payments are processed securely by Stripe. No account or sign-in required.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
