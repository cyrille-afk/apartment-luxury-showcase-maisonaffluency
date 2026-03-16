import { useState, useRef } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface ImportRow {
  product_name: string;
  trade_price: number;
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
  // Remove BOM and split lines, filtering out completely empty/whitespace-only rows
  const allLines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const lines = allLines.filter(l => l.replace(/,/g, "").trim().length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const nameIdx = header.findIndex(h => h.includes("product") || h.includes("name") || h.includes("item"));
  // Match "trade_price" or "trade price" first, then fall back to any column with "price"
  const tradeIdx = header.findIndex(h => h.includes("trade"));
  const priceIdx = tradeIdx >= 0 ? tradeIdx : header.findIndex(h => h.includes("price"));
  const rrpIdx = header.findIndex(h => h.includes("rrp") || h.includes("retail"));
  const currIdx = header.findIndex(h => h.includes("currency") || h.includes("curr"));

  // Use trade price column if found, otherwise use any price column (e.g. rrp_price)
  const effectivePriceIdx = priceIdx >= 0 ? priceIdx : -1;
  if (nameIdx === -1 || effectivePriceIdx === -1) return [];

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Parse CSV respecting quoted fields (e.g. "18,900")
    const cols = parseCsvLine(lines[i]);
    const name = cols[nameIdx]?.trim();
    const priceStr = cols[effectivePriceIdx]?.replace(/[^0-9.]/g, "");
    const price = parseFloat(priceStr);
    if (!name || isNaN(price)) continue;

    // If we used a generic "price" column that's actually rrp, store it as rrp too
    const isRrpColumn = rrpIdx >= 0 || (tradeIdx < 0 && header[effectivePriceIdx]?.includes("rrp"));
    const rrpStr = rrpIdx >= 0 ? cols[rrpIdx]?.replace(/[^0-9.]/g, "") : (isRrpColumn ? priceStr : undefined);
    const rrp = rrpStr ? parseFloat(rrpStr) : undefined;
    const currency = currIdx >= 0 && cols[currIdx] ? cols[currIdx].toUpperCase().trim() : "SGD";

    rows.push({ product_name: name, trade_price: price, rrp_price: rrp && !isNaN(rrp) ? rrp : undefined, currency });

    rows.push({ product_name: name, trade_price: trade, rrp_price: rrp && !isNaN(rrp) ? rrp : undefined, currency });
  }
  return rows;
}

export default function CsvPriceImport({ onComplete }: { onComplete?: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(reader.result as string);
      if (parsed.length === 0) {
        toast({ title: "Invalid CSV", description: "Could not find product_name and price columns.", variant: "destructive" });
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
      const priceCents = Math.round(row.trade_price * 100);
      const rrpCents = row.rrp_price ? Math.round(row.rrp_price * 100) : null;

      // Try to find existing product
      const { data: existing } = await supabase
        .from("trade_products")
        .select("id")
        .ilike("product_name", row.product_name)
        .limit(1);

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from("trade_products")
          .update({
            trade_price_cents: priceCents,
            ...(rrpCents !== null ? { rrp_price_cents: rrpCents } : {}),
            currency: row.currency,
          })
          .eq("id", existing[0].id);
        if (error) skipped.push(`${row.product_name} (update failed)`);
        else matched++;
      } else {
        // Create new product
        const { error } = await supabase.from("trade_products").insert({
          product_name: row.product_name,
          brand_name: "Unknown",
          trade_price_cents: priceCents,
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
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Import Prices (CSV)
      </Button>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Prices</DialogTitle>
            <DialogDescription>
              {rows.length} product{rows.length !== 1 ? "s" : ""} found in CSV. Review before importing.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-64 overflow-y-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-body">Product</th>
                  <th className="text-right p-2 font-body">Trade Price</th>
                  <th className="text-right p-2 font-body">RRP</th>
                  <th className="text-right p-2 font-body">Curr</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2 font-body truncate max-w-[200px]">{r.product_name}</td>
                    <td className="p-2 font-body text-right">{r.trade_price.toLocaleString()}</td>
                    <td className="p-2 font-body text-right text-muted-foreground">{r.rrp_price?.toLocaleString() || "—"}</td>
                    <td className="p-2 font-body text-right">{r.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/30 text-xs font-body">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
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
