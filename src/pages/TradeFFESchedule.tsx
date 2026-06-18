import { Helmet } from "react-helmet-async";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Download, FileSpreadsheet, Loader2, Package, FolderKanban, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";
import {
  downloadProcurementWorkbook,
  autoPoNumber,
  type ProcurementLine,
} from "@/lib/procurementExcel";
import { generateSpecPackageZip, downloadBlob, type SpecPackageProduct } from "@/lib/specPackage";
import { fillTradeProductImageFallbacks } from "@/lib/tradeProductImageFallback";

interface FFEItem {
  item_id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  category: string;
  dimensions: string | null;
  materials: string | null;
  quantity: number;
  unit_price_cents: number | null;
  rrp_price_cents: number | null;
  currency: string;
  sku: string | null;
  lead_time: string | null;
  quote_id: string;
  quote_ref: string;          // QU-XXXXXX
  quote_created_at: string | null;
  client_name: string | null;
  project_id: string | null;
  project_name: string | null;
  studio_id: string | null;
  studio_name: string | null;
  po_number: string | null;
  cost_code: string | null;
  lead_time_weeks_override: number | null;
  deposit_pct_override: number | null;
  spec_sheet_url: string | null;
  required_by_date: string | null;
  kanban_status: string | null;
  deposit_paid_at: string | null;
  shipping_weeks: number | null;
  estimated_delivery_at: string | null;
  actual_delivery_at: string | null;
}

const QUOTE_REF = (id: string) => `QU-${id.slice(0, 6).toUpperCase()}`;

const STAGE_LABEL: Record<string, string> = {
  not_started: "Not started",
  deposit_pending: "Deposit pending",
  in_production: "In production",
  ready_to_ship: "Ready to ship",
  in_transit: "In transit",
  customs: "Customs",
  delivered: "Delivered",
};

function expectedReadyDate(it: FFEItem, leadWeeks: number | null): Date | null {
  if (it.actual_delivery_at) return new Date(it.actual_delivery_at);
  if (it.estimated_delivery_at) return new Date(it.estimated_delivery_at);
  const anchor = it.deposit_paid_at || it.quote_created_at;
  if (!anchor || leadWeeks == null) return null;
  const d = new Date(anchor);
  const totalWeeks = leadWeeks + (it.shipping_weeks || 0);
  d.setDate(d.getDate() + totalWeeks * 7);
  return d;
}

function fmtDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

function slackBadge(slackDays: number | null) {
  if (slackDays == null) return <span className="text-muted-foreground">—</span>;
  if (slackDays < 0)
    return <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[10px] font-medium tabular-nums">{slackDays}d late</span>;
  if (slackDays <= 14)
    return <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-medium tabular-nums">{slackDays}d slack</span>;
  return <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-medium tabular-nums">{slackDays}d slack</span>;
}

// Best-effort numeric weeks parsed from a free-text lead time. Returns the upper bound
// of a range (e.g. "12-14 weeks" → 14, "18 to 20 weeks" → 20). Supports -, –, —, "to".
function parseLeadWeeks(text: string | null): number | null {
  if (!text) return null;
  const range = text.match(/(\d+)\s*(?:-|–|—|to)\s*(\d+)/i);
  if (range) return parseInt(range[2], 10);
  const single = text.match(/\d+/);
  return single ? parseInt(single[0], 10) : null;
}

function leadOverride(value: number | null): number | null {
  return value != null && value >= 0 ? value : null;
}

