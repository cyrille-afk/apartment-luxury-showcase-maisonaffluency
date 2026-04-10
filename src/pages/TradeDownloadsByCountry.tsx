import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download, Globe } from "lucide-react";

interface CountryRow {
  country: string;
  count: number;
}

export default function TradeDownloadsByCountry() {
  const { isAdmin, loading } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["downloads-by-country"],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_downloads")
        .select("country, document_id");
      if (!data) return [];
      const map = new Map<string, number>();
      for (const row of data) {
        const c = row.country || "Unknown";
        map.set(c, (map.get(c) || 0) + 1);
      }
      return Array.from(map.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count) as CountryRow[];
    },
    enabled: isAdmin,
  });

  const total = rows.reduce((s, r) => s + r.count, 0);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet>
        <title>Downloads by Country — Admin — Maison Affluency</title>
      </Helmet>

      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/trade/admin-dashboard" className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-foreground">Downloads by Country</h1>
            <p className="font-body text-sm text-muted-foreground mt-0.5">
              {total} total download{total !== 1 ? "s" : ""} tracked
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground font-body text-sm">
            <Download className="h-8 w-8 mx-auto mb-3 opacity-40" />
            No downloads recorded yet
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 bg-muted/50 border-b border-border">
              <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Country</span>
              <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground text-right">Downloads</span>
              <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground text-right w-16">Share</span>
            </div>
            {rows.map((row) => (
              <div
                key={row.country}
                className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                  <span className="font-body text-sm text-foreground">{row.country}</span>
                </div>
                <span className="font-body text-sm text-foreground text-right tabular-nums">{row.count}</span>
                <span className="font-body text-sm text-muted-foreground text-right w-16 tabular-nums">
                  {total > 0 ? `${Math.round((row.count / total) * 100)}%` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
