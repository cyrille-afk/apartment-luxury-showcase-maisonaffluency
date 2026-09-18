import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePaymentMode } from "@/hooks/usePaymentMode";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type FieldKey = "publishableKey" | "secretKey" | "webhookSecret";

const FIELDS: { key: FieldKey; label: string; hint: string; placeholder: string }[] = [
  {
    key: "publishableKey",
    label: "Live Publishable Key",
    hint: "Stripe Dashboard → Developers → API keys",
    placeholder: "pk_live_…",
  },
  {
    key: "secretKey",
    label: "Live Secret Key",
    hint: "Never shared outside this secure form",
    placeholder: "sk_live_…",
  },
  {
    key: "webhookSecret",
    label: "Stripe Webhook Signing Secret",
    hint: "Stripe Dashboard → Developers → Webhooks → your endpoint",
    placeholder: "whsec_…",
  },
];

export default function TradeAdminPaymentSettings() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: status, isLoading, refetch } = usePaymentMode(isAdmin);

  const [values, setValues] = useState<Record<FieldKey, string>>({
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
  });
  const [revealed, setRevealed] = useState<Record<FieldKey, boolean>>({
    publishableKey: false,
    secretKey: false,
    webhookSecret: false,
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-credentials", {
        body: {
          action: "save",
          publishableKey: values.publishableKey.trim(),
          secretKey: values.secretKey.trim(),
          webhookSecret: values.webhookSecret.trim(),
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setValues({ publishableKey: "", secretKey: "", webhookSecret: "" });
      await refetch();
      await qc.invalidateQueries({ queryKey: ["payment-mode"] });
      toast({ title: "Production credentials saved", description: "Live Stripe mode is now active." });
    } catch (e) {
      toast({
        title: "Could not save credentials",
        description: e instanceof Error ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleLiveMode = async (next: boolean) => {
    try {
      const { error } = await supabase.functions.invoke("payment-credentials", {
        body: { action: "set_mode", liveMode: next },
      });
      if (error) throw error;
      await refetch();
      await qc.invalidateQueries({ queryKey: ["payment-mode"] });
    } catch (e) {
      toast({
        title: "Could not change mode",
        description: e instanceof Error ? e.message : "Unexpected error",
        variant: "destructive",
      });
    }
  };

  const copyWebhook = async () => {
    if (!status?.webhookUrl) return;
    await navigator.clipboard.writeText(status.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const fieldError = (key: FieldKey): string | null => {
    const raw = values[key].trim();
    if (!raw) return null;
    if (key === "publishableKey" && !raw.startsWith("pk_live_")) {
      return raw.startsWith("pk_test_")
        ? "That is a test key — paste the pk_live_ key from Stripe's live mode."
        : "Must start with pk_live_ (check the value is in the right box).";
    }
    if (key === "secretKey" && !/^(sk|rk)_live_/.test(raw)) {
      return raw.startsWith("sk_test_")
        ? "That is a test key — switch Stripe to live mode and copy the sk_live_ key."
        : "Must start with sk_live_ (or rk_live_ for a restricted key).";
    }
    if (key === "webhookSecret" && !raw.startsWith("whsec_")) {
      return "Must start with whsec_ — create the webhook endpoint in Stripe first.";
    }
    return null;
  };

  const filled = FIELDS.every((f) => values[f.key].trim().length > 8);
  const invalid = FIELDS.some((f) => fieldError(f.key));
  const complete = filled && !invalid;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <Helmet>
        <title>Payment Settings | Maison Affluency Trade</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Link
        to="/trade/admin/sales-funnel"
        className="inline-flex items-center gap-2 font-body text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sales funnel
      </Link>

      <header className="mt-6 border-b border-border pb-6">
        <h1 className="font-display text-3xl tracking-tight">Payment Settings</h1>
        <p className="mt-2 max-w-xl font-body text-sm text-muted-foreground">
          Production Stripe credentials for the trade portal. Values are stored encrypted at rest and are never
          returned to the browser — only a masked fingerprint is shown.
        </p>
      </header>

      <section className="mt-8 rounded-sm border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-body text-xs uppercase tracking-[0.18em] text-muted-foreground">Current mode</p>
            <p className="mt-1 font-display text-xl">
              {isLoading ? "Checking…" : status?.liveMode ? "Live production" : "Test / sandbox"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-body text-xs text-muted-foreground">Live mode</span>
            <Switch checked={Boolean(status?.liveMode)} onCheckedChange={toggleLiveMode} />
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="rounded-sm border border-border/70 bg-background px-3 py-2">
              <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{f.label}</dt>
              <dd className="mt-1 font-body text-sm">
                {status?.[f.key] ? (
                  <span className="inline-flex items-center gap-1.5 text-[hsl(var(--jade))]">
                    <ShieldCheck className="h-3.5 w-3.5" /> {status[f.key]}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not configured</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6 rounded-sm border border-border bg-card p-6">
        <h2 className="font-display text-xl">Production credentials</h2>
        <div className="mt-5 space-y-5">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <Label htmlFor={f.key} className="font-body text-xs uppercase tracking-[0.16em]">
                {f.label}
              </Label>
              <div className="relative mt-2">
                <Input
                  id={f.key}
                  type={revealed[f.key] ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={f.placeholder}
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="pr-10 font-body"
                />
                <button
                  type="button"
                  aria-label={revealed[f.key] ? "Hide value" : "Reveal value"}
                  onClick={() => setRevealed((r) => ({ ...r, [f.key]: !r[f.key] }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {revealed[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p
                className={`mt-1 font-body text-xs ${fieldError(f.key) ? "text-destructive" : "text-muted-foreground"}`}
              >
                {fieldError(f.key) ?? f.hint}
              </p>
            </div>
          ))}
        </div>

        <Button
          onClick={save}
          disabled={!complete || saving}
          className="mt-6 w-full bg-[hsl(var(--jade))] font-body text-sm tracking-[0.08em] text-primary-foreground hover:bg-[hsl(var(--jade))]/90 sm:w-auto"
        >
          <Lock className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save Production Credentials"}
        </Button>
        {!complete && !saving && (
          <p className="mt-3 font-body text-xs text-muted-foreground">
            {invalid
              ? "Fix the highlighted values above to enable saving."
              : "All three values are required before saving."}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-sm border border-border bg-card p-6">
        <h2 className="font-display text-xl">Production webhook endpoint</h2>
        <p className="mt-2 font-body text-sm text-muted-foreground">
          Add this URL in Stripe → Developers → Webhooks, subscribing to
          <span className="text-foreground"> checkout.session.completed</span> and
          <span className="text-foreground"> payment_intent.succeeded</span>. Every event is signature-verified with
          the signing secret above before any pipeline card moves.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 overflow-x-auto rounded-sm border border-border bg-background px-3 py-2 font-mono text-xs">
            {status?.webhookUrl ?? "…"}
          </code>
          <Button variant="outline" onClick={copyWebhook} className="font-body text-xs">
            {copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy URL"}
          </Button>
        </div>
      </section>
    </div>
  );
}
