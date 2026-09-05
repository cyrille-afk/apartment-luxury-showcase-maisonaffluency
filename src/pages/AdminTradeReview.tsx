import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import CredentialDocumentViewer from "@/components/admin/CredentialDocumentViewer";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AlertTriangle, Check, ExternalLink, FileText, Loader2, RefreshCw, X } from "lucide-react";
import OrderLedger from "@/components/admin/OrderLedger";

interface FlaggedApplication {
  id: string;
  user_id: string;
  status: string;
  company_name: string | null;
  company_website: string | null;
  job_title: string | null;
  country: string | null;
  city: string | null;
  instagram_handle: string | null;
  tax_vat_id: string | null;
  credential_document_path: string | null;
  verification_notes: string | null;
  last_verification_error: string | null;
  verification_attempts: number | null;
  ai_confidence: number | null;
  ai_result: Record<string, unknown> | null;
  ai_verified_at: string | null;
  created_at: string;
  profiles?: { first_name: string | null; last_name: string | null; email: string | null } | null;
}

const REVIEW_STATUSES = ["flagged_for_review", "flagged", "system_retry"];

type Filter = "flagged" | "all" | "approved" | "rejected";

const FILTER_LABELS: Record<Filter, string> = {
  flagged: "Flagged for review",
  all: "All",
  approved: "Approved",
  rejected: "Rejected",
};

function applicantName(app: FlaggedApplication) {
  return `${app.profiles?.first_name ?? ""} ${app.profiles?.last_name ?? ""}`.trim() || "Unknown applicant";
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null)
    return <span className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">No score</span>;
  const tone =
    score < 40
      ? "bg-destructive/12 text-destructive"
      : score < 85
        ? "bg-warning/15 text-warning"
        : "bg-primary/10 text-primary";
  return (
    <span className={`inline-flex items-baseline gap-1 px-2 py-1 font-body text-[10px] uppercase tracking-[0.2em] ${tone}`}>
      {score}
      <span className="opacity-60">/100</span>
    </span>
  );
}

