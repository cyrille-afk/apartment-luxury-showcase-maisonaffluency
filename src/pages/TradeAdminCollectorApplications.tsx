import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { UserCheck, Mail, Briefcase, Sparkles, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type ApplicationRow = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  occupation: string | null;
  collecting_interests: string | null;
  reference_notes: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function TradeAdminCollectorApplications() {
  const { user, isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-collector-apps", statusFilter],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      let q = supabase
        .from("collector_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data as ApplicationRow[]) ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s) ||
        (r.occupation ?? "").toLowerCase().includes(s) ||
        (r.collecting_interests ?? "").toLowerCase().includes(s),
    );
  }, [rows, search]);

  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      row,
    }: {
      id: string;
      status: "approved" | "rejected" | "pending";
      row: ApplicationRow;
    }) => {
      const { error } = await supabase
        .from("collector_applications")
        .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Notify applicant on approve/reject (best-effort; do not block on failure).
      if (status === "approved" || status === "rejected") {
        const templateName =
          status === "approved" ? "collector-approval" : "collector-rejection";
        const firstName = row.full_name.split(/\s+/)[0] || row.full_name;
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName,
              recipientEmail: row.email,
              idempotencyKey: `collector-${status}-${id}`,
              templateData: { name: firstName },
            },
          });
        } catch (e) {
          console.error("Collector notification email failed", e);
        }
      }
    },
    onSuccess: (_, vars) => {
      const suffix =
        vars.status === "approved"
          ? " — notification email sent"
          : vars.status === "rejected"
          ? " — notification email sent"
          : "";
      toast({ title: `Application ${vars.status}${suffix}` });
      queryClient.invalidateQueries({ queryKey: ["admin-collector-apps"] });
    },
    onError: (e: any) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const counts = {
    pending: rows?.filter((r) => r.status === "pending").length ?? 0,
    approved: rows?.filter((r) => r.status === "approved").length ?? 0,
    rejected: rows?.filter((r) => r.status === "rejected").length ?? 0,
  };

  return (
    <>
      <Helmet>
        <title>Collector Applications — Admin — Maison Affluency</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl text-foreground">Private Collector Applications</h1>
          </div>
          <p className="font-body text-sm text-muted-foreground">
            Review and approve or reject collector applications. Approving grants the collector role automatically.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                setStatusFilter(opt.key);
                setSelectedId(null);
              }}
              className={cn(
                "px-3 py-1.5 rounded-md border font-body text-xs uppercase tracking-[0.1em] transition-colors",
                statusFilter === opt.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
              {opt.key !== "all" && (
                <span className="ml-1.5 opacity-60">
                  ({counts[opt.key as "pending" | "approved" | "rejected"]})
                </span>
              )}
            </button>
          ))}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, occupation…"
            className="ml-auto min-w-[240px] px-3 py-1.5 rounded-md border border-border bg-background text-sm font-body focus:outline-none focus:border-foreground/40"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
          {/* List */}
          <div className="border border-border rounded-md overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center font-body text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center font-body text-sm text-muted-foreground">
                No applications match this filter.
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-[70vh] overflow-y-auto">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors",
                        selectedId === r.id && "bg-muted/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-body text-sm text-foreground truncate">{r.full_name}</div>
                          <div className="font-body text-xs text-muted-foreground truncate">{r.email}</div>
                          {r.occupation && (
                            <div className="font-body text-[11px] text-muted-foreground/80 truncate mt-0.5">
                              {r.occupation}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full border font-body text-[10px] uppercase tracking-wider",
                              STATUS_STYLES[r.status],
                            )}
                          >
                            {r.status}
                          </span>
                          <span className="font-body text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detail */}
          <div className="border border-border rounded-md p-5">
            {!selected ? (
              <div className="h-full flex items-center justify-center text-center font-body text-sm text-muted-foreground min-h-[300px]">
                Select an application to review
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg text-foreground">{selected.full_name}</h2>
                    <a
                      href={`mailto:${selected.email}`}
                      className="font-body text-sm text-primary hover:underline flex items-center gap-1.5 mt-1"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {selected.email}
                    </a>
                  </div>
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full border font-body text-[10px] uppercase tracking-wider",
                      STATUS_STYLES[selected.status],
                    )}
                  >
                    {selected.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    icon={<Briefcase className="h-3.5 w-3.5" />}
                    label="Occupation"
                    value={selected.occupation}
                  />
                  <Field
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Submitted"
                    value={new Date(selected.created_at).toLocaleString()}
                  />
                </div>

                <Field
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  label="Collecting interests"
                  value={selected.collecting_interests}
                  multiline
                />
                <Field
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="References / notes"
                  value={selected.reference_notes}
                  multiline
                />

                {selected.reviewed_at && (
                  <p className="font-body text-[11px] text-muted-foreground">
                    Last reviewed {formatDistanceToNow(new Date(selected.reviewed_at), { addSuffix: true })}
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                  <button
                    disabled={updateStatus.isPending || selected.status === "approved"}
                    onClick={() => updateStatus.mutate({ id: selected.id, status: "approved" })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-600 text-white font-body text-xs uppercase tracking-[0.1em] hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    disabled={updateStatus.isPending || selected.status === "rejected"}
                    onClick={() => updateStatus.mutate({ id: selected.id, status: "rejected" })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-destructive/40 text-destructive font-body text-xs uppercase tracking-[0.1em] hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                  {selected.status !== "pending" && (
                    <button
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: selected.id, status: "pending" })}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-muted-foreground font-body text-xs uppercase tracking-[0.1em] hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      Reset to pending
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  icon,
  label,
  value,
  multiline,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
        {icon}
        <span className="font-body text-[10px] uppercase tracking-[0.12em]">{label}</span>
      </div>
      {value ? (
        <p
          className={cn(
            "font-body text-sm text-foreground",
            multiline && "whitespace-pre-wrap leading-relaxed",
          )}
        >
          {value}
        </p>
      ) : (
        <p className="font-body text-sm text-muted-foreground/60 italic">—</p>
      )}
    </div>
  );
}
