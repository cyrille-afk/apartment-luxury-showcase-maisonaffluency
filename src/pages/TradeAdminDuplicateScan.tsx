import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import scanPairs from "@/data/duplicateScan.json";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink, RotateCcw } from "lucide-react";

type ScanProduct = { id: string; brand: string; name: string; created: string };
type ScanPair = {
  key: string;
  confidence: "exact" | "cross-brand-exact" | "high" | "medium";
  similarity: number;
  a: ScanProduct;
  b: ScanProduct;
};

const PAIRS = scanPairs as ScanPair[];
const STORAGE_KEY = "ma_duplicate_scan_marks_v1";

const CONF_ORDER: ScanPair["confidence"][] = ["exact", "cross-brand-exact", "high", "medium"];
const CONF_LABEL: Record<ScanPair["confidence"], string> = {
  exact: "Exact",
  "cross-brand-exact": "Cross-brand exact",
  high: "High (typo)",
  medium: "Medium",
};
const CONF_BADGE: Record<ScanPair["confidence"], string> = {
  exact: "bg-red-100 text-red-900 border-red-200",
  "cross-brand-exact": "bg-orange-100 text-orange-900 border-orange-200",
  high: "bg-amber-100 text-amber-900 border-amber-200",
  medium: "bg-muted text-muted-foreground",
};

function loadMarks(): Record<string, "duplicate" | "not-duplicate"> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ProductCard({ p, other }: { p: ScanProduct; other: ScanProduct }) {
  const older = new Date(p.created) < new Date(other.created);
  return (
    <div className="flex-1 rounded-md border border-border bg-background p-3 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <p className="font-body text-sm font-medium text-foreground leading-snug">{p.name}</p>
        {older && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">
            oldest
          </span>
        )}
      </div>
      <p className="font-body text-xs text-muted-foreground">{p.brand}</p>
      <p className="font-body text-xs text-muted-foreground">Created {fmtDate(p.created)}</p>
      <p className="font-mono text-[10px] text-muted-foreground break-all">{p.id}</p>
      <a
        href={`/trade/admin/glb-models?q=${encodeURIComponent(p.name)}`}
        className="inline-flex items-center gap-1 font-body text-xs text-foreground underline underline-offset-2"
      >
        Open in catalogue <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

export default function TradeAdminDuplicateScan() {
  const { isAdmin, loading } = useAuth();
  const [filter, setFilter] = useState<ScanPair["confidence"] | "all" | "marked">("all");
  const [marks, setMarks] = useState(loadMarks);

  const setMark = (key: string, value: "duplicate" | "not-duplicate" | null) => {
    setMarks((prev) => {
      const next = { ...prev };
      if (value === null) delete next[key];
      else next[key] = value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: PAIRS.length, marked: 0 };
    for (const conf of CONF_ORDER) c[conf] = 0;
    for (const p of PAIRS) {
      c[p.confidence]++;
      if (marks[p.key]) c.marked++;
    }
    return c;
  }, [marks]);

  const visible = useMemo(() => {
    if (filter === "all") return PAIRS;
    if (filter === "marked") return PAIRS.filter((p) => marks[p.key]);
    return PAIRS.filter((p) => p.confidence === filter);
  }, [filter, marks]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet>
        <title>Duplicate Scan Review — Admin — Maison Affluency</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Duplicate Scan Review</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            {PAIRS.length} candidate pairs from the catalogue scan. Marking a pair stores the decision in this
            browser only — no catalogue records are changed.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", ...CONF_ORDER, "marked"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 font-body text-xs transition-colors ${
                filter === f
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {f === "all" ? "All" : f === "marked" ? "Marked" : CONF_LABEL[f]} ({counts[f] ?? 0})
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {visible.map((pair) => {
            const mark = marks[pair.key];
            return (
              <div
                key={pair.key}
                className={`rounded-lg border bg-card p-4 space-y-3 ${
                  mark === "duplicate"
                    ? "border-red-300"
                    : mark === "not-duplicate"
                      ? "border-green-300"
                      : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CONF_BADGE[pair.confidence]}`}>
                    {CONF_LABEL[pair.confidence]}
                  </span>
                  <span className="font-body text-xs text-muted-foreground">
                    similarity {(pair.similarity * 100).toFixed(0)}%
                  </span>
                  {mark && (
                    <Badge variant="outline" className="text-[11px]">
                      {mark === "duplicate" ? "Marked duplicate" : "Marked not a duplicate"}
                    </Badge>
                  )}
                  <div className="ml-auto flex gap-2">
                    <Button
                      size="sm"
                      variant={mark === "duplicate" ? "default" : "outline"}
                      onClick={() => setMark(pair.key, mark === "duplicate" ? null : "duplicate")}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant={mark === "not-duplicate" ? "default" : "outline"}
                      onClick={() => setMark(pair.key, mark === "not-duplicate" ? null : "not-duplicate")}
                    >
                      Not a duplicate
                    </Button>
                    {mark && (
                      <Button size="sm" variant="ghost" onClick={() => setMark(pair.key, null)}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <ProductCard p={pair.a} other={pair.b} />
                  <ProductCard p={pair.b} other={pair.a} />
                </div>
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="font-body text-sm text-muted-foreground py-8 text-center">No pairs in this filter.</p>
          )}
        </div>
      </div>
    </>
  );
}