export default function AdminTradeReview() {
  const { isAdmin, loading, user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"queue" | "orders">("queue");
  const [filter, setFilter] = useState<Filter>("flagged");
  const [apps, setApps] = useState<FlaggedApplication[]>([]);
  const [fetching, setFetching] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ pending: number; approved: number; avg: number | null }>({
    pending: 0,
    approved: 0,
    avg: null,
  });

  const fetchApps = useCallback(async () => {
    setFetching(true);
    let query = supabase.from("trade_applications").select("*").order("created_at", { ascending: false });
    if (filter === "flagged") query = query.in("status", REVIEW_STATUSES as never[]);
    else if (filter !== "all") query = query.eq("status", filter as never);
    const { data } = await query;

    const rows = ((data as unknown as FlaggedApplication[]) || []);
    const ids = [...new Set(rows.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", ids);
      const map = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      rows.forEach((r) => {
        r.profiles = (map as Record<string, FlaggedApplication["profiles"]>)[r.user_id] ?? null;
      });
    }
    setApps(rows);
    setFetching(false);
  }, [filter]);

  const fetchMetrics = useCallback(async () => {
    const [pending, approved, scored] = await Promise.all([
      supabase.from("trade_applications").select("id", { count: "exact", head: true }).in("status", REVIEW_STATUSES as never[]),
      supabase.from("trade_applications").select("id", { count: "exact", head: true }).eq("status", "approved" as never),
      supabase.from("trade_applications").select("ai_confidence").not("ai_confidence", "is", null).limit(1000),
    ]);
    const values = ((scored.data as { ai_confidence: number | null }[] | null) || [])
      .map((r) => Number(r.ai_confidence))
      .filter((n) => Number.isFinite(n));
    setMetrics({
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      avg: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
    });
  }, []);

  useEffect(() => {
    if (isAdmin) fetchApps();
  }, [isAdmin, fetchApps]);

  useEffect(() => {
    if (isAdmin) fetchMetrics();
  }, [isAdmin, fetchMetrics]);

  const selected = useMemo(() => apps.find((a) => a.id === openId) ?? null, [apps, openId]);

  const openApp = async (app: FlaggedApplication) => {
    setOpenId(app.id);
    setDocUrl(null);
    if (app.credential_document_path) {
      const { data } = await supabase.storage
        .from("trade-credentials")
        .createSignedUrl(app.credential_document_path, 600);
      setDocUrl(data?.signedUrl ?? null);
    }
  };

  const decide = async (app: FlaggedApplication, decision: "approved" | "rejected") => {
    setBusy(app.id);
    // Optimistic: drop the row out of the active triage list immediately.
    const previous = apps;
    if (filter === "flagged") setApps((prev) => prev.filter((a) => a.id !== app.id));
    setOpenId(null);
    try {
      const { error } = await supabase
        .from("trade_applications")
        .update({
          status: decision,
          tax_exempt_status: decision === "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          next_retry_at: null,
        } as never)
        .eq("id", app.id);
      if (error) throw error;

      if (decision === "approved") {
        await supabase
          .from("user_roles")
          .upsert({ user_id: app.user_id, role: "trade_user" as never }, { onConflict: "user_id,role" });
      } else {
        await supabase.from("user_roles").delete().eq("user_id", app.user_id).eq("role", "trade_user" as never);
      }

      // Continuous learning loop: persist the correction for future prompts.
      await supabase.from("verification_feedback_loops").upsert(
        {
          application_id: app.id,
          submission: {
            company_name: app.company_name,
            company_website: app.company_website,
            job_title: app.job_title,
            country: app.country,
            city: app.city,
            instagram_handle: app.instagram_handle,
            tax_vat_id: app.tax_vat_id,
            has_credential_document: !!app.credential_document_path,
            applicant_email: app.profiles?.email ?? null,
          },
          ai_reasoning:
            (app.ai_result as { reasoning?: string } | null)?.reasoning ||
            app.verification_notes ||
            app.last_verification_error,
          ai_confidence: app.ai_confidence,
          admin_decision: decision,
          admin_notes: notes[app.id]?.trim() || null,
          decided_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "application_id,admin_decision" },
      );

      if (decision === "approved" && app.profiles?.email) {
        // Claim the send slot atomically — the welcome email goes out once.
        const { data: claimed } = await supabase
          .from("trade_applications")
          .update({ approval_email_sent_at: new Date().toISOString() } as never)
          .eq("id", app.id)
          .is("approval_email_sent_at", null)
          .select("id");

        if (claimed && claimed.length > 0) {
          try {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "trade-approval",
                recipientEmail: app.profiles.email,
                idempotencyKey: `trade-approval-${app.id}`,
                templateData: {
                  name: applicantName(app),
                  companyName: app.company_name,
                },
              },
            });
          } catch {
            /* non-fatal */
          }
        }
      }

      toast({ title: decision === "approved" ? "Application approved" : "Application rejected" });
      if (filter !== "flagged") fetchApps();
      fetchMetrics();
    } catch (e) {
      setApps(previous);
      toast({
        title: "Could not save decision",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const result = (selected?.ai_result ?? null) as
    | {
        reasoning?: string;
        credential_body?: string;
        region?: string;
        extracted_identifiers?: { type: string; value: string; valid: boolean | null; note?: string }[];
      }
    | null;
  const identifiers = Array.isArray(result?.extracted_identifiers)
    ? result!.extracted_identifiers!.filter((i) => i && (i.value || i.type))
    : [];

  return (
    <>
      <Helmet>
        <title>Trade Review Queue | Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-[hsl(var(--background))]">
        <div className="container max-w-6xl mx-auto px-6 py-16">
          <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Admin</p>
              <h1 className="font-display text-4xl mt-3 tracking-tight">
                {tab === "queue" ? "Trade Triage" : "Order Ledger"}
              </h1>
              <p className="font-body text-xs text-muted-foreground mt-3 max-w-md leading-relaxed">
                {tab === "queue"
                  ? "Applications the verification agent could not clear on its own."
                  : "Bank-settled orders awaiting reconciliation and payment confirmation."}
              </p>
            </div>
            {tab === "queue" && (
              <Button variant="ghost" size="sm" onClick={() => { fetchApps(); fetchMetrics(); }} disabled={fetching} className="font-body text-xs">
                <RefreshCw className={`h-3.5 w-3.5 mr-2 ${fetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
          </header>

          <nav className="flex gap-6 border-b border-border/60 mb-12">
            {(["queue", "orders"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`-mb-px border-b pb-3 font-body text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  tab === id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {id === "queue" ? "Verification queue" : "Order ledger"}
              </button>
            ))}
          </nav>

          {tab === "orders" && <OrderLedger />}

          {tab === "queue" && (
            <>
              {/* Metric bar */}
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border/60 mb-14">
                {[
                  { label: "Pending requests", value: metrics.pending },
                  { label: "Approved members", value: metrics.approved },
                  { label: "Avg. AI confidence", value: metrics.avg == null ? "—" : `${metrics.avg}/100` },
                ].map((m) => (
                  <div key={m.label} className="bg-background px-6 py-8">
                    <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{m.label}</p>
                    <p className="font-display text-4xl mt-3 tracking-tight">{m.value}</p>
                  </div>
                ))}
              </section>

              {/* Filters */}
              <div className="flex flex-wrap gap-5 mb-8">
                {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`font-body text-[10px] uppercase tracking-[0.2em] pb-1 border-b transition-colors ${
                      filter === f ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {FILTER_LABELS[f]}
                  </button>
                ))}
              </div>

              {fetching && <p className="font-body text-sm text-muted-foreground">Loading queue…</p>}

              {!fetching && apps.length === 0 && (
                <div className="py-24 text-center">
                  <Check className="h-6 w-6 mx-auto text-muted-foreground mb-4" />
                  <p className="font-body text-sm text-muted-foreground">Nothing to show in this view.</p>
                </div>
              )}

              {!fetching && apps.length > 0 && (
                <ul className="divide-y divide-border/60 border-t border-border/60">
                  {apps.map((app) => {
                    const score = app.ai_confidence != null ? Math.round(Number(app.ai_confidence)) : null;
                    return (
                      <li key={app.id}>
                        <button
                          type="button"
                          onClick={() => openApp(app)}
                          className="w-full text-left grid grid-cols-12 items-center gap-4 py-6 px-1 transition-colors hover:bg-muted/30"
                        >
                          <span className="col-span-6 sm:col-span-2 font-body text-xs text-muted-foreground">
                            {new Date(app.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          <span className="col-span-12 sm:col-span-4 font-display text-lg tracking-tight">
                            {app.company_name || "Unnamed practice"}
                          </span>
                          <span className="col-span-6 sm:col-span-2 font-body text-xs text-muted-foreground truncate">
                            {applicantName(app)}
                          </span>
                          <span className="col-span-6 sm:col-span-2 font-body text-xs text-muted-foreground truncate">
                            {[app.city, app.country].filter(Boolean).join(", ") || "—"}
                          </span>
                          <span className="col-span-6 sm:col-span-2 sm:text-right">
                            <ConfidenceBadge score={score} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto overscroll-contain p-0 h-[100dvh] max-h-[100dvh]"
        >
          {selected && (
            <div className="px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-10">
              <p className="font-body text-[10px] uppercase tracking-[0.28em] text-muted-foreground pr-8">
                {selected.status === "system_retry" ? "System retry" : selected.status.replace(/_/g, " ")}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl mt-3 tracking-tight break-words">
                {selected.company_name || "Unnamed practice"}
              </h2>
              <p className="font-body text-xs text-muted-foreground mt-2">
                {[applicantName(selected), selected.job_title, [selected.city, selected.country].filter(Boolean).join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="font-body text-xs text-muted-foreground">{selected.profiles?.email}</p>

              <div className="mt-8 space-y-3 font-body text-xs">
                {selected.company_website && (
                  <a
                    href={selected.company_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-4 break-all"
                  >
                    {selected.company_website} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <p className="text-muted-foreground">Instagram: {selected.instagram_handle || "—"}</p>
                <p className="text-muted-foreground">Tax / VAT ID: {selected.tax_vat_id || "—"}</p>
              </div>

              {/* AI diagnostic */}
              <section className="mt-10 border-t border-border/60 pt-6">
                <div className="flex items-center justify-between">
                  <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground">AI diagnostic</p>
                  <ConfidenceBadge score={selected.ai_confidence != null ? Math.round(Number(selected.ai_confidence)) : null} />
                </div>
                <p className="font-body text-sm leading-relaxed mt-4">
                  {result?.reasoning || selected.verification_notes || "—"}
                </p>
                {selected.last_verification_error && (
                  <p className="font-body text-xs text-destructive mt-3 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                    {selected.last_verification_error}
                    {selected.verification_attempts ? ` (attempt ${selected.verification_attempts})` : ""}
                  </p>
                )}
                {result?.credential_body && (
                  <p className="font-body text-sm mt-4">
                    <span className="text-muted-foreground">Credential: </span>
                    {result.credential_body}
                  </p>
                )}
                {identifiers.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {identifiers.map((id, i) => (
                      <li key={`${id.type}-${i}`} className="flex flex-wrap items-baseline gap-2">
                        <span className="font-body text-sm">
                          {id.type}: <span className="font-mono">{id.value || "—"}</span>
                        </span>
                        {id.valid === true && (
                          <span className="font-body text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 bg-primary/10 text-primary">
                            Format valid
                          </span>
                        )}
                        {id.valid === false && (
                          <span className="font-body text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 bg-destructive/15 text-destructive">
                            Suspicious format
                          </span>
                        )}
                        {id.valid === false && id.note && (
                          <span className="font-body text-xs text-muted-foreground w-full">{id.note}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Document viewer */}
              <section className="mt-10 border-t border-border/60 pt-6">
                <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-4">
                  Business credential
                </p>
                {!selected.credential_document_path && (
                  <p className="font-body text-xs text-muted-foreground">No document uploaded.</p>
                )}
                {selected.credential_document_path && !docUrl && (
                  <p className="font-body text-xs text-muted-foreground inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing secure preview…
                  </p>
                )}
                {docUrl && (
                  <CredentialDocumentViewer
                    url={docUrl}
                    fileName={selected.credential_document_path}
                  />
                )}
              </section>

              {/* Actions */}
              <section className="mt-10 border-t border-border/60 pt-6">
                <Textarea
                  value={notes[selected.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [selected.id]: e.target.value }))}
                  placeholder="Optional note — this is fed back to the verification agent as a learning example."
                  className="font-body text-sm min-h-[80px]"
                />
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    onClick={() => decide(selected, "approved")}
                    disabled={busy === selected.id}
                    className="font-body text-xs uppercase tracking-[0.18em]"
                  >
                    {busy === selected.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 mr-2" />
                    )}
                    Approve member
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => decide(selected, "rejected")}
                    disabled={busy === selected.id}
                    className="font-body text-xs uppercase tracking-[0.18em]"
                  >
                    <X className="h-3.5 w-3.5 mr-2" />
                    Reject application
                  </Button>
                </div>
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
