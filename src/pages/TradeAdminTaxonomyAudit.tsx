import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, CheckCircle2, Wand2, ExternalLink } from "lucide-react";
import {
  ALL_CANONICAL_SUBCATEGORIES,
  CATEGORY_ORDER,
  SUBCATEGORY_MAP,
  normalizeCategory,
  normalizeSubcategory,
  inferSubcategory,
} from "@/lib/productTaxonomy";

type Pick = {
  id: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  subcategory: string | null;
  designer_id: string;
  designers?: { name: string; slug: string } | null;
};

type IssueType =
  | "missing_subcategory"
  | "non_canonical_subcategory"
  | "unknown_subcategory"
  | "category_subcategory_mismatch";

type AuditRow = {
  pick: Pick;
  issues: IssueType[];
  suggestedCategory: string;
  suggestedSubcategory: string;
  autoFixable: boolean; // suggestion differs from current AND is canonical
};

const ISSUE_LABELS: Record<IssueType, { label: string; tone: "destructive" | "warning" | "info" }> = {
  missing_subcategory: { label: "Missing subcategory", tone: "warning" },
  non_canonical_subcategory: { label: "Non-canonical subcategory", tone: "warning" },
  unknown_subcategory: { label: "Unknown subcategory", tone: "destructive" },
  category_subcategory_mismatch: { label: "Category / subcategory mismatch", tone: "destructive" },
};

function classifyPick(pick: Pick): AuditRow {
  const rawSub = pick.subcategory?.trim() || "";
  const rawCat = pick.category?.trim() || "";
  const issues: IssueType[] = [];

  const titleHint = [pick.title, pick.subtitle].filter(Boolean).join(" ");
  const suggestedSubcategory = inferSubcategory(rawCat || undefined, rawSub || undefined, titleHint);
  const suggestedCategory =
    normalizeCategory(rawCat || undefined, suggestedSubcategory) ||
    rawCat ||
    "Décor";

  if (!rawSub) {
    issues.push("missing_subcategory");
  } else {
    const normalized = normalizeSubcategory(rawSub) || rawSub;
    const isCanonical = ALL_CANONICAL_SUBCATEGORIES.has(normalized);
    if (!isCanonical) {
      issues.push("unknown_subcategory");
    } else if (normalized !== rawSub) {
      issues.push("non_canonical_subcategory");
    }
    // mismatch check: canonical subcategory must belong to current canonical category
    if (rawCat) {
      const canonicalCat = normalizeCategory(rawCat, normalized) || rawCat;
      const subsOfCat = SUBCATEGORY_MAP[canonicalCat] || [];
      if (isCanonical && subsOfCat.length > 0 && !subsOfCat.includes(normalized)) {
        issues.push("category_subcategory_mismatch");
      }
    }
  }

  const autoFixable =
    issues.length > 0 &&
    ALL_CANONICAL_SUBCATEGORIES.has(suggestedSubcategory) &&
    (suggestedSubcategory !== rawSub || suggestedCategory !== rawCat);

  return {
    pick,
    issues,
    suggestedCategory,
    suggestedSubcategory,
    autoFixable,
  };
}

