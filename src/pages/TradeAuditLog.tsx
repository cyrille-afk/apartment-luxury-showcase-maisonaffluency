import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { History, Trash2, Pencil, Plus, ChevronDown, ChevronRight, Search, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AuditEntry {
  id: string;
  table_name: string;
  operation: string;
  record_id: string;
  changed_by: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  created_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  designer_curator_picks: "Curator Picks",
  trade_documents: "Brand Documents",
  designers: "Designers",
};

const OP_CONFIG: Record<string, { icon: typeof Trash2; label: string; color: string }> = {
  DELETE: { icon: Trash2, label: "Deleted", color: "text-destructive bg-destructive/10" },
  UPDATE: { icon: Pencil, label: "Updated", color: "text-warning bg-warning/10" },
  INSERT: { icon: Plus, label: "Created", color: "text-success bg-success/10" },
};

function getRecordLabel(entry: AuditEntry): string {
  const data = entry.old_data || entry.new_data;
  if (!data) return entry.record_id.slice(0, 8);
  if (entry.table_name === "designer_curator_picks") return data.title || "Untitled Pick";
  if (entry.table_name === "trade_documents") return data.title || "Untitled Document";
  if (entry.table_name === "designers") return data.display_name || data.name || data.slug || "Unknown Designer";
  return entry.record_id.slice(0, 8);
}

function getSecondaryLabel(entry: AuditEntry): string | null {
  const data = entry.old_data || entry.new_data;
  if (!data) return null;
  if (entry.table_name === "designer_curator_picks") return data.category ? `${data.category}${data.subcategory ? ` › ${data.subcategory}` : ""}` : null;
  if (entry.table_name === "trade_documents") return data.brand_name || null;
  if (entry.table_name === "designers") return data.specialty || null;
  return null;
}

function ChangedFields({ oldData, newData }: { oldData: Record<string, any> | null; newData: Record<string, any> | null }) {
  if (!oldData || !newData) return null;
  const ignoredKeys = new Set(["updated_at", "created_at"]);
  const changed: { key: string; from: any; to: any }[] = [];
  for (const key of Object.keys(newData)) {
    if (ignoredKeys.has(key)) continue;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed.push({ key, from: oldData[key], to: newData[key] });
    }
  }
  if (changed.length === 0) return <p className="font-body text-xs text-muted-foreground italic">No visible field changes</p>;
  return (
    <div className="space-y-1.5">
      {changed.map((c) => {
        const fromStr = typeof c.from === "string" ? (c.from.length > 80 ? c.from.slice(0, 80) + "…" : c.from) : JSON.stringify(c.from)?.slice(0, 80);
        const toStr = typeof c.to === "string" ? (c.to.length > 80 ? c.to.slice(0, 80) + "…" : c.to) : JSON.stringify(c.to)?.slice(0, 80);
        return (
          <div key={c.key} className="font-body text-xs">
            <span className="text-muted-foreground font-medium">{c.key}:</span>{" "}
            <span className="text-destructive/70 line-through">{fromStr}</span>
            {" → "}
            <span className="text-success">{toStr}</span>
          </div>
        );
      })}
    </div>
  );
}

