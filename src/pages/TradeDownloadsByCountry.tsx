import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download, Globe, FileText, ChevronDown, ChevronRight, User } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface CountryRow {
  country: string;
  count: number;
  documents: { name: string; count: number }[];
}

interface UserDownload {
  userName: string;
  email: string;
  company: string;
  country: string;
  docName: string;
  downloadedAt: string;
}

export default function TradeDownloadsByCountry() {
  const { isAdmin, loading } = useAuth();
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["downloads-by-country"],
    queryFn: async () => {
      // Fetch downloads with joined document title
      const { data } = await supabase
        .from("document_downloads")
        .select("country, document_label, document_id, trade_documents(title)");
      if (!data) return [];

      // Group by country → document
      const countryMap = new Map<string, Map<string, number>>();
      for (const row of data) {
        const c = row.country || "Unknown";
        const docName =
          (row as any).trade_documents?.title ||
          row.document_label ||
          "Untitled";
        if (!countryMap.has(c)) countryMap.set(c, new Map());
        const docMap = countryMap.get(c)!;
        docMap.set(docName, (docMap.get(docName) || 0) + 1);
      }

      return Array.from(countryMap.entries())
        .map(([country, docMap]) => ({
          country,
          count: Array.from(docMap.values()).reduce((s, n) => s + n, 0),
          documents: Array.from(docMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count),
        }))
        .sort((a, b) => b.count - a.count) as CountryRow[];
    },
    enabled: isAdmin,
  });

  // Document-level breakdown (all countries)
  const { data: docRows = [] } = useQuery({
    queryKey: ["downloads-by-document"],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_downloads")
        .select("country, document_label, document_id, trade_documents(title)");
      if (!data) return [];
      const docMap = new Map<string, { total: number; countries: Map<string, number> }>();
      for (const row of data) {
        const docName =
          (row as any).trade_documents?.title ||
          row.document_label ||
          "Untitled";
        if (!docMap.has(docName)) docMap.set(docName, { total: 0, countries: new Map() });
        const entry = docMap.get(docName)!;
        entry.total++;
        const c = row.country || "Unknown";
        entry.countries.set(c, (entry.countries.get(c) || 0) + 1);
      }
      return Array.from(docMap.entries())
        .map(([name, { total, countries }]) => ({
          name,
          total,
          countries: Array.from(countries.entries())
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => b.count - a.count),
        }))
        .sort((a, b) => b.total - a.total);
    },
    enabled: isAdmin,
  });

  // Per-user download log
  const { data: userDownloads = [] } = useQuery<UserDownload[]>({
    queryKey: ["downloads-by-user"],
    queryFn: async () => {
      const { data: downloads } = await supabase
        .from("document_downloads")
        .select("created_at, country, document_label, user_id, trade_documents(title)")
        .order("created_at", { ascending: false });
      if (!downloads || downloads.length === 0) return [];

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(downloads.map((d) => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, company")
        .in("id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      return downloads.map((row: any) => {
        const profile = profileMap.get(row.user_id);
        return {
          userName: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "\u2014",
          email: profile?.email || "\u2014",
          company: profile?.company || "\u2014",
          country: row.country || "Unknown",
          docName: row.trade_documents?.title || row.document_label || "Untitled",
          downloadedAt: row.created_at,
        };
      });
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

      <div className="max-w-6xl space-y-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/trade/admin-dashboard" className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-foreground">Download Analytics</h1>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* By Country */}
            <div>
              <h2 className="font-display text-lg text-foreground mb-3">By Country</h2>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 bg-muted/50 border-b border-border">
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Country</span>
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground text-right">Downloads</span>
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground text-right w-12">Share</span>
                </div>
                {rows.map((row) => (
                  <div key={row.country}>
                    <button
                      onClick={() => setExpandedCountry(expandedCountry === row.country ? null : row.country)}
                      className="w-full grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {expandedCountry === row.country ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        )}
                        <Globe className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="font-body text-sm text-foreground">{row.country}</span>
                      </div>
                      <span className="font-body text-sm text-foreground text-right tabular-nums">{row.count}</span>
                      <span className="font-body text-sm text-muted-foreground text-right w-12 tabular-nums">
                        {total > 0 ? `${Math.round((row.count / total) * 100)}%` : "—"}
                      </span>
                    </button>
                    {expandedCountry === row.country && row.documents.length > 0 && (
                      <div className="bg-muted/20 border-b border-border">
                        {row.documents.map((doc) => (
                          <div
                            key={doc.name}
                            className="grid grid-cols-[1fr_auto] gap-4 pl-14 pr-4 py-2 border-b border-border/50 last:border-b-0"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                              <span className="font-body text-xs text-muted-foreground truncate">{doc.name}</span>
                            </div>
                            <span className="font-body text-xs text-muted-foreground tabular-nums">{doc.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* By Document */}
            <div>
              <h2 className="font-display text-lg text-foreground mb-3">By Document</h2>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2.5 bg-muted/50 border-b border-border">
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Document</span>
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground text-right">Downloads</span>
                </div>
                {docRows.map((doc) => (
                  <div key={doc.name} className="border-b border-border last:border-b-0">
                    <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="font-body text-sm text-foreground truncate">{doc.name}</span>
                      </div>
                      <span className="font-body text-sm text-foreground text-right tabular-nums">{doc.total}</span>
                    </div>
                    {doc.countries.length > 1 && (
                      <div className="bg-muted/20">
                        {doc.countries.map((c) => (
                          <div
                            key={c.country}
                            className="grid grid-cols-[1fr_auto] gap-4 pl-10 pr-4 py-1.5 border-t border-border/50"
                          >
                            <span className="font-body text-xs text-muted-foreground">{c.country}</span>
                            <span className="font-body text-xs text-muted-foreground tabular-nums">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Download Log */}
            <div className="lg:col-span-2">
              <h2 className="font-display text-lg text-foreground mb-3">Download Log</h2>
              <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground px-4 py-2.5">User</th>
                      <th className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground px-4 py-2.5">Company</th>
                      <th className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground px-4 py-2.5">Country</th>
                      <th className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground px-4 py-2.5">Document</th>
                      <th className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground px-4 py-2.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userDownloads.map((dl, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <User className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-body text-sm text-foreground truncate">{dl.userName}</p>
                              <p className="font-body text-[10px] text-muted-foreground truncate">{dl.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{dl.company || "\u2014"}</td>
                        <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{dl.country}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileText className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                            <span className="font-body text-xs text-foreground truncate">{dl.docName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-body text-xs text-muted-foreground text-right whitespace-nowrap">
                          {format(new Date(dl.downloadedAt), "d MMM yyyy, HH:mm")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
