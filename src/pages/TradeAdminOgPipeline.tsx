import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, RefreshCw, Zap, AlertCircle, CheckCircle2, Clock, ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface RescrapeRun {
  id: string;
  created_at: string;
  trigger_source: string;
  build_id: string | null;
  manifest_size: number | null;
  current_snapshot_size: number | null;
  previous_snapshot_size: number | null;
  rescraped_count: number;
  forced: boolean;
  truncated: boolean;
  skipped: boolean;
  skipped_reason: string | null;
  rescrape_result: any;
  error: string | null;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatRelative = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export default function TradeAdminOgPipeline() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [running, setRunning] = useState<"none" | "diff" | "force">("none");

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["admin-og-rescrape-runs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("og_rescrape_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as RescrapeRun[];
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // Pull manifest stats from the live site
  const { data: manifest } = useQuery({
    queryKey: ["admin-og-manifest"],
    queryFn: async () => {
      const r = await fetch("/og-manifest.json", { cache: "no-store" });
      if (!r.ok) throw new Error("manifest missing");
      const list = (await r.json()) as string[];
      return { count: Array.isArray(list) ? list.length : 0 };
    },
    enabled: isAdmin,
  });

  const { data: version } = useQuery({
    queryKey: ["admin-og-version"],
    queryFn: async () => {
      const r = await fetch("/version.json", { cache: "no-store" });
      if (!r.ok) return null;
      return (await r.json()) as { buildId?: string };
    },
    enabled: isAdmin,
  });

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const lastRun = runs[0];
  const lastSuccess = runs.find((r) => !r.error && !r.skipped);
  const last24h = runs.filter((r) => Date.now() - new Date(r.created_at).getTime() < 86400000);
  const totalRescraped24h = last24h.reduce((s, r) => s + (r.rescraped_count || 0), 0);

  const triggerRescrape = async (force: boolean) => {
    setRunning(force ? "force" : "diff");
    try {
      const { data, error } = await supabase.functions.invoke("post-deploy-rescrape", {
        body: {
          force,
          triggerSource: force ? "admin-force" : "admin-manual",
          maxRescrapes: force ? 1000 : 250,
        },
      });
      if (error) throw error;
      toast({
        title: force ? "Full rescrape complete" : "Rescrape complete",
        description: data?.skipped
          ? `Skipped: ${data.reason}`
          : `Rescraped ${data?.rescrapedCount ?? 0} of ${data?.manifestSize ?? 0} bridges.`,
      });
      qc.invalidateQueries({ queryKey: ["admin-og-rescrape-runs"] });
    } catch (e: any) {
      toast({
        title: "Rescrape failed",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setRunning("none");
    }
  };

  return (
    <div className="container max-w-6xl py-8">
      <Helmet>
        <title>OG Pipeline · Admin</title>
      </Helmet>

      <Link to="/trade" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Trade
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-light tracking-tight">OG Image Pipeline</h1>
        <p className="text-muted-foreground mt-2">
          Monitors and refreshes Meta / WhatsApp Open Graph cards for designer bridge pages.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Bridges tracked"
          value={manifest?.count?.toLocaleString() ?? "—"}
          hint="from /og-manifest.json"
        />
        <StatCard
          label="Current build"
          value={version?.buildId ? version.buildId.slice(0, 10) : "—"}
          hint="from /version.json"
        />
        <StatCard
          label="Runs (24h)"
          value={last24h.length.toString()}
          hint={`${totalRescraped24h} bridges refreshed`}
        />
        <StatCard
          label="Last successful run"
          value={lastSuccess ? formatRelative(lastSuccess.created_at) : "—"}
          hint={lastSuccess ? `${lastSuccess.rescraped_count} rescraped` : "no successful runs"}
        />
      </div>

      {/* Manual controls */}
      <div className="border border-border rounded-lg p-6 mb-8 bg-card">
        <h2 className="text-lg font-medium mb-4">Manual controls</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => triggerRescrape(false)}
            disabled={running !== "none"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${running === "diff" ? "animate-spin" : ""}`} />
            Rescrape changed only
          </button>
          <button
            onClick={() => {
              if (confirm("Force-rescrape ALL bridges (up to 1000)? This counts against Meta's API rate limit.")) {
                triggerRescrape(true);
              }
            }}
            disabled={running !== "none"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Zap className={`h-4 w-4 ${running === "force" ? "animate-pulse" : ""}`} />
            Force full rescrape
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          The pipeline also runs automatically on every deploy and nightly at 02:45 UTC.
        </p>
      </div>

      {/* Last run details */}
      {lastRun && (
        <div className="border border-border rounded-lg p-6 mb-8 bg-card">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            Last run
            <RunStatusBadge run={lastRun} />
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <DetailField label="When" value={formatDate(lastRun.created_at)} />
            <DetailField label="Trigger" value={lastRun.trigger_source} />
            <DetailField label="Build ID" value={lastRun.build_id?.slice(0, 10) ?? "—"} />
            <DetailField label="Bridges rescraped" value={lastRun.rescraped_count.toString()} />
            <DetailField label="Manifest size" value={lastRun.manifest_size?.toString() ?? "—"} />
            <DetailField label="Snapshot (prev → cur)" value={`${lastRun.previous_snapshot_size ?? 0} → ${lastRun.current_snapshot_size ?? 0}`} />
            <DetailField label="Forced" value={lastRun.forced ? "yes" : "no"} />
            <DetailField label="Truncated" value={lastRun.truncated ? "yes" : "no"} />
          </div>
          {lastRun.error && (
            <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              {lastRun.error}
            </div>
          )}
          {lastRun.skipped_reason && (
            <div className="mt-4 p-3 rounded-md bg-muted text-sm text-muted-foreground">
              Skipped: {lastRun.skipped_reason}
            </div>
          )}
          {lastRun.rescrape_result && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                View rescrape API response
              </summary>
              <pre className="mt-2 p-3 rounded-md bg-muted text-xs overflow-auto max-h-64">
                {JSON.stringify(lastRun.rescrape_result, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Per-URL Inspector */}
      <UrlInspector />

      {/* History */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent runs</h2>
          <a
            href="/og-manifest.json"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            View manifest <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No runs yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">When</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Trigger</th>
                  <th className="text-right px-4 py-3 font-medium">Rescraped</th>
                  <th className="text-right px-4 py-3 font-medium">Manifest</th>
                  <th className="text-left px-4 py-3 font-medium">Build</th>
                  <th className="text-left px-4 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap" title={formatDate(r.created_at)}>
                      {formatRelative(r.created_at)}
                    </td>
                    <td className="px-4 py-3"><RunStatusBadge run={r} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{r.trigger_source}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.rescraped_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.manifest_size ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {r.build_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                      {r.error || r.skipped_reason || (r.forced ? "forced" : r.truncated ? "truncated" : "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-light mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xs">{value}</div>
    </div>
  );
}

function RunStatusBadge({ run }: { run: RescrapeRun }) {
  if (run.error) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive">
        <AlertCircle className="h-3 w-3" /> error
      </span>
    );
  }
  if (run.skipped) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
        <Clock className="h-3 w-3" /> skipped
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
      <CheckCircle2 className="h-3 w-3" /> ok
    </span>
  );
}
