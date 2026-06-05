import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, History, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";

interface AuditRow {
  id: string;
  field: string;
  requested_value: string | null;
  resolved_value: string | null;
  outcome: "accepted" | "rejected";
  reason: string | null;
  failed_validation: string | null;
  cad_document_id: string | null;
  room_label: string | null;
  product_id: string | null;
  clearance_mm: number | null;
  verdict: string | null;
  turns_since_confirm: number | null;
  batch_id: string | null;
  created_at: string;
}

type SessionGroup = {
  key: string;
  startedAt: string;
  rows: AuditRow[];
  finalVerdict: string | null;
  resultOutcome: "accepted" | "rejected" | null;
  batchId: string | null;
  batchSize: number; // number of result rows sharing batchId in this session
};

const FIELD_BADGE: Record<string, string> = {
  initial: "bg-muted text-muted-foreground",
  cad_document_id: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  room_label: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  product_id: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  clearance_mm: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  confirm: "bg-primary/10 text-primary",
  cancel: "bg-muted text-muted-foreground",
  result: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

// Group consecutive rows into "sessions": every `result` row caps a session,
// and gaps > 30 minutes also start a new one. Multi-piece batches (rows sharing
// a `batch_id`) stay together as one session even though they contain N result rows.
function groupIntoSessions(rows: AuditRow[]): SessionGroup[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const groups: SessionGroup[] = [];
  let current: AuditRow[] = [];
  const flush = () => {
    if (!current.length) return;
    const resultRows = current.filter((r) => r.field === "result");
    const lastResult = resultRows[resultRows.length - 1] || null;
    const batchIds = Array.from(new Set(current.map((r) => r.batch_id).filter(Boolean) as string[]));
    const batchId = batchIds.length === 1 ? batchIds[0] : null;
    groups.push({
      key: current[0].id,
      startedAt: current[0].created_at,
      rows: current,
      finalVerdict: lastResult?.verdict || null,
      resultOutcome: lastResult?.outcome || null,
      batchId,
      batchSize: batchId ? resultRows.filter((r) => r.batch_id === batchId).length : (lastResult ? 1 : 0),
    });
    current = [];
  };
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const prev = current[current.length - 1];
    const gapMs = prev ? new Date(r.created_at).getTime() - new Date(prev.created_at).getTime() : 0;
    if (prev && gapMs > 30 * 60 * 1000) flush();
    current.push(r);
    // A `cancel` always caps. A `result` caps only when the NEXT row isn't part of the same batch.
    if (r.field === "cancel") {
      flush();
    } else if (r.field === "result") {
      const next = sorted[i + 1];
      const sameBatch = next && r.batch_id && next.batch_id === r.batch_id;
      if (!sameBatch) flush();
    }
  }
  flush();
  return groups.reverse(); // newest session first
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return null;
  const v = verdict.toLowerCase();
  const cls =
    v === "pass" || v === "fits"
      ? "bg-success/15 text-success"
      : v === "warn" || v === "tight"
        ? "bg-warning/15 text-warning"
        : v === "fail" || v === "doesn't fit"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground";
  return <Badge className={`${cls} border-0 uppercase tracking-wide`}>{verdict}</Badge>;
}

function RowLine({ row }: { row: AuditRow }) {
  const Icon =
    row.outcome === "accepted"
      ? CheckCircle2
      : row.failed_validation === "other" && row.reason?.includes("timeout")
        ? AlertTriangle
        : XCircle;
  const iconCls =
    row.outcome === "accepted"
      ? "text-success"
      : row.failed_validation === "other"
        ? "text-warning"
        : "text-destructive";
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${iconCls}`} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-1.5 py-0.5 rounded font-mono ${FIELD_BADGE[row.field] || "bg-muted"}`}>
            {row.field}
          </span>
          {row.field === "result" && <VerdictBadge verdict={row.verdict} />}
          {row.failed_validation && (
            <span className="text-destructive font-mono text-[10px] uppercase tracking-wider">
              {row.failed_validation}
            </span>
          )}
          <span className="text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
          </span>
        </div>
        {row.requested_value && (
          <div className="font-body text-sm text-foreground">
            <span className="text-muted-foreground">requested:</span>{" "}
            <span className="font-mono text-xs">{row.requested_value}</span>
            {row.resolved_value && row.resolved_value !== row.requested_value && (
              <>
                {" → "}
                <span className="font-mono text-xs text-success">{row.resolved_value}</span>
              </>
            )}
          </div>
        )}
        {row.reason && (
          <p className="font-body text-xs text-muted-foreground italic">{row.reason}</p>
        )}
        {(row.cad_document_id || row.room_label || row.product_id || row.clearance_mm) && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono text-muted-foreground">
            {row.cad_document_id && <span>plan: {row.cad_document_id.slice(0, 8)}…</span>}
            {row.room_label && <span>room: {row.room_label}</span>}
            {row.product_id && <span>piece: {row.product_id.slice(0, 8)}…</span>}
            {row.clearance_mm != null && <span>clearance: {row.clearance_mm}mm</span>}
            {row.turns_since_confirm != null && <span>+{row.turns_since_confirm} turns</span>}
          </div>
        )}
      </div>
    </div>
  );
}

