import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Download, FileSpreadsheet, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  downloadProcurementWorkbook,
  autoPoNumber,
  type ProcurementLine,
} from "@/lib/procurementExcel";
import { generateSpecPackageZip, downloadBlob, type SpecPackageProduct } from "@/lib/specPackage";

interface FFEItem {
  product_name: string;
  brand_name: string;
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
  client_name: string | null;
  po_number: string | null;
  cost_code: string | null;
  lead_time_weeks_override: number | null;
  deposit_pct_override: number | null;
  pdf_url: string | null;
  pdf_urls: string[] | null;
}

const QUOTE_REF = (id: string) => `QU-${id.slice(0, 6).toUpperCase()}`;

// Best-effort numeric weeks parsed from a free-text lead time (e.g. "12-14 weeks" -> 14)
function parseLeadWeeks(text: string | null): number | null {
  if (!text) return null;
  const m = text.match(/(\d+)\s*(?:-\s*(\d+))?/);
  if (!m) return null;
  return m[2] ? parseInt(m[2], 10) : parseInt(m[1], 10);
}

export default function TradeFFESchedule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ffe-schedule", user?.id],
    queryFn: async () => {
      const { data: quotes } = await supabase
        .from("trade_quotes")
        .select("id, client_name, status")
        .eq("user_id", user!.id)
        .in("status", ["confirmed", "submitted", "responded", "priced", "deposit_paid", "paid"]);

      if (!quotes?.length) return [];

      const quoteIds = quotes.map((q) => q.id);
      const { data: qItems } = await supabase
        .from("trade_quote_items")
        .select(
          "product_id, quantity, unit_price_cents, quote_id, po_number, cost_code, lead_time_weeks_override, deposit_pct_override"
        )
        .in("quote_id", quoteIds);

      if (!qItems?.length) return [];

      const productIds = [...new Set(qItems.map((i) => i.product_id))];
      const { data: products } = await supabase
        .from("trade_products")
        .select(
          "id, product_name, brand_name, category, dimensions, materials, sku, lead_time, currency, rrp_price_cents, pdf_url, pdf_urls"
        )
        .in("id", productIds);

      const productMap = Object.fromEntries((products || []).map((p) => [p.id, p]));
      const quoteMap = Object.fromEntries(quotes.map((q) => [q.id, q]));

      return qItems.map((item: any) => {
        const p = productMap[item.product_id];
        const q = quoteMap[item.quote_id];
        return {
          product_name: p?.product_name || "Unknown",
          brand_name: p?.brand_name || "",
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
          client_name: q?.client_name || null,
          po_number: item.po_number ?? null,
          cost_code: item.cost_code ?? null,
          lead_time_weeks_override: item.lead_time_weeks_override ?? null,
          deposit_pct_override: item.deposit_pct_override ?? null,
        } as FFEItem;
      });
    },
    enabled: !!user,
  });

  const handleExport = async () => {
    if (!items.length) return;
    setExporting(true);
    try {
      // Group by quote so PO auto-numbering is stable per quote
      const seqByQuote: Record<string, number> = {};
      const lines: ProcurementLine[] = items.map((item) => {
        seqByQuote[item.quote_id] = (seqByQuote[item.quote_id] || 0) + 1;
        const seq = seqByQuote[item.quote_id];
        const lead =
          item.lead_time_weeks_override ?? parseLeadWeeks(item.lead_time);
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
          client_name: items.find((i) => i.client_name)?.client_name || "—",
          designer_studio: "—",
          address: "—",
          revision: "Rev 1",
          quote_refs: [...new Set(items.map((i) => i.quote_ref))],
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

  const totalValue = items.reduce((sum, i) => sum + (i.unit_price_cents || 0) * i.quantity, 0);

  return (
    <>
      <Helmet><title>FF&E Schedule — Trade Portal</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground">FF&E Schedule</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Procurement-grade FF&E generated from your confirmed quotes — Excel export with PO numbers, lead times, deposit schedule and cost codes.
            </p>
          </div>
          <Button onClick={handleExport} disabled={!items.length || exporting} variant="outline" size="sm">
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export Excel (.xlsx)
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">No items yet. Submit a quote to generate your FF&E schedule.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["PO #", "Cost Code", "Item", "Brand", "Qty", "Unit Trade", "Total", "Lead"].map((h) => (
                      <th key={h} className="px-4 py-3 font-body text-[10px] uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const lead = item.lead_time_weeks_override ?? parseLeadWeeks(item.lead_time);
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground tabular-nums">{item.po_number || <span className="italic text-muted-foreground/60">auto</span>}</td>
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground">{item.cost_code || "—"}</td>
                        <td className="px-4 py-3 font-body text-sm text-foreground">{item.product_name}</td>
                        <td className="px-4 py-3 font-body text-sm text-muted-foreground">{item.brand_name}</td>
                        <td className="px-4 py-3 font-body text-sm text-foreground">{item.quantity}</td>
                        <td className="px-4 py-3 font-body text-sm text-foreground">{item.unit_price_cents ? `€${(item.unit_price_cents / 100).toFixed(2)}` : "TBD"}</td>
                        <td className="px-4 py-3 font-body text-sm text-foreground font-medium">{item.unit_price_cents ? `€${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}` : "TBD"}</td>
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground">{lead != null ? `${lead} wks` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30">
                    <td colSpan={6} className="px-4 py-3 font-body text-sm text-foreground font-medium text-right">Total</td>
                    <td className="px-4 py-3 font-display text-sm text-foreground font-semibold">
                      {totalValue > 0 ? `€${(totalValue / 100).toFixed(2)}` : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="font-body text-[11px] text-muted-foreground/70">
              PO numbers and cost codes can be edited per line on each quote. Empty PO numbers are auto-generated as <code>QU-XXXXXX-NNN</code> at export time.
            </p>
          </>
        )}
      </div>
    </>
  );
}
