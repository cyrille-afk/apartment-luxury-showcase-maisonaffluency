import { useState, useRef } from "react";
import { Upload, Loader2, CheckCircle2, FileSpreadsheet, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface ImportRow {
  product_name: string;
  trade_price?: number;
  rrp_price?: number;
  currency: string;
}

interface ImportResult {
  matched: number;
  created: number;
  skipped: string[];
}

/** Parse a single CSV line respecting quoted fields like "18,900" */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): ImportRow[] {
  const allLines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const lines = allLines.filter(l => l.replace(/,/g, "").trim().length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const nameIdx = header.findIndex(h => h.includes("product") || h.includes("name") || h.includes("item"));
  const tradeIdx = header.findIndex(h => h.includes("trade"));
  const rrpIdx = header.findIndex(h => h.includes("rrp") || h.includes("retail"));
  const currIdx = header.findIndex(h => h.includes("currency") || h.includes("curr"));

  // Need at least product name and one price column
  if (nameIdx === -1 || (tradeIdx === -1 && rrpIdx === -1)) return [];

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = cols[nameIdx]?.trim();
    if (!name) continue;

    const tradeStr = tradeIdx >= 0 ? cols[tradeIdx]?.replace(/[^0-9.]/g, "") : undefined;
    const tradePrice = tradeStr ? parseFloat(tradeStr) : undefined;

    const rrpStr = rrpIdx >= 0 ? cols[rrpIdx]?.replace(/[^0-9.]/g, "") : undefined;
    const rrpPrice = rrpStr ? parseFloat(rrpStr) : undefined;

    // Skip rows with no valid price at all
    if ((tradePrice === undefined || isNaN(tradePrice)) && (rrpPrice === undefined || isNaN(rrpPrice))) continue;

    const currency = currIdx >= 0 && cols[currIdx] ? cols[currIdx].toUpperCase().trim() : "SGD";

    rows.push({
      product_name: name,
      trade_price: tradePrice && !isNaN(tradePrice) ? tradePrice : undefined,
      rrp_price: rrpPrice && !isNaN(rrpPrice) ? rrpPrice : undefined,
      currency,
    });
  }
  return rows;
}

function downloadTemplate() {
  const csv = `product_name,trade_price,rrp_price,currency\nCorteza Console,12500,18900,USD\nAngelo M side table,1800,2492,EUR\n`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "price_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function exportCurrentProducts() {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase
    .from("trade_products")
    .select("product_name, trade_price_cents, rrp_price_cents, currency")
    .eq("is_active", true)
    .order("product_name");

  if (!data || data.length === 0) return;

  const header = "product_name,trade_price,rrp_price,currency";
  const csvRows = data.map(p => {
    const trade = p.trade_price_cents ? (p.trade_price_cents / 100).toFixed(0) : "";
    const rrp = p.rrp_price_cents ? (p.rrp_price_cents / 100).toFixed(0) : "";
    // Quote product names that contain commas
    const name = p.product_name.includes(",") ? `"${p.product_name}"` : p.product_name;
    return `${name},${trade},${rrp},${p.currency}`;
  });

  const blob = new Blob([header + "\n" + csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "current_products.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CsvPriceImport({ onComplete }: { onComplete?: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const hasTradeCol = rows.some(r => r.trade_price !== undefined);
  const hasRrpCol = rows.some(r => r.rrp_price !== undefined);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(reader.result as string);
      if (parsed.length === 0) {
        toast({ title: "Invalid CSV", description: "Need product_name and at least one price column (trade_price or rrp_price).", variant: "destructive" });
        return;
      }
      setRows(parsed);
      setResult(null);
      setOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    setImporting(true);
    let matched = 0;
    let created = 0;
    const skipped: string[] = [];

    for (const row of rows) {
      const tradeCents = row.trade_price ? Math.round(row.trade_price * 100) : null;
      const rrpCents = row.rrp_price ? Math.round(row.rrp_price * 100) : null;

      const { data: existing } = await supabase
        .from("trade_products")
        .select("id")
        .ilike("product_name", row.product_name)
        .limit(1);

      if (existing && existing.length > 0) {
        const updateData: Record<string, unknown> = { currency: row.currency };
        if (tradeCents !== null) updateData.trade_price_cents = tradeCents;
        if (rrpCents !== null) updateData.rrp_price_cents = rrpCents;

        const { error } = await supabase
          .from("trade_products")
          .update(updateData)
          .eq("id", existing[0].id);
        if (error) skipped.push(`${row.product_name} (update failed)`);
        else matched++;
      } else {
        const { error } = await supabase.from("trade_products").insert({
          product_name: row.product_name,
          brand_name: "Unknown",
          trade_price_cents: tradeCents,
          rrp_price_cents: rrpCents,
          currency: row.currency,
        });
        if (error) skipped.push(`${row.product_name} (insert failed)`);
        else created++;
      }
    }

    setResult({ matched, created, skipped });
    setImporting(false);
    toast({ title: "Import complete", description: `${matched} updated, ${created} created, ${skipped.length} skipped` });
    onComplete?.();
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Import Prices (CSV)
        </Button>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={downloadTemplate}>
          <Download className="h-3 w-3" />
          Template
        </Button>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Prices</DialogTitle>
            <DialogDescription>
              {rows.length} product{rows.length !== 1 ? "s" : ""} found.
              {hasTradeCol && hasRrpCol && " Both trade & RRP prices detected."}
              {hasTradeCol && !hasRrpCol && " Trade prices detected (no RRP column)."}
              {!hasTradeCol && hasRrpCol && " RRP prices detected (no trade price column)."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-64 overflow-y-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-body">Product</th>
                  {hasTradeCol && <th className="text-right p-2 font-body">Trade</th>}
                  {hasRrpCol && <th className="text-right p-2 font-body">RRP</th>}
                  <th className="text-right p-2 font-body">Curr</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2 font-body truncate max-w-[200px]">{r.product_name}</td>
                    {hasTradeCol && (
                      <td className="p-2 font-body text-right">{r.trade_price?.toLocaleString() ?? "—"}</td>
                    )}
                    {hasRrpCol && (
                      <td className="p-2 font-body text-right text-muted-foreground">{r.rrp_price?.toLocaleString() ?? "—"}</td>
                    )}
                    <td className="p-2 font-body text-right">{r.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/30 text-xs font-body">
              <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p><strong>{result.matched}</strong> updated, <strong>{result.created}</strong> created</p>
                {result.skipped.length > 0 && (
                  <p className="text-muted-foreground mt-1">Skipped: {result.skipped.join(", ")}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={importing || !!result}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
              {importing ? "Importing…" : result ? "Done" : `Import ${rows.length} prices`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
