/**
 * Outbound acquisition dashboard.
 *
 * Studio leads ingested from our scraping / enrichment provider, enriched with
 * an AI reading of their design aesthetic and the two Maison Affluency
 * designers they would naturally specify, then dispatched as personalised
 * trade invitations. Admin-only — RLS on `prospect_studios` is the control,
 * the guard below is convenience.
 */
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  MailCheck,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

type Match = { slug: string; name: string; specialty?: string | null; rationale?: string };

type EnrichmentStatus = "pending" | "processing" | "complete" | "failed";

type Prospect = {
  id: string;
  studio_name: string;
  founder_name: string | null;
  business_email: string;
  website_url: string | null;
  recent_design_keywords: string[] | null;
  lead_source: string;
  aesthetic_label: string | null;
  aesthetic_summary: string | null;
  matched_designers: Match[] | null;
  enrichment_status: EnrichmentStatus;
  enrichment_error: string | null;
  email_sent_status: boolean;
  email_sent_at: string | null;
  email_error: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<EnrichmentStatus, string> = {
  pending: "border-muted-foreground/30 text-muted-foreground",
  processing: "border-sky-500/40 text-sky-600",
  complete: "border-emerald-500/40 text-emerald-600",
  failed: "border-destructive/40 text-destructive",
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const TradeAdminOutbound = () => {
  const { user, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user && isAdmin;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "unsent" | "sent" | "pending">("all");
  const [dispatching, setDispatching] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["prospect-studios"],
    enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_studios")
        .select(
          "id, studio_name, founder_name, business_email, website_url, recent_design_keywords, lead_source, aesthetic_label, aesthetic_summary, matched_designers, enrichment_status, enrichment_error, email_sent_status, email_sent_at, email_error, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Prospect[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "ready" && !(r.enrichment_status === "complete" && !r.email_sent_status)) return false;
      if (filter === "unsent" && r.email_sent_status) return false;
      if (filter === "sent" && !r.email_sent_status) return false;
      if (filter === "pending" && r.enrichment_status === "complete") return false;
      if (!q) return true;
      return [r.studio_name, r.founder_name, r.business_email, r.aesthetic_label]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, filter]);

  const summary = useMemo(
    () => ({
      total: rows.length,
      enriched: rows.filter((r) => r.enrichment_status === "complete").length,
      awaiting: rows.filter((r) => r.enrichment_status !== "complete").length,
      sent: rows.filter((r) => r.email_sent_status).length,
    }),
    [rows],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((r) => r.id)));

  const runEnrichment = async () => {
    setEnriching(true);
    try {
      const ids = Array.from(selected);
      const { data, error } = await supabase.functions.invoke("enrich-prospect-aesthetics", {
        body: ids.length ? { ids, batchSize: ids.length } : { batchSize: 10 },
      });
      const failure = (data as { error?: string } | null)?.error;
      if (error || failure) throw new Error(failure || error?.message || "Analysis failed.");
      const result = data as { processed: number; failed: number; remaining: number; halted?: string | null };
      if (result.halted) {
        toast.error("AI analysis paused — the AI service refused further requests. Try again later.");
      } else {
        toast.success(
          `Analysed ${result.processed} studio${result.processed === 1 ? "" : "s"}. ${result.remaining} still queued.`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["prospect-studios"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setEnriching(false);
    }
  };

  const launchCampaigns = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setDispatching(true);
    try {
      const { data, error } = await supabase.functions.invoke("dispatch-prospect-campaign", {
        body: { ids },
      });
      const failure = (data as { error?: string } | null)?.error;
      if (error || failure) throw new Error(failure || error?.message || "Dispatch failed.");
      const result = data as { sent: number; skipped: number; failed: number };
      toast.success(
        `${result.sent} invitation${result.sent === 1 ? "" : "s"} sent.` +
          (result.skipped ? ` ${result.skipped} skipped.` : "") +
          (result.failed ? ` ${result.failed} failed.` : ""),
      );
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["prospect-studios"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dispatch failed.");
    } finally {
      setDispatching(false);
    }
  };

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  if (!enabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-10 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <h1 className="font-serif text-2xl">403 — Forbidden</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Outbound acquisition is restricted to internal administrators.
        </p>
        <Link to="/trade" className="text-sm underline underline-offset-4">
          Return to the Trade Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Helmet>
        <title>Outbound Acquisition — Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Link
        to="/trade"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Trade Portal
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.35em] text-muted-foreground">
            Acquisition
          </p>
          <h1 className="mt-2 font-serif text-3xl">Outbound studios</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Ingested studio leads, read for aesthetic and matched to the two designers they would
            naturally specify, ready for a personalised trade invitation.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-4 text-right">
          {[
            ["Leads", summary.total],
            ["Analysed", summary.enriched],
            ["Queued", summary.awaiting],
            ["Invited", summary.sent],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="font-serif text-2xl">{value as number}</div>
              <div className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk actions toolbar */}
      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-sm border border-border bg-card/60 px-4 py-3">
        <Checkbox
          checked={allVisibleSelected}
          onCheckedChange={toggleAll}
          aria-label="Select all visible prospects"
        />
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {selected.size} selected
        </span>
        <div className="mx-2 h-6 w-px bg-border" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search studio, founder, email…"
          className="h-9 w-56"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All leads</SelectItem>
            <SelectItem value="ready">Ready to invite</SelectItem>
            <SelectItem value="pending">Awaiting analysis</SelectItem>
            <SelectItem value="unsent">Not yet invited</SelectItem>
            <SelectItem value="sent">Already invited</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runEnrichment} disabled={enriching}>
            {enriching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {selected.size ? "Re-analyse selected" : "Analyse queue"}
          </Button>
          <Button
            size="sm"
            onClick={launchCampaigns}
            disabled={dispatching || selected.size === 0}
            className="bg-[#c9a961] text-[#07110f] hover:bg-[#b89751]"
          >
            {dispatching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Launch Personalized Resend Campaigns
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-sm border border-border">
        <table className="w-full min-w-[960px] text-left">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
              <th className="w-10 px-4 py-3"></th>
              <th className="px-5 py-3">Studio</th>
              <th className="px-5 py-3">Aesthetic</th>
              <th className="px-5 py-3">Designer matches</th>
              <th className="px-5 py-3">Analysis</th>
              <th className="px-5 py-3">Invitation</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Loading leads…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No leads match this view. Ingested leads appear here automatically.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-border/60 align-top last:border-0">
                <td className="px-4 py-4">
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={() => toggle(row.id)}
                    aria-label={`Select ${row.studio_name}`}
                  />
                </td>
                <td className="px-5 py-4">
                  <div className="font-serif text-base">{row.studio_name}</div>
                  {row.founder_name && (
                    <div className="text-xs text-muted-foreground">{row.founder_name}</div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">{row.business_email}</div>
                  {row.website_url && (
                    <a
                      href={row.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs underline underline-offset-4"
                    >
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </td>
                <td className="max-w-xs px-5 py-4">
                  {row.aesthetic_label ? (
                    <>
                      <div className="text-sm">{row.aesthetic_label}</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {row.aesthetic_summary}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  {(row.recent_design_keywords ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(row.recent_design_keywords ?? []).slice(0, 5).map((k) => (
                        <Badge key={k} variant="outline" className="text-[0.6rem] font-normal">
                          {k}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-5 py-4">
                  {(row.matched_designers ?? []).length > 0 ? (
                    <ul className="space-y-2">
                      {(row.matched_designers ?? []).map((m) => (
                        <li key={m.slug}>
                          <a
                            href={`/designers/${m.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm underline underline-offset-4"
                          >
                            {m.name}
                          </a>
                          {m.rationale && (
                            <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                              {m.rationale}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <Badge variant="outline" className={STATUS_STYLE[row.enrichment_status]}>
                    {row.enrichment_status}
                  </Badge>
                  {row.enrichment_error && (
                    <p className="mt-1 max-w-[12rem] text-[0.65rem] text-destructive">
                      {row.enrichment_error}
                    </p>
                  )}
                  <div className="mt-1 text-[0.65rem] text-muted-foreground">
                    {row.lead_source} · {fmtDate(row.created_at)}
                  </div>
                </td>
                <td className="px-5 py-4">
                  {row.email_sent_status ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <MailCheck className="h-4 w-4" /> {fmtDate(row.email_sent_at)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not sent</span>
                  )}
                  {row.email_error && (
                    <p className="mt-1 max-w-[12rem] text-[0.65rem] text-destructive">
                      {row.email_error}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="h-3 w-3" /> Leads refresh automatically every 30 seconds.
      </div>
    </div>
  );
};

export default TradeAdminOutbound;