const TradeSpatialFitAudit = () => {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "accepted" | "rejected">("all");
  const [fieldFilter, setFieldFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setFetching(true);
      const { data } = await supabase
        .from("cad_fit_edit_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!cancelled) {
        setRows((data || []) as AuditRow[]);
        setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (outcomeFilter !== "all" && r.outcome !== outcomeFilter) return false;
      if (fieldFilter !== "all" && r.field !== fieldFilter) return false;
      return true;
    });
  }, [rows, outcomeFilter, fieldFilter]);

  const sessions = useMemo(() => groupIntoSessions(filtered), [filtered]);

  const exportCSV = () => {
    const cols: (keyof AuditRow)[] = [
      "created_at", "field", "outcome", "requested_value", "resolved_value",
      "verdict", "failed_validation", "reason", "cad_document_id", "room_label",
      "product_id", "clearance_mm", "turns_since_confirm", "batch_id", "id",
    ];
    const esc = (v: unknown) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [cols.join(",")];
    filtered.forEach((r) => lines.push(cols.map((c) => esc(r[c])).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spatial-fit-audit-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;
    const line = (text: string, size = 9, bold = false, color: [number, number, number] = [30, 30, 30]) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const wrapped = doc.splitTextToSize(text, pageW - margin * 2);
      wrapped.forEach((ln: string) => {
        if (y > pageH - margin) { doc.addPage(); y = margin; }
        doc.text(ln, margin, y);
        y += size + 2;
      });
    };
    line("Spatial-Fit Audit Log", 16, true);
    line(`Exported ${format(new Date(), "PPpp")} — ${filtered.length} rows, ${sessions.length} sessions`, 9, false, [120, 120, 120]);
    y += 8;
    sessions.forEach((s, i) => {
      if (y > pageH - margin - 60) { doc.addPage(); y = margin; }
      const status = s.finalVerdict || (s.rows.some((r) => r.field === "cancel") ? "cancelled" : "in progress");
      line(`Session ${sessions.length - i} — ${format(new Date(s.startedAt), "PPpp")} — ${status.toUpperCase()}${s.batchId && s.batchSize > 1 ? ` — batch ×${s.batchSize}` : ""}`, 10, true);
      s.rows.forEach((r) => {
        const parts = [
          format(new Date(r.created_at), "HH:mm:ss"),
          `[${r.field}]`,
          r.outcome,
          r.verdict ? `verdict=${r.verdict}` : "",
          r.failed_validation ? `fail=${r.failed_validation}` : "",
          r.requested_value ? `req=${r.requested_value}` : "",
          r.resolved_value && r.resolved_value !== r.requested_value ? `→ ${r.resolved_value}` : "",
          r.clearance_mm != null ? `clr=${r.clearance_mm}mm` : "",
        ].filter(Boolean).join(" ");
        line(parts, 9);
        if (r.reason) line(`  ${r.reason}`, 8, false, [120, 120, 120]);
      });
      y += 6;
    });
    doc.save(`spatial-fit-audit-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <>
      <Helmet>
        <title>Spatial-Fit Audit — Trade Portal — Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-4xl space-y-6">
        <div>
          <Link
            to="/trade/spatial-fit"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Spatial Fit
          </Link>
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-muted-foreground" />
            <h1 className="font-display text-2xl text-foreground">Spatial-Fit Audit Log</h1>
          </div>
          <p className="font-body text-sm text-muted-foreground mt-2">
            Every plan, room, piece, and clearance edit the concierge attempted on your behalf — grouped into sessions and capped by the final verdict. Rows older than 90 days are pruned automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={outcomeFilter} onValueChange={(v: any) => setOutcomeFilter(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fieldFilter} onValueChange={setFieldFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fields</SelectItem>
              <SelectItem value="initial">Initial selection</SelectItem>
              <SelectItem value="cad_document_id">Plan edits</SelectItem>
              <SelectItem value="room_label">Room edits</SelectItem>
              <SelectItem value="product_id">Piece edits</SelectItem>
              <SelectItem value="clearance_mm">Clearance edits</SelectItem>
              <SelectItem value="confirm">Confirmations</SelectItem>
              <SelectItem value="cancel">Cancellations</SelectItem>
              <SelectItem value="result">Results</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} {filtered.length === 1 ? "row" : "rows"} • {sessions.length} sessions
          </span>
        </div>

        {fetching ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center">
            <p className="font-body text-sm text-muted-foreground">
              No spatial-fit activity yet. Ask the Trade Concierge to run a fit check from{" "}
              <Link to="/trade/spatial-fit" className="text-primary hover:underline">
                /trade/spatial-fit
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.key}
                className="border border-border rounded-lg p-4 bg-card"
              >
                <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>Session started {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}</span>
                    <span>•</span>
                    <span>{session.rows.length} {session.rows.length === 1 ? "step" : "steps"}</span>
                    {session.batchId && session.batchSize > 1 && (
                      <>
                        <span>•</span>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          batch ×{session.batchSize}
                        </Badge>
                      </>
                    )}
                  </div>
                  {session.finalVerdict ? (
                    <VerdictBadge verdict={session.finalVerdict} />
                  ) : session.rows.some((r) => r.field === "cancel") ? (
                    <Badge variant="outline" className="text-muted-foreground">cancelled</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">in progress</Badge>
                  )}
                </div>
                <div>
                  {session.rows.map((row) => (
                    <RowLine key={row.id} row={row} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default TradeSpatialFitAudit;