export default function TradeAdminTaxonomyAudit() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<IssueType | "all">("all");
  const [busy, setBusy] = useState(false);

  const { data: picks = [], isLoading } = useQuery({
    queryKey: ["taxonomy-audit-picks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designer_curator_picks")
        .select("id, title, subtitle, category, subcategory, designer_id, designers(name, slug)")
        .order("title");
      if (error) throw error;
      return (data || []) as unknown as Pick[];
    },
    enabled: isAdmin,
  });

  const audit = useMemo(() => {
    const all = picks.map(classifyPick);
    const flagged = all.filter((r) => r.issues.length > 0);
    const counts: Record<IssueType, number> = {
      missing_subcategory: 0,
      non_canonical_subcategory: 0,
      unknown_subcategory: 0,
      category_subcategory_mismatch: 0,
    };
    for (const row of flagged) for (const i of row.issues) counts[i]++;
    return { all, flagged, counts };
  }, [picks]);

  const visible = useMemo(
    () => (filter === "all" ? audit.flagged : audit.flagged.filter((r) => r.issues.includes(filter))),
    [audit.flagged, filter]
  );

  const autoFixableCount = audit.flagged.filter((r) => r.autoFixable).length;

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  async function applyFix(row: AuditRow) {
    setBusy(true);
    const { error } = await supabase
      .from("designer_curator_picks")
      .update({ category: row.suggestedCategory, subcategory: row.suggestedSubcategory })
      .eq("id", row.pick.id);
    setBusy(false);
    if (error) {
      toast({ title: "Failed to apply fix", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Fixed", description: `${row.pick.title} → ${row.suggestedCategory} / ${row.suggestedSubcategory}` });
    qc.invalidateQueries({ queryKey: ["taxonomy-audit-picks"] });
    qc.invalidateQueries({ queryKey: ["trade-live-products"] });
  }

  async function applyAll() {
    const fixable = audit.flagged.filter((r) => r.autoFixable);
    if (!fixable.length) return;
    if (!confirm(`Apply ${fixable.length} auto-resolvable fixes? This will update the database.`)) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const row of fixable) {
      const { error } = await supabase
        .from("designer_curator_picks")
        .update({ category: row.suggestedCategory, subcategory: row.suggestedSubcategory })
        .eq("id", row.pick.id);
      if (error) fail++;
      else ok++;
    }
    setBusy(false);
    toast({
      title: "Bulk fix complete",
      description: `${ok} updated${fail ? `, ${fail} failed` : ""}.`,
      variant: fail > 0 ? "destructive" : "default",
    });
    qc.invalidateQueries({ queryKey: ["taxonomy-audit-picks"] });
    qc.invalidateQueries({ queryKey: ["trade-live-products"] });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Helmet>
        <title>Taxonomy Audit — Maison Affluency</title>
      </Helmet>

      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/trade/admin-dashboard"
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Back to admin dashboard"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-serif">Taxonomy Audit</h1>
          <p className="text-sm text-muted-foreground">
            Curator picks whose category or subcategory would be filtered out of the canonical grids.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <SummaryCard
          label="All picks"
          value={audit.all.length}
          active={filter === "all"}
          onClick={() => setFilter("all")}
          tone="info"
        />
        <SummaryCard
          label="Flagged"
          value={audit.flagged.length}
          active={filter === "all"}
          onClick={() => setFilter("all")}
          tone={audit.flagged.length > 0 ? "warning" : "info"}
        />
        {(Object.keys(ISSUE_LABELS) as IssueType[]).map((k) => (
          <SummaryCard
            key={k}
            label={ISSUE_LABELS[k].label}
            value={audit.counts[k]}
            active={filter === k}
            onClick={() => setFilter(k)}
            tone={ISSUE_LABELS[k].tone}
          />
        ))}
      </div>

      {/* Bulk action */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{visible.length}</span> of {audit.flagged.length} flagged
          {filter !== "all" && (
            <>
              {" "}
              · filter: <Badge variant="outline">{ISSUE_LABELS[filter].label}</Badge>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{autoFixableCount} auto-resolvable</Badge>
          <Button onClick={applyAll} disabled={busy || autoFixableCount === 0} size="sm">
            <Wand2 className="h-4 w-4 mr-2" />
            Fix all auto-resolvable
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600 mb-3" />
            <p className="text-sm text-muted-foreground">
              {audit.flagged.length === 0 ? "All picks pass canonical taxonomy checks." : "No picks match this filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Pick</th>
                  <th className="text-left px-4 py-3 font-medium">Designer</th>
                  <th className="text-left px-4 py-3 font-medium">Current</th>
                  <th className="text-left px-4 py-3 font-medium">Issues</th>
                  <th className="text-left px-4 py-3 font-medium">Suggested</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const sameCat = row.suggestedCategory === (row.pick.category || "");
                  const sameSub = row.suggestedSubcategory === (row.pick.subcategory || "");
                  return (
                    <tr key={row.pick.id} className="border-t border-border/60 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.pick.title}</div>
                        {row.pick.subtitle && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.pick.subtitle}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.pick.designers ? (
                          <Link
                            to={`/trade/designers/${row.pick.designers.slug}`}
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {row.pick.designers.name}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">Cat</div>
                        <div className="font-mono text-xs">{row.pick.category || <em className="text-muted-foreground">∅</em>}</div>
                        <div className="text-xs text-muted-foreground mt-1">Sub</div>
                        <div className="font-mono text-xs">{row.pick.subcategory || <em className="text-muted-foreground">∅</em>}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {row.issues.map((i) => (
                            <Badge
                              key={i}
                              variant={ISSUE_LABELS[i].tone === "destructive" ? "destructive" : "secondary"}
                              className="w-fit text-[10px]"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {ISSUE_LABELS[i].label}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">Cat</div>
                        <div className={`font-mono text-xs ${sameCat ? "" : "text-emerald-700 dark:text-emerald-400"}`}>
                          {row.suggestedCategory}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Sub</div>
                        <div className={`font-mono text-xs ${sameSub ? "" : "text-emerald-700 dark:text-emerald-400"}`}>
                          {row.suggestedSubcategory}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={row.autoFixable ? "default" : "outline"}
                          disabled={busy || !row.autoFixable}
                          onClick={() => applyFix(row)}
                        >
                          Apply fix
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground mt-6">
        Canonical categories: {CATEGORY_ORDER.join(" · ")}. Suggestions use the same inference logic as the public/trade
        grids ({" "}
        <code className="font-mono">inferSubcategory</code> + <code className="font-mono">normalizeCategory</code>).
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  onClick,
  active,
  tone,
}: {
  label: string;
  value: number;
  onClick: () => void;
  active: boolean;
  tone: "info" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "destructive"
      ? "border-destructive/40"
      : tone === "warning"
      ? "border-amber-500/40"
      : "border-border";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition hover:bg-muted/50 ${toneClass} ${
        active ? "ring-2 ring-primary/50" : ""
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </button>
  );
}
