import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, Database, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface Match {
  id: string;
  source: "curator" | "trade";
  title: string;
  designer: string;
  category: string | null;
  subcategory: string | null;
  materials: string | null;
  similarity: number | null;
}

interface Trace {
  id: string;
  user_id: string | null;
  query: string;
  matches: Match[];
  context_text: string | null;
  match_count: number;
  top_similarity: number | null;
  used_in_answer: boolean;
  created_at: string;
}

const LIMITS = [25, 50, 100, 200];

export default function TradeRagDebug() {
  const [limit, setLimit] = useState(50);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: traces, isLoading, error } = useQuery({
    queryKey: ["concierge-rag-traces", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("concierge_rag_traces")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as Trace[];
    },
  });

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const fmtSim = (n: number | null) =>
    typeof n === "number" ? n.toFixed(3) : "—";

  const simColor = (n: number | null) => {
    if (typeof n !== "number") return "bg-muted text-muted-foreground";
    if (n >= 0.85) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
    if (n >= 0.75) return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to="/trade/admin-dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to admin
          </Link>
          <h1 className="text-2xl font-serif">RAG Debug</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last {limit} concierge turns that triggered semantic retrieval. Each trace shows the top matched catalog items, their cosine similarity, and the context block injected into the model.
          </p>
        </div>
        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LIMITS.map((n) => <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading traces…</p>}
      {error && <p className="text-sm text-destructive">Failed to load traces: {(error as Error).message}</p>}
      {!isLoading && !error && (traces?.length ?? 0) === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No traces yet. Once a trade user asks the concierge a catalog-aware question, retrieval traces will appear here.
        </Card>
      )}

      <div className="space-y-3">
        {traces?.map((t) => {
          const isOpen = !!expanded[t.id];
          return (
            <Card key={t.id} className="p-4">
              <button
                onClick={() => toggle(t.id)}
                className="w-full flex items-start gap-3 text-left"
              >
                {isOpen ? <ChevronDown className="w-4 h-4 mt-1 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-1 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="outline" className={simColor(t.top_similarity)}>
                      top {fmtSim(t.top_similarity)}
                    </Badge>
                    <Badge variant="secondary">{t.match_count} matches</Badge>
                    {t.used_in_answer ? (
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                        <Sparkles className="w-3 h-3 mr-1" /> used in answer
                      </Badge>
                    ) : (
                      <Badge variant="outline">retrieved, not injected</Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(t.created_at), "MMM d, HH:mm:ss")}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{t.query}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    user: {t.user_id ? `${t.user_id.slice(0, 8)}…` : "—"}
                  </p>
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 pl-7 space-y-4">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <Database className="w-3 h-3" /> Top matches
                    </h3>
                    <div className="space-y-1">
                      {t.matches.map((m, i) => (
                        <div key={`${m.id}-${i}`} className="flex items-start gap-3 text-sm py-1.5 border-b border-border/40 last:border-0">
                          <span className={`px-2 py-0.5 rounded text-xs font-mono shrink-0 ${simColor(m.similarity)}`}>
                            {fmtSim(m.similarity)}
                          </span>
                          <Badge variant="outline" className="shrink-0 text-[10px] uppercase">{m.source}</Badge>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{m.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {m.designer}
                              {(m.subcategory || m.category) && ` · ${m.subcategory || m.category}`}
                              {m.materials && ` · ${m.materials}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {t.context_text && (
                    <div>
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Injected context
                      </h3>
                      <pre className="text-xs bg-muted/50 rounded p-3 whitespace-pre-wrap font-mono max-h-80 overflow-auto">
                        {t.context_text}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