export default function TradeFFESchedule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const { projectFilter, clearProjectFilter } = useProjectFilter();
  const [projectName, setProjectName] = useState<string | null>(null);

  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [filterStudioId, setFilterStudioId] = useState<string>("");
  const [filterClient, setFilterClient] = useState<string>("");

  useEffect(() => {
    if (!projectFilter) { setProjectName(null); return; }
    (async () => {
      const { data } = await supabase
        .from("projects" as any)
        .select("name")
        .eq("id", projectFilter)
        .maybeSingle();
      setProjectName((data as any)?.name || null);
    })();
  }, [projectFilter]);

  useEffect(() => {
    if (projectFilter) setFilterProjectId(projectFilter);
  }, [projectFilter]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ffe-schedule", user?.id, projectFilter],
    queryFn: async () => {
      let qq = supabase
        .from("trade_quotes")
        .select("id, client_name, status, project_id, studio_id, created_at")
        .eq("user_id", user!.id)
        .in("status", ["confirmed", "submitted", "responded", "priced", "deposit_paid", "paid"]);
      if (projectFilter) qq = qq.eq("project_id", projectFilter);
      const { data: quotes } = await qq;

      if (!quotes?.length) return [];

      const quoteIds = quotes.map((q) => q.id);
      const { data: qItems } = await supabase
        .from("trade_quote_items")
        .select(
          "id, product_id, quantity, unit_price_cents, quote_id, po_number, cost_code, lead_time_weeks_override, deposit_pct_override, required_by_date"
        )
        .in("quote_id", quoteIds);

      if (!qItems?.length) return [];

      const productIds = [...new Set(qItems.map((i) => i.product_id))];
      const { data: productsRaw } = await supabase
        .from("trade_products")
        .select(
          "id, product_name, brand_name, category, dimensions, materials, sku, lead_time, currency, rrp_price_cents, spec_sheet_url, image_url"
        )
        .in("id", productIds);
      const products = await fillTradeProductImageFallbacks((productsRaw || []) as any[]);

      const projectIds = [...new Set(quotes.map((q: any) => q.project_id).filter(Boolean))] as string[];
      const studioIds = [...new Set(quotes.map((q: any) => q.studio_id).filter(Boolean))] as string[];
      const [{ data: projects }, { data: studios }, { data: timelines }] = await Promise.all([
        projectIds.length
          ? supabase.from("projects" as any).select("id, name").in("id", projectIds)
          : Promise.resolve({ data: [] as any[] }),
        studioIds.length
          ? supabase.from("studios" as any).select("id, name").in("id", studioIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("order_timeline" as any)
          .select("quote_id, kanban_status, deposit_paid_at, shipping_weeks, estimated_delivery_at, actual_delivery_at")
          .in("quote_id", quoteIds),
      ]);
      const projectMap = Object.fromEntries(((projects as any[]) || []).map((p: any) => [p.id, p.name]));
      const studioMap = Object.fromEntries(((studios as any[]) || []).map((s: any) => [s.id, s.name]));
      const timelineMap = Object.fromEntries(((timelines as any[]) || []).map((t: any) => [t.quote_id, t]));

      const productMap = Object.fromEntries((products || []).map((p) => [p.id, p]));
      const quoteMap = Object.fromEntries(quotes.map((q) => [q.id, q]));

      return qItems.map((item: any) => {
        const p = productMap[item.product_id];
        const q: any = quoteMap[item.quote_id];
        const tl: any = timelineMap[item.quote_id] || {};
        return {
          item_id: item.id,
          product_name: p?.product_name || "Unknown",
          brand_name: p?.brand_name || "",
          image_url: (p as any)?.image_url || null,
          category: p?.category || "",
          dimensions: p?.dimensions || null,
          materials: p?.materials || null,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          rrp_price_cents: p?.rrp_price_cents ?? null,
          currency: p?.currency || "EUR",
          sku: p?.sku || null,
          lead_time: p?.lead_time || null,
          quote_id: item.quote_id,
          quote_ref: QUOTE_REF(item.quote_id),
          quote_created_at: q?.created_at || null,
          client_name: q?.client_name || null,
          project_id: q?.project_id || null,
          project_name: q?.project_id ? (projectMap[q.project_id] || null) : null,
          studio_id: q?.studio_id || null,
          studio_name: q?.studio_id ? (studioMap[q.studio_id] || null) : null,
          po_number: item.po_number ?? null,
          cost_code: item.cost_code ?? null,
          lead_time_weeks_override: item.lead_time_weeks_override ?? null,
          deposit_pct_override: item.deposit_pct_override ?? null,
          spec_sheet_url: p?.spec_sheet_url ?? null,
          required_by_date: item.required_by_date ?? null,
          kanban_status: tl.kanban_status ?? null,
          deposit_paid_at: tl.deposit_paid_at ?? null,
          shipping_weeks: tl.shipping_weeks ?? null,
          estimated_delivery_at: tl.estimated_delivery_at ?? null,
          actual_delivery_at: tl.actual_delivery_at ?? null,
        } as FFEItem;
      });
    },
    enabled: !!user,
  });

  const qc = useQueryClient();
  const saveRequiredBy = async (itemId: string, date: string) => {
    const { error } = await supabase
      .from("trade_quote_items")
      .update({ required_by_date: date || null })
      .eq("id", itemId);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["ffe-schedule"] });
    qc.invalidateQueries({ queryKey: ["delivery-tracker"] });
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterProjectId && item.project_id !== filterProjectId) return false;
      if (filterStudioId && item.studio_id !== filterStudioId) return false;
      if (filterClient && item.client_name !== filterClient) return false;
      return true;
    });
  }, [items, filterProjectId, filterStudioId, filterClient]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => { if (i.project_id && i.project_name) map.set(i.project_id, i.project_name); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const studioOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => { if (i.studio_id && i.studio_name) map.set(i.studio_id, i.studio_name); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => { if (i.client_name) set.add(i.client_name); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const hasActiveFilters = filterProjectId || filterStudioId || filterClient;
  const clearFilters = () => {
    setFilterProjectId("");
    setFilterStudioId("");
    setFilterClient("");
    if (projectFilter) clearProjectFilter();
  };

  const handleExport = async () => {
    if (!filteredItems.length) return;
    setExporting(true);
    try {
      // Group by quote so PO auto-numbering is stable per quote
      const seqByQuote: Record<string, number> = {};
      const lines: ProcurementLine[] = filteredItems.map((item) => {
        seqByQuote[item.quote_id] = (seqByQuote[item.quote_id] || 0) + 1;
        const seq = seqByQuote[item.quote_id];
        const lead =
          leadOverride(item.lead_time_weeks_override) ?? parseLeadWeeks(item.lead_time);
        return {
          po_number: item.po_number || autoPoNumber(item.quote_ref, seq),
          cost_code: item.cost_code || "",
          room: item.client_name || "",
          item_code: item.sku || "",
          designer: item.brand_name,
          product_name: item.product_name,
          finish_or_com: [item.dimensions, item.materials].filter(Boolean).join(" · "),
          quantity: item.quantity,
          unit_rrp_cents: item.rrp_price_cents,
          unit_trade_cents: item.unit_price_cents,
          currency: item.currency,
          lead_time_weeks: lead,
          deposit_pct: item.deposit_pct_override ?? 0.6,
          status: "Confirmed",
          supplier: item.brand_name,
          notes: item.category || "",
        };
      });

      const today = new Date().toISOString().slice(0, 10);
      await downloadProcurementWorkbook({
        meta: {
          project_name: "FF&E Schedule",
          client_name: filteredItems.find((i) => i.client_name)?.client_name || "—",
          designer_studio: "—",
          address: "—",
          revision: "Rev 1",
          quote_refs: [...new Set(filteredItems.map((i) => i.quote_ref))],
        },
        lines,
        fileName: `ffe-schedule-${today}.xlsx`,
      });
      toast({ title: "Excel export ready", description: "Procurement workbook downloaded." });
    } catch (err: any) {
      toast({
        title: "Export failed",
        description: err?.message || "Unable to generate workbook.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const [packaging, setPackaging] = useState(false);
  const handleSpecPackage = async () => {
    if (!filteredItems.length) return;
    setPackaging(true);
    try {
      // Deduplicate by product_name+brand for cleaner ZIP
      const seen = new Set<string>();
      const products: SpecPackageProduct[] = [];
      for (const it of filteredItems) {
        const key = `${it.brand_name}|${it.product_name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        products.push({
          product_name: it.product_name,
          brand_name: it.brand_name,
          category: it.category,
          sku: it.sku,
          dimensions: it.dimensions,
          materials: it.materials,
          lead_time: it.lead_time,
          pdf_url: it.spec_sheet_url,
        });
      }
      const projectName = filteredItems.find((i) => i.client_name)?.client_name || "Project";
      const { blob, filename, missingPdfs } = await generateSpecPackageZip(products, {
        projectName,
        studioName: "Maison Affluency",
      });
      downloadBlob(blob, filename);
      toast({
        title: "Spec package ready",
        description: missingPdfs.length
          ? `Downloaded with ${products.length} cover sheets. ${missingPdfs.length} attached PDFs were unreachable.`
          : `Downloaded with ${products.length} structured cover sheets.`,
      });
    } catch (err: any) {
      toast({ title: "Spec package failed", description: err?.message || "Unable to build ZIP.", variant: "destructive" });
    } finally {
      setPackaging(false);
    }
  };

  const totalValue = filteredItems.reduce((sum, i) => sum + (i.unit_price_cents || 0) * i.quantity, 0);

  return (
    <>
      <Helmet><title>FF&E Schedule — Trade Portal</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <TradeBreadcrumb current="FF&E schedule" currentProjectTab="ffe" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground">FF&E Schedule</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Procurement-grade FF&E generated from your confirmed quotes — Excel export with PO numbers, lead times, deposit schedule and cost codes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSpecPackage} disabled={!filteredItems.length || packaging} variant="outline" size="sm">
              {packaging ? <DotCircleLoader size="sm" className="mr-2" /> : <Package className="h-4 w-4 mr-2" />}
              Spec Package (.zip)
            </Button>
            <Button onClick={handleExport} disabled={!filteredItems.length || exporting} variant="outline" size="sm">
              {exporting ? <DotCircleLoader size="sm" className="mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Export Excel (.xlsx)
            </Button>
          </div>
        </div>

        {projectFilter && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-body text-xs text-muted-foreground truncate">
                Showing FF&E for project:{" "}
                <Link to={`/trade/projects/${projectFilter}`} className="text-foreground underline underline-offset-2">
                  {projectName || "loading…"}
                </Link>
              </span>
            </div>
            <button
              onClick={clearProjectFilter}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background hover:bg-muted/40 px-2 py-0.5 font-body text-[11px] text-muted-foreground"
            >
              Clear <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><DotCircleLoader size="sm" className="text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">No items yet. Submit a quote to generate your FF&E schedule.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                <span className="font-body text-[11px] uppercase tracking-wider">Filter by</span>
              </div>
              <select
                value={filterProjectId}
                onChange={(e) => setFilterProjectId(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 font-body text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Projects</option>
                {projectOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <select
                value={filterStudioId}
                onChange={(e) => setFilterStudioId(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 font-body text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Studios</option>
                {studioOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 font-body text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Clients</option>
                {clientOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background hover:bg-muted/40 px-2 py-0.5 font-body text-[11px] text-muted-foreground"
                >
                  Clear <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-lg">
                <p className="font-body text-sm text-muted-foreground">No items match your filters.</p>
              </div>
            ) : (
                <>
                  <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["", "PO #", "Cost Code", "Item", "Brand", "Project", "Client", "Studio", "Qty", "Unit Trade", "Total", "Lead", "Stage", "Expected ready", "Required by", "Slack", "Quote"].map((h, idx) => (
                      <th key={idx} className="px-4 py-3 font-body text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, i) => {
                    const lead = leadOverride(item.lead_time_weeks_override) ?? parseLeadWeeks(item.lead_time);
                    const expected = expectedReadyDate(item, lead);
                    const requiredBy = item.required_by_date ? new Date(item.required_by_date) : null;
                    const slackDays = expected && requiredBy
                      ? Math.round((requiredBy.getTime() - expected.getTime()) / 86400000)
                      : null;
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground tabular-nums">{item.po_number || <span className="italic text-muted-foreground/60">auto</span>}</td>
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground">{item.cost_code || "—"}</td>
                        <td className="px-4 py-3 font-body text-sm text-foreground">{item.product_name}</td>
                        <td className="px-4 py-3 font-body text-sm text-muted-foreground">{item.brand_name}</td>
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground">
                          {item.project_id ? (
                            <Link to={`/trade/projects/${item.project_id}`} className="text-foreground underline underline-offset-2">
                              {item.project_name || "—"}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground">{item.client_name || "—"}</td>
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground">{item.studio_name || "—"}</td>
                        <td className="px-4 py-3 font-body text-sm text-foreground">{item.quantity}</td>
                        <td className="px-4 py-3 font-body text-sm text-foreground">{item.unit_price_cents ? `€${(item.unit_price_cents / 100).toFixed(2)}` : "TBD"}</td>
                        <td className="px-4 py-3 font-body text-sm text-foreground font-medium">{item.unit_price_cents ? `€${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}` : "TBD"}</td>
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground">{lead === 0 ? <span className="text-emerald-700 font-medium">In stock</span> : lead != null ? `${lead} wks` : "—"}</td>
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground whitespace-nowrap">{STAGE_LABEL[item.kanban_status || ""] || (item.kanban_status ? item.kanban_status : "—")}</td>
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground whitespace-nowrap tabular-nums">{fmtDate(expected)}</td>
                        <td className="px-4 py-3 font-body text-xs">
                          <input
                            type="date"
                            defaultValue={item.required_by_date || ""}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if ((v || null) !== (item.required_by_date || null)) saveRequiredBy(item.item_id, v);
                            }}
                            className="rounded border border-border bg-background px-1.5 py-0.5 font-body text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                        <td className="px-4 py-3 font-body text-xs whitespace-nowrap">{slackBadge(slackDays)}</td>
                        <td className="px-4 py-3 font-body text-xs">
                          <Link to={`/trade/quotes?id=${item.quote_id}`} className="text-foreground underline underline-offset-2 tabular-nums">
                            {item.quote_ref}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30">
                    <td colSpan={9} className="px-4 py-3 font-body text-sm text-foreground font-medium text-right">Total</td>
                    <td className="px-4 py-3 font-display text-sm text-foreground font-semibold">
                      {totalValue > 0 ? `€${(totalValue / 100).toFixed(2)}` : "—"}
                    </td>
                    <td colSpan={6} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="font-body text-[11px] text-muted-foreground/70">
              PO numbers and cost codes can be edited per line on each quote. Empty PO numbers are auto-generated as <code>QU-XXXXXX-NNN</code> at export time.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
