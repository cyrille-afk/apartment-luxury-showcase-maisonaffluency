import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AuditResult = {
  mode: "live" | "test";
  session: {
    id: string;
    status: string | null;
    paymentStatus: string | null;
    amountTotal: number | null;
    currency: string | null;
    zeroDecimal?: boolean;
    email: string | null;
    receiptEmail?: string | null;
  };
  orderRecorded: boolean;
  orderLookupFailed?: boolean;
  order: {
    product_name: string;
    amount_total: number;
    currency: string;
    status: string;
    customer_email: string | null;
    created_at: string;
  } | null;
};

const CURRENCIES = ["hkd", "usd", "eur", "gbp", "sgd", "aed"];
const STORAGE_KEY = "ma_dev_checkout_mode";

export default function DevCheckoutTest() {
  const { isAdmin, isSuperAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const [testMode, setTestMode] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem(STORAGE_KEY) !== "live";
  });
  const [currency, setCurrency] = useState("hkd");
  const [launching, setLaunching] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollRef = useRef<number | null>(null);

  const rawSession = params.get("session_id");
  const returnedSession = rawSession && /^cs_(test|live)_[A-Za-z0-9]{10,}$/.test(rawSession)
    ? rawSession
    : null;
  const malformedSession = Boolean(rawSession) && !returnedSession;
  const cancelled = params.get("cancelled") === "1";

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, testMode ? "test" : "live");
  }, [testMode]);

  const runAudit = useCallback(
    async (sessionId: string, silent = false) => {
      if (!silent) setAuditing(true);
      try {
        const { data, error } = await supabase.functions.invoke("dev-checkout-test", {
          body: { action: "audit", sessionId, testMode: sessionId.startsWith("cs_test_") },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setAudit(data as AuditResult);
        setAuditError(null);
        return data as AuditResult;
      } catch (err: any) {
        // Transient network / cold-start failures must not blank the panel —
        // keep the last good reading and surface the problem inline.
        setAuditError(err?.message || "Unable to audit this session.");
        return null;
      } finally {
        if (!silent) setAuditing(false);
      }
    },
    [],
  );

  // Post-redirect: audit the returned session and poll until the webhook lands.
  // Webhook delivery is eventually consistent, so absence of an order row is a
  // "still waiting" state, never an error.
  useEffect(() => {
    if (!returnedSession || !(isAdmin || isSuperAdmin)) return;
    let attempts = 0;
    let stopped = false;
    setTimedOut(false);
    setWaiting(true);

    const stop = () => {
      stopped = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      setWaiting(false);
    };

    void runAudit(returnedSession).then((first) => {
      if (!stopped && first?.orderRecorded) stop();
    });

    pollRef.current = window.setInterval(async () => {
      attempts += 1;
      const result = await runAudit(returnedSession, true);
      if (result?.orderRecorded) {
        stop();
      } else if (attempts >= 10) {
        setTimedOut(true);
        stop();
      }
    }, 3000);

    return () => {
      stopped = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [returnedSession, isAdmin, isSuperAdmin, runAudit]);

  const launch = async () => {
    setLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("dev-checkout-test", {
        body: { action: "checkout", testMode, currency },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any)?.url as string | undefined;
      if (!url || !/^https:\/\/checkout\.stripe\.com\//.test(url)) {
        throw new Error("Stripe returned an unusable checkout URL.");
      }
      window.location.href = url;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Checkout could not start",
        description: err?.message || "Unknown error.",
      });
      setLaunching(false);
    }
  };

  if (loading) return null;
  if (!isAdmin && !isSuperAdmin) return <Navigate to="/" replace />;

  const amountLabel = currency === "hkd" ? "10.00" : currency === "aed" ? "10.00" : "2.00";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Checkout Diagnostics — Maison Affluency</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <main className="mx-auto max-w-2xl px-5 py-16">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Internal</p>
        <h1 className="mt-2 font-serif text-3xl">Storefront Checkout Diagnostics</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Runs a real Checkout Session against the direct storefront pipeline and confirms the order
          is written to the database after the redirect. No emails or documents are generated here.
        </p>

        {/* Mode */}
        <section className="mt-10 rounded-lg border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">{testMode ? "Test Mode" : "Live Mode"}</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {testMode
                  ? "Uses test keys. Pay with 4242 4242 4242 4242; 4000 0000 0000 0002 to force a decline."
                  : "Uses live keys. A real card will be charged."}
              </p>
            </div>
            <Switch checked={!testMode} onCheckedChange={(v) => setTestMode(!v)} />
          </div>

          {!testMode && (
            <div className="mt-4 flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Live mode charges a real card {amountLabel} {currency.toUpperCase()} for a hidden
                internal verification product. Refund it in Stripe after the audit.
              </span>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="mt-1 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={launch} disabled={launching} className="gap-2">
              {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Run {testMode ? "test" : "live"} checkout · {amountLabel} {currency.toUpperCase()}
            </Button>
          </div>
        </section>

        {cancelled && (
          <p className="mt-6 text-sm text-muted-foreground">
            Checkout was cancelled — nothing was charged. You can run it again above.
          </p>
        )}

        {malformedSession && (
          <p className="mt-6 text-sm text-destructive">
            The returned session reference is not a valid Stripe session id, so no audit was run.
          </p>
        )}

        {/* Audit */}
        {returnedSession && (
          <section className="mt-8 rounded-lg border border-border p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.2em]">Post-purchase audit</h2>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                disabled={auditing}
                onClick={() => {
                  setTimedOut(false);
                  void runAudit(returnedSession);
                }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${auditing ? "animate-spin" : ""}`} />
                Re-check
              </Button>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Session" value={returnedSession} mono />
              <Row label="Stripe status" value={audit?.session?.paymentStatus ?? "…"} />
              <Row
                label="Amount"
                value={
                  audit?.session?.amountTotal != null
                    ? `${formatAmount(audit.session.amountTotal, audit.session.zeroDecimal)} ${(audit.session.currency ?? "").toUpperCase()}`
                    : "…"
                }
              />
              <Row label="Buyer" value={audit?.session?.email ?? "…"} />
              <Row
                label="Stripe receipt email"
                value={audit?.session?.receiptEmail ?? audit?.session?.email ?? "…"}
              />
              <Row
                label="Order in database"
                value={
                  audit
                    ? audit.orderRecorded
                      ? `Recorded · ${audit.order?.status}`
                      : timedOut
                        ? "Not recorded yet"
                        : "Waiting for webhook…"
                    : "…"
                }
              />
            </dl>

            {!audit?.orderRecorded && waiting && (
              <div className="mt-5 flex items-center gap-2 rounded border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for Stripe to confirm the order in the database — this usually takes a few
                seconds.
              </div>
            )}

            {!audit?.orderRecorded && timedOut && (
              <div className="mt-5 flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  The payment is recorded at Stripe but no order row appeared within 30 seconds.
                  Use Re-check; if it stays empty the webhook is not reaching the site.
                </span>
              </div>
            )}

            {audit?.orderLookupFailed && (
              <p className="mt-4 text-sm text-destructive">
                The order lookup itself failed — the database could not be read.
              </p>
            )}

            {audit?.orderRecorded && (
              <div className="mt-5 flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                Pipeline verified end to end — redirect, session and order record all match.
              </div>
            )}

            {auditError && (
              <p className="mt-4 text-sm text-destructive">{auditError}</p>
            )}

            <Button
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={() => {
                params.delete("session_id");
                params.delete("cancelled");
                setParams(params, { replace: true });
                setAudit(null);
                setAuditError(null);
                setTimedOut(false);
              }}
            >
              Clear
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/50 pb-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`text-right ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</dd>
    </div>
  );
}
