import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, History, CalendarIcon, Download, Search } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

const ScrapeHistory = () => {
  const [scrapeHistory, setScrapeHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFrom, setHistoryFrom] = useState<Date | undefined>(undefined);
  const [historyTo, setHistoryTo] = useState<Date | undefined>(undefined);
  const [historyBrand, setHistoryBrand] = useState("");

  const historyBrands = useMemo(() => {
    const set = new Set<string>();
    for (const run of scrapeHistory) if (run.brand_name) set.add(run.brand_name);
    return Array.from(set).sort();
  }, [scrapeHistory]);

  const filteredHistory = useMemo(() => {
    if (!historyBrand) return scrapeHistory;
    return scrapeHistory.filter((r) => r.brand_name === historyBrand);
  }, [scrapeHistory, historyBrand]);

  const chartData = useMemo(() => {
    if (!filteredHistory.length) return [];
    const byDay: Record<string, { date: string; inserted: number; updated: number; errors: number }> = {};
    for (const run of filteredHistory) {
      const day = new Date(run.started_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { date: day, inserted: 0, updated: 0, errors: 0 };
      byDay[day].inserted += run.inserted || 0;
      byDay[day].updated += run.updated || 0;
      byDay[day].errors += run.errors || 0;
    }
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredHistory]);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    let query = supabase.from("scrape_runs").select("*").order("started_at", { ascending: false }).limit(100);
    if (historyFrom) query = query.gte("started_at", historyFrom.toISOString());
    if (historyTo) {
      const endOfDay = new Date(historyTo);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("started_at", endOfDay.toISOString());
    }
    const { data } = await query;
    setScrapeHistory(data || []);
    setLoadingHistory(false);
  }, [historyFrom, historyTo]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const exportCsv = () => {
    const headers = ["Brand", "Status", "Total URLs", "Scraped", "Inserted", "Updated", "Errors", "Duration (s)", "Started At", "Completed At"];
    const rows = filteredHistory.map((r) => [
      `"${(r.brand_name || "").replace(/"/g, '""')}"`,
      r.status, r.total_urls, r.total_scraped, r.inserted, r.updated, r.errors,
      r.duration_seconds, r.started_at, r.completed_at,
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scrape-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display text-sm text-foreground flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Scrape History
        </h3>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 text-[10px] font-body border border-border rounded px-2 py-1 hover:bg-muted/30 transition-colors">
                <CalendarIcon className="h-3 w-3" />
                {historyFrom ? format(historyFrom, "dd/MM/yy") : "From"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={historyFrom} onSelect={setHistoryFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-[10px] text-muted-foreground">–</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 text-[10px] font-body border border-border rounded px-2 py-1 hover:bg-muted/30 transition-colors">
                <CalendarIcon className="h-3 w-3" />
                {historyTo ? format(historyTo, "dd/MM/yy") : "To"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={historyTo} onSelect={setHistoryTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(historyFrom || historyTo) && (
            <button onClick={() => { setHistoryFrom(undefined); setHistoryTo(undefined); }} className="text-[10px] font-body text-muted-foreground hover:text-foreground transition-colors">
              Clear dates
            </button>
          )}
          {historyBrands.length > 1 && (
            <select
              value={historyBrand}
              onChange={(e) => setHistoryBrand(e.target.value)}
              className="text-[10px] font-body border border-border rounded px-1.5 py-1 bg-background text-foreground"
            >
              <option value="">All brands</option>
              {historyBrands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
          <button
            onClick={fetchHistory}
            disabled={loadingHistory}
            className="font-body text-[10px] text-primary hover:underline flex items-center gap-1"
          >
            {loadingHistory ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
          {filteredHistory.length > 0 && (
            <button onClick={exportCsv} className="font-body text-[10px] text-primary hover:underline flex items-center gap-1">
              <Download className="h-3 w-3" />
              CSV
            </button>
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => { const d = new Date(v + "T00:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; }}
              />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="inserted" name="Inserted" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="updated" name="Updated" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="errors" name="Errors" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <p className="font-body text-xs text-muted-foreground">No scrape runs yet.</p>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_80px_60px_60px_60px_70px_70px] gap-2 font-body text-[10px] text-muted-foreground uppercase tracking-wider px-2 pb-1 border-b border-border">
            <span>Brand</span>
            <span>Status</span>
            <span className="text-right">URLs</span>
            <span className="text-right">Inserted</span>
            <span className="text-right">Updated</span>
            <span className="text-right">Duration</span>
            <span className="text-right">When</span>
          </div>
          {filteredHistory.map((run) => {
            const dur = Number(run.duration_seconds);
            const durLabel = dur >= 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : `${dur}s`;
            const ago = (() => {
              const diff = (Date.now() - new Date(run.started_at).getTime()) / 1000;
              if (diff < 60) return "just now";
              if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
              if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
              return `${Math.floor(diff / 86400)}d ago`;
            })();
            return (
              <div
                key={run.id}
                className="grid grid-cols-[1fr_80px_60px_60px_60px_70px_70px] gap-2 font-body text-[11px] text-foreground px-2 py-1.5 rounded hover:bg-muted/30 transition-colors"
              >
                <span className="truncate font-medium" title={run.brand_name}>{run.brand_name}</span>
                <span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-medium ${
                    run.status === "completed" ? "bg-primary/10 text-primary" :
                    run.status === "cancelled" ? "bg-accent/50 text-accent-foreground" :
                    "bg-destructive/10 text-destructive"
                  }`}>
                    {run.status}
                  </span>
                </span>
                <span className="text-right">{run.total_scraped}/{run.total_urls}</span>
                <span className="text-right text-green-600">{run.inserted}</span>
                <span className="text-right text-blue-600">{run.updated}</span>
                <span className="text-right text-muted-foreground">{durLabel}</span>
                <span className="text-right text-muted-foreground" title={new Date(run.started_at).toLocaleString()}>{ago}</span>
              </div>
            );
          })}
          {filteredHistory.length > 1 && (() => {
            const totals = filteredHistory.reduce((acc, r) => ({
              urls: acc.urls + (r.total_urls || 0),
              scraped: acc.scraped + (r.total_scraped || 0),
              inserted: acc.inserted + (r.inserted || 0),
              updated: acc.updated + (r.updated || 0),
              duration: acc.duration + (Number(r.duration_seconds) || 0),
            }), { urls: 0, scraped: 0, inserted: 0, updated: 0, duration: 0 });
            const durLabel = totals.duration >= 60 ? `${Math.floor(totals.duration / 60)}m ${totals.duration % 60}s` : `${totals.duration}s`;
            return (
              <div className="grid grid-cols-[1fr_80px_60px_60px_60px_70px_70px] gap-2 font-body text-[11px] font-semibold text-foreground px-2 py-1.5 border-t border-border mt-1">
                <span>{filteredHistory.length} runs</span>
                <span />
                <span className="text-right">{totals.scraped}/{totals.urls}</span>
                <span className="text-right text-green-600">{totals.inserted}</span>
                <span className="text-right text-blue-600">{totals.updated}</span>
                <span className="text-right text-muted-foreground">{durLabel}</span>
                <span />
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ScrapeHistory;
