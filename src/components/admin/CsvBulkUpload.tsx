import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface CsvBulkUploadProps {
  designerId: string;
  currentCount: number;
  onComplete: () => void;
}

const CSV_COLUMNS = [
  "title", "subtitle", "category", "subcategory", "materials", "dimensions",
  "description", "edition", "photo_credit", "image_url", "hover_image_url",
  "currency", "trade_price_cents", "pdf_url", "pdf_filename", "sort_order",
];

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] || "").trim(); });
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      values.push(current); current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

export default function CsvBulkUpload({ designerId, currentCount, onComplete }: CsvBulkUploadProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target?.result as string);
      setPreview(rows);
    };
    reader.readAsText(f);
  };

  const handleDownloadTemplate = () => {
    const csv = CSV_COLUMNS.join(",") + "\n" +
      'Example Lamp,by Designer Name,Lighting,Table Lamp,"Brass, Glass","H 45 x W 30 cm",A beautiful lamp,1/8,Photo Studio,https://example.com/image.jpg,,EUR,150000,,,0\n';
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "curator_picks_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (preview.length === 0) return;
    setUploading(true);
    const rows = preview.map((row, i) => ({
      designer_id: designerId,
      title: row.title || "Untitled",
      subtitle: row.subtitle || null,
      category: row.category || null,
      subcategory: row.subcategory || null,
      materials: row.materials || null,
      dimensions: row.dimensions || null,
      description: row.description || null,
      edition: row.edition || null,
      photo_credit: row.photo_credit || null,
      image_url: row.image_url || "",
      hover_image_url: row.hover_image_url || null,
      currency: row.currency || "EUR",
      trade_price_cents: row.trade_price_cents ? parseInt(row.trade_price_cents) : null,
      pdf_url: row.pdf_url || null,
      pdf_filename: row.pdf_filename || null,
      sort_order: row.sort_order ? parseInt(row.sort_order) : currentCount + i,
    }));

    const { error, data } = await supabase
      .from("designer_curator_picks")
      .insert(rows as any)
      .select();

    if (error) {
      toast({ title: "Bulk import failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${(data as any[])?.length || rows.length} products imported successfully` });
      queryClient.invalidateQueries({ queryKey: ["admin-public-picks-counts"] });
      onComplete();
    }
    setUploading(false);
    setOpen(false);
    setFile(null);
    setPreview([]);
  };

  const reset = () => { setFile(null); setPreview([]); };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Upload className="w-3.5 h-3.5" /> CSV Import
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Bulk CSV Import
        </span>
        <button onClick={() => { setOpen(false); reset(); }} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!file ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Upload a CSV with columns: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">title, category, subcategory, materials, dimensions, image_url, trade_price_cents</code>, etc.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Choose CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Download Template
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs">{file.name} — <strong>{preview.length}</strong> row{preview.length !== 1 ? "s" : ""} found</span>
            <Button variant="ghost" size="sm" onClick={reset} className="text-xs h-6 px-2">Change file</Button>
          </div>

          {preview.length > 0 && (
            <div className="max-h-48 overflow-auto rounded border border-border bg-background">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-1.5 py-1 text-left font-medium">#</th>
                    <th className="px-1.5 py-1 text-left font-medium">Title</th>
                    <th className="px-1.5 py-1 text-left font-medium">Category</th>
                    <th className="px-1.5 py-1 text-left font-medium">Materials</th>
                    <th className="px-1.5 py-1 text-left font-medium">Price</th>
                    <th className="px-1.5 py-1 text-left font-medium">Image</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-1.5 py-0.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-1.5 py-0.5 truncate max-w-[120px]">{row.title || "—"}</td>
                      <td className="px-1.5 py-0.5 truncate max-w-[80px]">{row.category || "—"}</td>
                      <td className="px-1.5 py-0.5 truncate max-w-[80px]">{row.materials || "—"}</td>
                      <td className="px-1.5 py-0.5">{row.trade_price_cents ? `${(parseInt(row.trade_price_cents) / 100).toFixed(0)}` : "—"}</td>
                      <td className="px-1.5 py-0.5">{row.image_url ? "✓" : "—"}</td>
                    </tr>
                  ))}
                  {preview.length > 20 && (
                    <tr><td colSpan={6} className="px-1.5 py-1 text-center text-muted-foreground">… and {preview.length - 20} more rows</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleUpload} disabled={uploading || preview.length === 0} className="gap-1.5">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Import {preview.length} product{preview.length !== 1 ? "s" : ""}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
