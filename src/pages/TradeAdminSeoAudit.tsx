import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, AlertTriangle, CheckCircle2, ExternalLink, Search } from "lucide-react";

type Row = {
  path: string;
  status: number;
  title: string;
  description: string;
  canonical: string;
  h1: string;
  issues: string[];
  error?: string;
};

type Report = {
  summary: {
    base: string;
    total: number;
    ok: number;
    withIssues: number;
    duplicateTitles: number;
    duplicateDescriptions: number;
    duplicateCanonicals: number;
    elapsedMs: number;
  };
  rows: Row[];
};

const ISSUE_LABELS: Record<string, string> = {
  missing_title: "Missing title",
  missing_description: "Missing description",
  missing_canonical: "Missing canonical",
  duplicate_title: "Duplicate title",
  duplicate_description: "Duplicate description",
  duplicate_canonical: "Duplicate canonical",
  canonical_mismatch: "Canonical mismatch",
};

const TradeAdminSeoAudit = () => {
  const [base, setBase] = useState("https://www.maisonaffluency.com");
  const [includeProducts, setIncludeProducts] = useState(false);
  const [filter, setFilter] = useState<"all" | "issues">("issues");
  const [search, setSearch] = useState("");

  const audit = useMutation({
    mutationFn: async (): Promise<Report> => {
      const params = new URLSearchParams({ base });
      if (includeProducts) params.set("products", "1");
      const { data, error } = await supabase.functions.invoke(
        `seo-audit?${params.toString()}`,
        { method: "GET" }
      );
      if (error) throw error;
      return data as Report;
    },
  });

  const report = audit.data;
  const rows = (report?.rows ?? []).filter((r) => {
    if (filter === "issues" && r.issues.length === 0) return false;
    if (search && !r.path.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>SEO Audit — Trade Admin</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <Link to="/trade/admin-dashboard">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-3xl font-serif mb-2">SEO Audit</h1>
          <p className="text-muted-foreground text-sm">
            Fetches every public route and reports its <code>&lt;title&gt;</code>,
            <code>&lt;meta description&gt;</code>, and <code>&lt;link rel=canonical&gt;</code>.
            Flags duplicates and missing tags.
          </p>
        </div>

        <Card className="p-6 mb-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] items-end">
            <div>
              <Label htmlFor="base">Base URL</Label>
              <Input
                id="base"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="https://www.maisonaffluency.com"
              />
            </div>
            <label className="flex items-center gap-2 pb-2">
              <Checkbox
                checked={includeProducts}
                onCheckedChange={(v) => setIncludeProducts(v === true)}
              />
              <span className="text-sm">Include product pages (sample)</span>
            </label>
            <Button onClick={() => audit.mutate()} disabled={audit.isPending}>
              {audit.isPending ? "Auditing…" : "Run audit"}
            </Button>
          </div>
          {audit.isError && (
            <p className="text-sm text-destructive mt-3">
              {(audit.error as Error)?.message ?? "Audit failed"}
            </p>
          )}
        </Card>

        {report && (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
              <Stat label="Routes" value={report.summary.total} />
              <Stat
                label="OK"
                value={report.summary.ok}
                tone={report.summary.ok === report.summary.total ? "good" : "neutral"}
              />
              <Stat
                label="With issues"
                value={report.summary.withIssues}
                tone={report.summary.withIssues > 0 ? "bad" : "good"}
              />
              <Stat
                label="Duplicate titles"
                value={report.summary.duplicateTitles}
                tone={report.summary.duplicateTitles > 0 ? "bad" : "good"}
              />
            </div>

            <div className="flex flex-wrap gap-3 items-center mb-4">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={filter === "issues" ? "default" : "outline"}
                  onClick={() => setFilter("issues")}
                >
                  Issues only ({report.summary.withIssues})
                </Button>
                <Button
                  size="sm"
                  variant={filter === "all" ? "default" : "outline"}
                  onClick={() => setFilter("all")}
                >
                  All ({report.summary.total})
                </Button>
              </div>
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by path…"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground ml-auto">
                Audit took {(report.summary.elapsedMs / 1000).toFixed(1)}s
              </p>
            </div>

            <div className="space-y-2">
              {rows.map((r) => (
                <Card key={r.path} className="p-4">
                  <div className="flex items-start gap-3">
                    {r.issues.length === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <a
                          href={`${report.summary.base}${r.path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-sm hover:underline"
                        >
                          {r.path}
                        </a>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        <Badge variant={r.status === 200 ? "secondary" : "destructive"}>
                          {r.status || "ERR"}
                        </Badge>
                        {r.issues.map((i) => (
                          <Badge key={i} variant="destructive" className="text-xs">
                            {ISSUE_LABELS[i] ?? i}
                          </Badge>
                        ))}
                      </div>
                      <dl className="text-xs grid gap-1 mt-2">
                        <Field label="title" value={r.title} />
                        <Field label="description" value={r.description} />
                        <Field label="canonical" value={r.canonical} mono />
                        {r.h1 && <Field label="h1" value={r.h1} />}
                        {r.error && <Field label="error" value={r.error} mono />}
                      </dl>
                    </div>
                  </div>
                </Card>
              ))}
              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No routes match the current filter.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "good" | "bad" | "neutral";
}) => (
  <Card className="p-4">
    <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
    <p
      className={
        "text-2xl font-medium mt-1 " +
        (tone === "good" ? "text-green-600" : tone === "bad" ? "text-destructive" : "")
      }
    >
      {value}
    </p>
  </Card>
);

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="grid grid-cols-[90px_1fr] gap-2">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={mono ? "font-mono break-all" : "break-words"}>
      {value || <span className="italic text-muted-foreground">— empty —</span>}
    </dd>
  </div>
);

export default TradeAdminSeoAudit;
