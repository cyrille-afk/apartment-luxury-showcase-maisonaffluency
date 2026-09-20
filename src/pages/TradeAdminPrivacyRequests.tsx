/**
 * Compliance desk for GDPR / PDPA data-subject requests.
 *
 * Admin-only. Reads are gated by RLS (`has_role`), and every fulfilment action
 * runs server-side in the `data-subject-request` edge function so no personal
 * data is assembled or erased in the browser.
 */
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Loader2, ShieldAlert, Trash2 } from "lucide-react";

type Row = {
  id: string;
  email: string;
  user_id: string | null;
  request_type: string;
  status: string;
  requested_at: string;
  verified_at: string | null;
  due_at: string;
  fulfilled_at: string | null;
  details: string | null;
  erased_tables: unknown;
};

const STATUS_STYLES: Record<string, string> = {
  pending_verification: "border-muted-foreground/40 text-muted-foreground",
  verified: "border-amber-500/40 text-amber-600",
  in_progress: "border-sky-500/40 text-sky-600",
  fulfilled: "border-emerald-500/40 text-emerald-600",
  rejected: "border-destructive/40 text-destructive",
};

const daysLeft = (due: string) =>
  Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000);

const TradeAdminPrivacyRequests = () => {
  const { user, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const enabled = !!user && isAdmin;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dsar-requests"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_subject_requests")
        .select(
          "id, email, user_id, request_type, status, requested_at, verified_at, due_at, fulfilled_at, details, erased_tables",
        )
        .order("requested_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const run = async (action: "export" | "erase" | "reject", row: Row) => {
    if (action === "erase" && !confirm(`Permanently erase all data for ${row.email}?`)) return;
    setBusy(row.id);
    const { data, error } = await supabase.functions.invoke("data-subject-request", {
      body: { action, id: row.id },
    });
    setBusy(null);
    const failure = error?.message || (data as { error?: string })?.error;
    if (failure) {
      toast.error(failure);
      return;
    }
    if (action === "export") {
      const payload = (data as { export: unknown }).export;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `data-export-${row.email.replace(/[^a-z0-9]/gi, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast.success(action === "erase" ? "Erasure completed." : "Request fulfilled.");
    queryClient.invalidateQueries({ queryKey: ["dsar-requests"] });
  };

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  if (!enabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-10 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <h1 className="font-serif text-2xl">403 — Forbidden</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The privacy request desk is restricted to internal administrators.
        </p>
        <Link to="/trade" className="text-sm underline underline-offset-4">
          Return to the Trade Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Helmet>
        <title>Privacy Requests — Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Link
        to="/trade"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Trade Portal
      </Link>

      <h1 className="font-serif text-2xl">Data-subject requests</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Access, portability and erasure requests. Each must be answered within 30 days of
        verification.
      </p>

      <div className="mt-8 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading requests…</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No requests have been submitted.</p>
        )}
        {rows.map((row) => {
          const remaining = daysLeft(row.due_at);
          const open = row.status === "verified" || row.status === "in_progress";
          return (
            <Card key={row.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.email}</span>
                    <Badge variant="outline" className="uppercase tracking-wider text-[10px]">
                      {row.request_type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`uppercase tracking-wider text-[10px] ${STATUS_STYLES[row.status] ?? ""}`}
                    >
                      {row.status.replace(/_/g, " ")}
                    </Badge>
                    {open && (
                      <span
                        className={`text-xs ${remaining <= 5 ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {remaining} day{remaining === 1 ? "" : "s"} to respond
                      </span>
                    )}
                  </div>
                  {row.details && (
                    <p className="mt-2 text-sm text-muted-foreground">{row.details}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Requested {new Date(row.requested_at).toLocaleString()}
                    {row.verified_at
                      ? ` · verified ${new Date(row.verified_at).toLocaleDateString()}`
                      : " · awaiting email confirmation"}
                  </p>
                </div>

                {open && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === row.id}
                      onClick={() => run("export", row)}
                    >
                      {busy === row.id ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-3.5 w-3.5" />
                      )}
                      Export data
                    </Button>
                    {row.request_type === "erasure" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy === row.id}
                        onClick={() => run("erase", row)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Erase
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {row.erased_tables ? (
                <pre className="mt-4 max-h-40 overflow-auto rounded bg-muted/40 p-3 text-[11px] text-muted-foreground">
                  {JSON.stringify(row.erased_tables, null, 2)}
                </pre>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TradeAdminPrivacyRequests;