const TradeAuditLog = () => {
  const { isAdmin, loading } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [opFilter, setOpFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAdmin) return;
    fetchEntries();
  }, [isAdmin]);

  const fetchEntries = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("content_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    const rows = (data || []) as AuditEntry[];
    setEntries(rows);

    const userIds = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", userIds);
      if (profiles) {
        const map: Record<string, string> = {};
        for (const p of profiles as any[]) {
          const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
          map[p.id] = name || p.email;
        }
        setProfileMap(map);
      }
    }
    setFetching(false);
  };

  const filtered = useMemo(() => {
    let result = entries;
    if (tableFilter !== "all") result = result.filter((e) => e.table_name === tableFilter);
    if (opFilter !== "all") result = result.filter((e) => e.operation === opFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => {
        const label = getRecordLabel(e).toLowerCase();
        const secondary = (getSecondaryLabel(e) || "").toLowerCase();
        return label.includes(q) || secondary.includes(q) || e.record_id.includes(q);
      });
    }
    return result;
  }, [entries, tableFilter, opFilter, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, AuditEntry[]> = {};
    for (const entry of filtered) {
      const day = format(new Date(entry.created_at), "EEEE, d MMMM yyyy");
      if (!groups[day]) groups[day] = [];
      groups[day].push(entry);
    }
    return groups;
  }, [filtered]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Audit Log — Trade Portal — Maison Affluency</title></Helmet>
      <div className="max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-display text-2xl text-foreground">Content Audit Log</h1>
        </div>
        <p className="font-body text-sm text-muted-foreground -mt-3">
          Immutable record of every change to designer profiles, curator picks, and brand documents.
        </p>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground w-56 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {[
              { value: "all", label: "All Tables" },
              { value: "designers", label: "Designers" },
              { value: "designer_curator_picks", label: "Curator Picks" },
              { value: "trade_documents", label: "Documents" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTableFilter(opt.value)}
                className={`px-3 py-1.5 rounded-full font-body text-[10px] uppercase tracking-[0.1em] border transition-colors ${
                  tableFilter === opt.value
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { value: "all", label: "All" },
              { value: "INSERT", label: "Created" },
              { value: "UPDATE", label: "Updated" },
              { value: "DELETE", label: "Deleted" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setOpFilter(opt.value)}
                className={`px-3 py-1.5 rounded-full font-body text-[10px] uppercase tracking-[0.1em] border transition-colors ${
                  opFilter === opt.value
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {fetching ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-body text-sm text-muted-foreground">No audit entries found.</p>
            <p className="font-body text-xs text-muted-foreground/60 mt-1">
              Changes made after the audit triggers were installed will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([day, dayEntries]) => (
              <div key={day}>
                <h3 className="font-display text-xs text-muted-foreground uppercase tracking-[0.15em] mb-3 sticky top-0 bg-background py-1 z-10">
                  {day}
                </h3>
                <div className="space-y-2">
                  {dayEntries.map((entry) => {
                    const config = OP_CONFIG[entry.operation] || OP_CONFIG.UPDATE;
                    const Icon = config.icon;
                    const isExpanded = expandedId === entry.id;
                    const label = getRecordLabel(entry);
                    const secondary = getSecondaryLabel(entry);
                    const who = entry.changed_by ? profileMap[entry.changed_by] || "System" : "System";

                    return (
                      <div key={entry.id} className="border border-border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                        >
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider shrink-0 ${config.color}`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-body uppercase tracking-wider shrink-0">
                            {TABLE_LABELS[entry.table_name] || entry.table_name}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-body text-sm text-foreground truncate block">{label}</span>
                            {secondary && (
                              <span className="font-body text-[10px] text-muted-foreground truncate block">{secondary}</span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-body text-[10px] text-muted-foreground block">
                              {format(new Date(entry.created_at), "HH:mm:ss")}
                            </span>
                            <span className="font-body text-[10px] text-muted-foreground/60 block">{who}</span>
                          </div>
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/10">
                            {entry.operation === "DELETE" && entry.old_data && (
                              <div>
                                <p className="font-body text-[10px] text-destructive uppercase tracking-wider mb-2">Deleted Record Snapshot</p>
                                <pre className="font-body text-xs text-muted-foreground bg-muted/50 rounded p-3 overflow-x-auto max-h-64 whitespace-pre-wrap">
                                  {JSON.stringify(entry.old_data, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.operation === "UPDATE" && (
                              <div>
                                <p className="font-body text-[10px] text-warning uppercase tracking-wider mb-2">Changed Fields</p>
                                <ChangedFields oldData={entry.old_data} newData={entry.new_data} />
                              </div>
                            )}
                            {entry.operation === "INSERT" && entry.new_data && (
                              <div>
                                <p className="font-body text-[10px] text-success uppercase tracking-wider mb-2">Created Record</p>
                                <pre className="font-body text-xs text-muted-foreground bg-muted/50 rounded p-3 overflow-x-auto max-h-64 whitespace-pre-wrap">
                                  {JSON.stringify(entry.new_data, null, 2)}
                                </pre>
                              </div>
                            )}
                            <p className="font-body text-[10px] text-muted-foreground/50 mt-2">
                              Record ID: {entry.record_id}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="font-body text-[10px] text-muted-foreground/40 text-center py-4">
          Showing {filtered.length} of {entries.length} entries · Audit logging active since March 23, 2026
        </p>
      </div>
    </>
  );
};

export default TradeAuditLog;