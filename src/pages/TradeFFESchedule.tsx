import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface FFEItem {
  product_name: string;
  brand_name: string;
  category: string;
  dimensions: string | null;
  materials: string | null;
  quantity: number;
  unit_price_cents: number | null;
  quote_id: string;
  client_name: string | null;
}

export default function TradeFFESchedule() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ffe-schedule", user?.id],
    queryFn: async () => {
      const { data: quotes } = await supabase
        .from("trade_quotes")
        .select("id, client_name, status")
        .eq("user_id", user!.id)
        .in("status", ["confirmed", "submitted", "responded"]);

      if (!quotes?.length) return [];

      const quoteIds = quotes.map((q) => q.id);
      const { data: qItems } = await supabase
        .from("trade_quote_items")
        .select("product_id, quantity, unit_price_cents, quote_id")
        .in("quote_id", quoteIds);

      if (!qItems?.length) return [];

      const productIds = [...new Set(qItems.map((i) => i.product_id))];
      const { data: products } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, category, dimensions, materials")
        .in("id", productIds);

      const productMap = Object.fromEntries((products || []).map((p) => [p.id, p]));
      const quoteMap = Object.fromEntries(quotes.map((q) => [q.id, q]));

      return qItems.map((item) => {
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
          quote_id: item.quote_id,
          client_name: q?.client_name || null,
        } as FFEItem;
      });
    },
    enabled: !!user,
  });

  const handleExport = () => {
    setExporting(true);
    const headers = ["Item", "Brand", "Category", "Dimensions", "Materials", "Qty", "Unit Price", "Total", "Project"];
    const rows = items.map((item) => [
      item.product_name,
      item.brand_name,
      item.category,
      item.dimensions || "",
      item.materials || "",
      item.quantity.toString(),
      item.unit_price_cents ? `€${(item.unit_price_cents / 100).toFixed(2)}` : "TBD",
      item.unit_price_cents ? `€${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}` : "TBD",
      item.client_name || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ffe-schedule-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
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
              Furniture, Fixtures & Equipment schedule generated from your confirmed quotes.
            </p>
          </div>
          <Button onClick={handleExport} disabled={!items.length || exporting} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
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
                    {["Item", "Brand", "Category", "Dimensions", "Materials", "Qty", "Unit Price", "Total"].map((h) => (
                      <th key={h} className="px-4 py-3 font-body text-[10px] uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-body text-sm text-foreground">{item.product_name}</td>
                      <td className="px-4 py-3 font-body text-sm text-muted-foreground">{item.brand_name}</td>
                      <td className="px-4 py-3 font-body text-xs text-muted-foreground capitalize">{item.category}</td>
                      <td className="px-4 py-3 font-body text-xs text-muted-foreground">{item.dimensions || "—"}</td>
                      <td className="px-4 py-3 font-body text-xs text-muted-foreground">{item.materials || "—"}</td>
                      <td className="px-4 py-3 font-body text-sm text-foreground">{item.quantity}</td>
                      <td className="px-4 py-3 font-body text-sm text-foreground">{item.unit_price_cents ? `€${(item.unit_price_cents / 100).toFixed(2)}` : "TBD"}</td>
                      <td className="px-4 py-3 font-body text-sm text-foreground font-medium">{item.unit_price_cents ? `€${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}` : "TBD"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30">
                    <td colSpan={7} className="px-4 py-3 font-body text-sm text-foreground font-medium text-right">Total</td>
                    <td className="px-4 py-3 font-display text-sm text-foreground font-semibold">
                      {totalValue > 0 ? `€${(totalValue / 100).toFixed(2)}` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
