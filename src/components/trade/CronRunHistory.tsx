import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Summary {
  jobname: string;
  schedule: string;
  last_run_at: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
  rows_7d: number | null;
  rows_30d: number | null;
  rows_label: string | null;
}

interface Run {
  jobname: string;
  schedule: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status: string;
  return_message: string;
  http_status_code: number | null;
}

function fmtAgo(iso: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDur(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusBadge({ status, code }: { status: string | null; code?: number | null }) {
  const ok = status === "succeeded" && (code == null || (code >= 200 && code < 300));
  if (ok) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/30 text-emerald-600">
        <CheckCircle2 className="w-3 h-3" /> {code ?? "ok"}
      </Badge>
    );
  }
  if (!status) return <Badge variant="outline" className="text-[10px]">no runs</Badge>;
  return (
    <Badge variant="outline" className="text-[10px] gap-1 border-red-500/30 text-red-600">
      <XCircle className="w-3 h-3" /> {code ?? status}
    </Badge>
  );
}

export default function CronRunHistory() {
  const [summary, setSummary] = useState<Summary[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, r] = await Promise.all([
      supabase.rpc("get_cron_jobs_summary"),
      supabase.rpc("get_cron_run_history", { _limit: 50 }),
    ]);
    setSummary((s.data as Summary[]) || []);
    setRuns((r.data as Run[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="p-6 text-xs text-muted-foreground font-body">Loading cron history…</div>;
  }

  if (!summary.length) {
    return (
      <Card className="p-6">
        <p className="font-body text-xs text-muted-foreground">
          No cron job data visible. This view is admin-only.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm text-foreground">Cron Jobs Health</h2>
          <p className="font-body text-[11px] text-muted-foreground mt-0.5">
            Last run, status code and rows scraped per scheduled job.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="text-xs gap-1.5">
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {/* Per-job summary */}
      <div className="grid gap-3 md:grid-cols-2">
        {summary
          .sort((a, b) => a.jobname.localeCompare(b.jobname))
          .map((s) => (
            <Card key={s.jobname} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xs text-foreground">{s.jobname}</p>
                  <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                    <code>{s.schedule}</code>
                  </p>
                </div>
                <StatusBadge status={s.last_status} />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                <div>
                  <p className="font-body text-[9px] uppercase text-muted-foreground">Last run</p>
                  <p className="font-body text-[11px] text-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {fmtAgo(s.last_run_at)}
                  </p>
                </div>
                <div>
                  <p className="font-body text-[9px] uppercase text-muted-foreground">Duration</p>
                  <p className="font-body text-[11px] text-foreground">{fmtDur(s.last_duration_ms)}</p>
                </div>
                <div>
                  <p className="font-body text-[9px] uppercase text-muted-foreground">
                    {s.rows_label ? s.rows_label : "Rows"}
                  </p>
                  <p className="font-body text-[11px] text-foreground">
                    {s.rows_7d != null ? (
                      <>
                        <span className="text-foreground">{s.rows_7d}</span>
                        <span className="text-muted-foreground"> / {s.rows_30d} (7d/30d)</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
              </div>
            </Card>
          ))}
      </div>

      {/* Full run log */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-display text-xs text-foreground">Recent Runs (last 50)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-body">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-normal">Job</th>
                <th className="text-left px-3 py-2 font-normal">Started</th>
                <th className="text-left px-3 py-2 font-normal">Duration</th>
                <th className="text-left px-3 py-2 font-normal">Status</th>
                <th className="text-left px-3 py-2 font-normal">Message</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i} className="border-t border-border/40">
                  <td className="px-3 py-2 text-foreground">{r.jobname}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(r.start_time).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDur(r.duration_ms)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} code={r.http_status_code} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[280px]">
                    {r.return_message || "—"}
                  </td>
                </tr>
              ))}
              {!runs.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No runs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
