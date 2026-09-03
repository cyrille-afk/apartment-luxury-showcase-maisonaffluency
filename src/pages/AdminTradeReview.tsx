import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Check, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";

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

export default function AdminTradeReview() {
  const { isAdmin, loading, user } = useAuth();
  const { toast } = useToast();
  const [apps, setApps] = useState<FlaggedApplication[]>([]);
  const [fetching, setFetching] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    setFetching(true);
    const { data } = await supabase
      .from("trade_applications")
      .select("*")
      .in("status", REVIEW_STATUSES as never[])
      .order("created_at", { ascending: false });

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
  }, []);

  useEffect(() => {
    if (isAdmin) fetchApps();
  }, [isAdmin, fetchApps]);

  const decide = async (app: FlaggedApplication, decision: "approved" | "rejected") => {
    setBusy(app.id);
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
      await supabase.from("verification_feedback_loops").insert({
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
      } as never);

      if (decision === "approved" && app.profiles?.email) {
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "trade-approval",
              recipientEmail: app.profiles.email,
              idempotencyKey: `trade-approval-${app.id}`,
              templateData: {
                name: `${app.profiles.first_name ?? ""} ${app.profiles.last_name ?? ""}`.trim(),
                companyName: app.company_name,
              },
            },
          });
        } catch {
          /* non-fatal */
        }
      }

      toast({ title: decision === "approved" ? "Application approved" : "Application rejected" });
      setApps((prev) => prev.filter((a) => a.id !== app.id));
    } catch (e) {
      toast({
        title: "Could not save decision",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const openCredential = async (path: string) => {
    const { data, error } = await supabase.storage.from("trade-credentials").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Could not open document", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade/login" replace />;

  return (
    <>
      <Helmet>
        <title>Trade Review Queue | Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="container max-w-5xl mx-auto px-4 py-12">
        <header className="flex items-end justify-between border-b border-border pb-6 mb-8">
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Admin</p>
            <h1 className="font-display text-3xl mt-2">Trade Triage Queue</h1>
            <p className="font-body text-xs text-muted-foreground mt-2">
              Applications the verification agent could not clear on its own.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchApps} disabled={fetching} className="font-body text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${fetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </header>

        {fetching && <p className="font-body text-sm text-muted-foreground">Loading queue…</p>}

        {!fetching && apps.length === 0 && (
          <div className="border border-border rounded-sm py-20 text-center">
            <Check className="h-6 w-6 mx-auto text-muted-foreground mb-3" />
            <p className="font-body text-sm text-muted-foreground">Queue is clear. Nothing awaiting review.</p>
          </div>
        )}

        <div className="space-y-6">
          {apps.map((app) => {
            const reasoning =
              (app.ai_result as { reasoning?: string } | null)?.reasoning || app.verification_notes || "—";
            const score = app.ai_confidence != null ? Math.round(Number(app.ai_confidence)) : null;
            return (
              <article key={app.id} className="border border-border rounded-sm p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl">{app.company_name || "Unnamed practice"}</h2>
                    <p className="font-body text-xs text-muted-foreground mt-1">
                      {[
                        `${app.profiles?.first_name ?? ""} ${app.profiles?.last_name ?? ""}`.trim() || "Unknown applicant",
                        app.job_title,
                        [app.city, app.country].filter(Boolean).join(", "),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">{app.profiles?.email}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-sm bg-warning/15 text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      {app.status === "system_retry" ? "System retry" : "Flagged"}
                    </span>
                    {score != null && (
                      <p className="font-display text-2xl mt-2">
                        {score}
                        <span className="font-body text-xs text-muted-foreground">/100</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-sm bg-muted/40 p-4">
                  <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2">
                    AI reasoning
                  </p>
                  <p className="font-body text-sm leading-relaxed">{reasoning}</p>
                  {app.last_verification_error && (
                    <p className="font-body text-xs text-destructive mt-2">
                      Error: {app.last_verification_error}
                      {app.verification_attempts ? ` (attempt ${app.verification_attempts})` : ""}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-4 font-body text-xs">
                  {app.company_website && (
                    <a
                      href={app.company_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                    >
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {app.instagram_handle && <span className="text-muted-foreground">IG {app.instagram_handle}</span>}
                  {app.tax_vat_id && <span className="text-muted-foreground">VAT {app.tax_vat_id}</span>}
                  {app.credential_document_path && (
                    <button
                      type="button"
                      onClick={() => openCredential(app.credential_document_path!)}
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                    >
                      Credential document <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <Textarea
                  value={notes[app.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [app.id]: e.target.value }))}
                  placeholder="Optional note — this is fed back to the verification agent as a learning example."
                  className="mt-5 font-body text-sm min-h-[72px]"
                />

                <div className="mt-4 flex gap-3">
                  <Button
                    onClick={() => decide(app, "approved")}
                    disabled={busy === app.id}
                    className="font-body text-xs uppercase tracking-[0.18em]"
                  >
                    {busy === app.id ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-2" />}
                    Override &amp; Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => decide(app, "rejected")}
                    disabled={busy === app.id}
                    className="font-body text-xs uppercase tracking-[0.18em]"
                  >
                    <X className="h-3.5 w-3.5 mr-2" />
                    Reject
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
