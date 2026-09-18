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

type CredentialDraft = Record<FieldKey, string>;

// Keep an unfinished credential set only in this tab's JavaScript memory.
// This survives route/auth remounts without writing sensitive values to
// localStorage or sessionStorage, and disappears on a real browser refresh.
let credentialDraft: CredentialDraft = {
  publishableKey: "",
  secretKey: "",
  webhookSecret: "",
};

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

type TestFieldKey = "testPublishableKey" | "testSecretKey" | "testWebhookSecret";

const TEST_FIELDS: { key: TestFieldKey; label: string; hint: string; placeholder: string }[] = [
  {
    key: "testPublishableKey",
    label: "Test Publishable Key",
    hint: "Stripe Dashboard (test mode) → Developers → API keys",
    placeholder: "pk_test_…",
  },
  {
    key: "testSecretKey",
    label: "Test Secret Key",
    hint: "Required for the Test mode toggle on funnel cards",
    placeholder: "sk_test_…",
  },
  {
    key: "testWebhookSecret",
    label: "Test Webhook Signing Secret",
    hint: "Optional — only if you add a test-mode webhook endpoint in Stripe",
    placeholder: "whsec_…",
  },
];

export default function TradeAdminPaymentSettings() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: status, isLoading, refetch } = usePaymentMode(isAdmin);

  const [values, setValues] = useState<CredentialDraft>(() => ({ ...credentialDraft }));
  const [revealed, setRevealed] = useState<Record<FieldKey, boolean>>({
    publishableKey: false,
    secretKey: false,
    webhookSecret: false,
  });
  const [saving, setSaving] = useState(false);
  const [savingField, setSavingField] = useState<FieldKey | null>(null);
  const [savedFields, setSavedFields] = useState<Record<FieldKey, boolean>>({
    publishableKey: false,
    secretKey: false,
    webhookSecret: false,
  });
  const [copied, setCopied] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);

  const [testValues, setTestValues] = useState<Record<TestFieldKey, string>>({
    testPublishableKey: "",
    testSecretKey: "",
    testWebhookSecret: "",
  });
  const [testRevealed, setTestRevealed] = useState<Record<TestFieldKey, boolean>>({
    testPublishableKey: false,
    testSecretKey: false,
    testWebhookSecret: false,
  });
  const [savingTestField, setSavingTestField] = useState<TestFieldKey | null>(null);
  const [savedTestFields, setSavedTestFields] = useState<Record<TestFieldKey, boolean>>({
    testPublishableKey: false,
    testSecretKey: false,
    testWebhookSecret: false,
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const save = async () => {
    setAttemptedSave(true);
    const missingField = FIELDS.find((field) => !values[field.key].trim() && !status?.[field.key]);
    const invalidField = FIELDS.find((field) => fieldError(field.key));
    if (missingField || invalidField) {
      const field = missingField ?? invalidField;
      toast({
        title: "Check the highlighted field",
        description: field
          ? `${field.label}: ${missingField ? "This value is required." : fieldError(field.key)}`
          : "Check the three Stripe values.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Save only the boxes that contain a value — keys already stored on the
      // server stay untouched instead of failing "required" validation.
      const filledFields = FIELDS.filter((f) => values[f.key].trim());
      for (const f of filledFields) {
        const { data, error } = await supabase.functions.invoke("payment-credentials", {
          body: { action: "save_field", field: f.key, value: values[f.key] },
        });
        if (error) {
          const response = (error as { context?: Response }).context;
          const responseBody = response
            ? await response.clone().json().catch(() => null) as { error?: string } | null
            : null;
          throw new Error(responseBody?.error ?? error.message);
        }
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      }
      credentialDraft = { publishableKey: "", secretKey: "", webhookSecret: "" };
      setValues({ ...credentialDraft });
      setAttemptedSave(false);
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

  const saveField = async (key: FieldKey) => {
    setAttemptedSave(true);
    const problem = !values[key].trim() ? "This value is required." : fieldError(key);
    if (problem) {
      toast({ title: `Check ${FIELDS.find((field) => field.key === key)?.label}`, description: problem, variant: "destructive" });
      return;
    }
    setSavingField(key);
    try {
      const { data, error } = await supabase.functions.invoke("payment-credentials", {
        body: { action: "save_field", field: key, value: values[key] },
      });
      if (error) {
        const response = (error as { context?: Response }).context;
        const responseBody = response
          ? await response.clone().json().catch(() => null) as { error?: string } | null
          : null;
        throw new Error(responseBody?.error ?? error.message);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      credentialDraft = { ...credentialDraft, [key]: "" };
      setValues((current) => ({ ...current, [key]: "" }));
      // A key saved individually must not linger in "attempted save" state —
      // the now-empty box would otherwise show "This value is required".
      setAttemptedSave(false);
      setSavedFields((current) => ({ ...current, [key]: true }));
      setTimeout(() => setSavedFields((current) => ({ ...current, [key]: false })), 4000);
      await refetch();
      await qc.invalidateQueries({ queryKey: ["payment-mode"] });
      toast({ title: `${FIELDS.find((field) => field.key === key)?.label} saved securely` });
    } catch (e) {
      toast({
        title: "Could not save this key",
        description: e instanceof Error ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setSavingField(null);
    }
  };

  const testFieldError = (key: TestFieldKey): string | null => {
    const raw = testValues[key].replace(/\s/g, "");
    if (!raw) return null;
    if (key === "testPublishableKey" && !raw.startsWith("pk_test_")) {
      return "Must start with pk_test_ — toggle Stripe to test mode first.";
    }
    if (key === "testSecretKey" && !/^(sk|rk)_test_/.test(raw)) {
      return "Must start with sk_test_ (or rk_test_ for a restricted key).";
    }
    if (key === "testWebhookSecret" && !raw.startsWith("whsec_")) {
      return "Must start with whsec_.";
    }
    return null;
  };

  const saveTestField = async (key: TestFieldKey) => {
    const problem = !testValues[key].trim() ? "This value is required." : testFieldError(key);
    if (problem) {
      toast({ title: `Check ${TEST_FIELDS.find((f) => f.key === key)?.label}`, description: problem, variant: "destructive" });
      return;
    }
    setSavingTestField(key);
    try {
      const { data, error } = await supabase.functions.invoke("payment-credentials", {
        body: { action: "save_field", field: key, value: testValues[key] },
      });
      if (error) {
        const response = (error as { context?: Response }).context;
        const responseBody = response
          ? ((await response.clone().json().catch(() => null)) as { error?: string } | null)
          : null;
        throw new Error(responseBody?.error ?? error.message);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setTestValues((current) => ({ ...current, [key]: "" }));
      setSavedTestFields((current) => ({ ...current, [key]: true }));
      setTimeout(() => setSavedTestFields((current) => ({ ...current, [key]: false })), 4000);
      await refetch();
      toast({ title: `${TEST_FIELDS.find((f) => f.key === key)?.label} saved securely` });
    } catch (e) {
      toast({
        title: "Could not save this key",
        description: e instanceof Error ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setSavingTestField(null);
    }
  };

  const copyWebhook = async () => {
    if (!status?.webhookUrl) return;
    await navigator.clipboard.writeText(status.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const fieldError = (key: FieldKey): string | null => {
    const raw = values[key].replace(/\s/g, "");
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
  // A live key injected into the runtime wins outright; the toggle is then locked on.
  const envLocked = Boolean(status?.envLiveKey);
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
            {!isLoading && (
              <p className="mt-1 font-body text-xs text-muted-foreground">
                {status?.activeSource === "env"
                  ? "Injected from Environment Variables"
                  : status?.activeSource === "payment_settings"
                    ? "Loaded from Saved Database Settings"
                    : "No keys configured"}
                {status?.activeSource === "env" && status?.publishableKeyAlias
                  ? ` · ${status.publishableKeyAlias}`
                  : ""}
              </p>
            )}
            {!isLoading && !status?.liveMode && (
              <p className="mt-1 font-body text-xs text-muted-foreground">
                No live secret key resolved — all charges stay in Stripe test mode.
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <span className="font-body text-xs text-muted-foreground">Live mode</span>
              <Switch
                checked={envLocked ? true : Boolean(status?.savedLiveEnabled ?? status?.liveMode)}
                disabled={envLocked}
                title={envLocked ? "Live mode is locked via infrastructure environment variables." : undefined}
                onCheckedChange={toggleLiveMode}
              />
            </div>
            {envLocked && (
              <span
                title="Live mode is locked via infrastructure environment variables."
                className="inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--jade))]/40 bg-[hsl(var(--jade))]/10 px-2 py-1 font-body text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--jade))]"
              >
                <Lock className="h-3 w-3" /> Locked by environment
              </span>
            )}
          </div>
        </div>

        {!isLoading && envLocked && (
          <p className="mt-3 rounded-sm border border-border/70 bg-background px-3 py-2 font-body text-xs text-muted-foreground">
            Live mode is locked via infrastructure environment variables (<code>STRIPE_SECRET_KEY</code>). Saved
            database keys are ignored while it is present.
          </p>
        )}

        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-sm border border-border/70 bg-background px-3 py-2">
            <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Environment status
            </dt>
            <dd className="mt-1 font-body text-sm">
              {status?.envKeyPresent
                ? status?.envLiveKey
                  ? "Active key · live"
                  : "Active key · test"
                : "Missing"}
            </dd>
          </div>
          <div className="rounded-sm border border-border/70 bg-background px-3 py-2">
            <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Saved status</dt>
            <dd className="mt-1 font-body text-sm">
              {status?.savedLiveConfigured
                ? status?.savedLiveEnabled
                  ? "Configured · enabled"
                  : "Configured · switched off"
                : "Not configured"}
            </dd>
          </div>
          <div className="rounded-sm border border-border/70 bg-background px-3 py-2">
            <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Webhook status</dt>
            <dd className="mt-1 font-body text-sm">
              {status?.webhookStatus === "connected"
                ? "Connected"
                : status?.webhookStatus === "mismatched"
                  ? "Mismatched · secret belongs to the other mode"
                  : "Failed · no signing secret"}
            </dd>
          </div>
        </dl>

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
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <Input
                  id={f.key}
                  type={revealed[f.key] ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={f.placeholder}
                  value={values[f.key]}
                  onChange={(e) => {
                    const nextValue = e.target.value.replace(/\s/g, "");
                    setValues((current) => {
                      const next = { ...current, [f.key]: nextValue };
                      credentialDraft = next;
                      return next;
                    });
                  }}
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
                <Button
                  type="button"
                  variant="outline"
                  disabled={!values[f.key].trim() || savingField !== null || saving}
                  onClick={() => saveField(f.key)}
                  className="shrink-0 font-body text-xs"
                >
                  {savingField === f.key ? "Saving…" : "Save key"}
                </Button>
              </div>
              <p
                className={`mt-1 font-body text-xs ${
                  fieldError(f.key) || (attemptedSave && !values[f.key].trim() && !status?.[f.key])
                    ? "text-destructive"
                    : savedFields[f.key]
                      ? "text-[hsl(var(--jade))]"
                      : "text-muted-foreground"
                }`}
              >
                {fieldError(f.key) ??
                  (savedFields[f.key]
                    ? "Saved ✓ stored securely — the box is intentionally blank."
                    : attemptedSave && !values[f.key].trim() && !status?.[f.key]
                      ? "This value is required."
                      : f.hint)}
              </p>
            </div>
          ))}
        </div>

        <Button
          onClick={save}
          disabled={saving}
          className="mt-6 w-full bg-[hsl(var(--jade))] font-body text-sm tracking-[0.08em] text-primary-foreground hover:bg-[hsl(var(--jade))]/90 sm:w-auto"
        >
          <Lock className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : status?.liveMode ? "Replace All Production Credentials" : "Save All Production Credentials"}
        </Button>
        {!complete && !saving && (
          <p className="mt-3 font-body text-xs text-muted-foreground">
            {invalid
              ? "Fix the highlighted value, then press Save again."
              : "Enter all three values, then press Save. Any problem will be identified precisely."}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-sm border border-amber-500/40 bg-card p-6">
        <h2 className="font-display text-xl">Test credentials</h2>
        <p className="mt-2 max-w-xl font-body text-sm text-muted-foreground">
          Saved separately from live keys. With a test secret key stored, every funnel card gains a{" "}
          <span className="text-foreground">Test mode</span> toggle that generates Stripe test-mode checkout
          links — safe with dummy cards such as 4242 4242 4242 4242.
        </p>
        <div className="mt-5 space-y-5">
          {TEST_FIELDS.map((f) => (
            <div key={f.key}>
              <Label htmlFor={f.key} className="font-body text-xs uppercase tracking-[0.16em]">
                {f.label}
              </Label>
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id={f.key}
                    type={testRevealed[f.key] ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={f.placeholder}
                    value={testValues[f.key]}
                    onChange={(e) =>
                      setTestValues((current) => ({ ...current, [f.key]: e.target.value.replace(/\s/g, "") }))
                    }
                    className="pr-10 font-body"
                  />
                  <button
                    type="button"
                    aria-label={testRevealed[f.key] ? "Hide value" : "Reveal value"}
                    onClick={() => setTestRevealed((r) => ({ ...r, [f.key]: !r[f.key] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {testRevealed[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!testValues[f.key].trim() || savingTestField !== null}
                  onClick={() => saveTestField(f.key)}
                  className="shrink-0 font-body text-xs"
                >
                  {savingTestField === f.key ? "Saving…" : "Save key"}
                </Button>
              </div>
              <p
                className={`mt-1 font-body text-xs ${
                  testFieldError(f.key)
                    ? "text-destructive"
                    : savedTestFields[f.key]
                      ? "text-[hsl(var(--jade))]"
                      : "text-muted-foreground"
                }`}
              >
                {testFieldError(f.key) ??
                  (savedTestFields[f.key]
                    ? "Saved ✓ stored securely — the box is intentionally blank."
                    : status?.[f.key]
                      ? `Configured: ${status[f.key]}`
                      : f.hint)}
              </p>
            </div>
          ))}
        </div>
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
