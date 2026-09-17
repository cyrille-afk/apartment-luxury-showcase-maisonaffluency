import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileUp, Plus, RefreshCw, Truck, UploadCloud } from "lucide-react";

interface SupplierRow {
  id: string;
  supplier_name: string;
  contact_email: string;
  cc_email: string | null;
  brand_aliases: string[];
  active: boolean;
  notes: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface ParsedRow {
  rowNumber: number;
  supplier_name: string;
  contact_email: string;
  cc_email: string;
}

interface RowError {
  rowNumber: number;
  message: string;
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields with commas/quotes/newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  supplier_name: ["supplier name", "supplier", "name", "supplier_name"],
  contact_email: ["contact email", "email", "contact_email", "contact e-mail"],
  cc_email: ["cc email", "cc", "cc_email", "cc e-mail"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\uFEFF]/g, " ");
}

function resolveColumns(headerRow: string[]): Record<"supplier_name" | "contact_email" | "cc_email", number> {
  const idx = { supplier_name: -1, contact_email: -1, cc_email: -1 };
  headerRow.forEach((h, i) => {
    const n = normalizeHeader(h).trim();
    (Object.keys(HEADER_ALIASES) as (keyof typeof idx)[]).forEach((key) => {
      if (idx[key] !== -1) return;
      if (HEADER_ALIASES[key].some((alias) => normalizeHeader(alias) === n)) idx[key] = i;
    });
  });
  return idx;
}

function parseSupplierCsv(text: string): { rows: ParsedRow[]; errors: RowError[] } {
  const errors: RowError[] = [];
  const grid = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (grid.length === 0) {
    return { rows: [], errors: [{ rowNumber: 1, message: "The file is empty." }] };
  }
  const cols = resolveColumns(grid[0]);
  const missing: string[] = [];
  if (cols.supplier_name === -1) missing.push("Supplier Name");
  if (cols.contact_email === -1) missing.push("Contact Email");
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, message: `Missing mandatory column(s): ${missing.join(", ")}. Expected headers: Supplier Name, Contact Email, CC Email.` }],
    };
  }
  const rows: ParsedRow[] = [];
  const seenNames = new Map<string, number>();
  for (let r = 1; r < grid.length; r++) {
    const rowNumber = r + 1; // 1-based including header
    const raw = grid[r];
    const name = (raw[cols.supplier_name] ?? "").trim();
    const email = (raw[cols.contact_email] ?? "").trim();
    const cc = cols.cc_email === -1 ? "" : (raw[cols.cc_email] ?? "").trim();
    if (!name) {
      errors.push({ rowNumber, message: `Row ${rowNumber}: Missing supplier name` });
      continue;
    }
    if (!email) {
      errors.push({ rowNumber, message: `Row ${rowNumber}: Missing contact email` });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ rowNumber, message: `Row ${rowNumber}: Invalid email format ("${email}")` });
      continue;
    }
    if (cc && !EMAIL_RE.test(cc)) {
      errors.push({ rowNumber, message: `Row ${rowNumber}: Invalid CC email format ("${cc}")` });
      continue;
    }
    const key = name.toLowerCase();
    if (seenNames.has(key)) {
      errors.push({ rowNumber, message: `Row ${rowNumber}: Duplicate of row ${seenNames.get(key)} ("${name}") — skipped` });
      continue;
    }
    seenNames.set(key, rowNumber);
    rows.push({ rowNumber, supplier_name: name, contact_email: email, cc_email: cc });
  }
  return { rows, errors };
}

function downloadSampleCsv() {
  const lines = [
    "Supplier Name,Contact Email,CC Email",
    "Atelier Vime,orders@ateliervime.fr,production@ateliervime.fr",
    "Pouenat Ferronnier,contact@pouenat.fr,",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "supplier-import-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function TradeAdminSuppliers() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addCc, setAddCc] = useState("");
  const [saving, setSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "review">("upload");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, supplier_name, contact_email, cc_email, brand_aliases, active, notes")
      .order("supplier_name", { ascending: true });
    if (error) toast.error(`Could not load suppliers: ${error.message}`);
    setSuppliers((data as SupplierRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) void load();
  }, [authLoading, isAdmin, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.supplier_name, s.contact_email, s.cc_email ?? ""].some((f) => f.toLowerCase().includes(q)),
    );
  }, [suppliers, search]);

  const handleAdd = async () => {
    const name = addName.trim();
    const email = addEmail.trim();
    const cc = addCc.trim();
    if (!name) return toast.error("Supplier name is required");
    if (!EMAIL_RE.test(email)) return toast.error("Invalid contact email format");
    if (cc && !EMAIL_RE.test(cc)) return toast.error("Invalid CC email format");
    setSaving(true);
    const { error } = await supabase.from("suppliers").insert({
      supplier_name: name,
      contact_email: email,
      cc_email: cc || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? `A supplier named "${name}" already exists` : error.message);
      return;
    }
    toast.success(`Supplier "${name}" added`);
    setAddOpen(false);
    setAddName("");
    setAddEmail("");
    setAddCc("");
    void load();
  };

  const resetImport = () => {
    setImportFile(null);
    setParsedRows([]);
    setRowErrors([]);
    setExcludedRows(new Set());
    setImportStep("upload");
    setDragOver(false);
  };

  /** Duplicate status per parsed row, compared against the live directory. */
  const duplicateStatus = useMemo(() => {
    const byName = new Set(suppliers.map((s) => s.supplier_name.trim().toLowerCase()));
    const byEmail = new Set(suppliers.map((s) => s.contact_email.trim().toLowerCase()));
    const map = new Map<number, "upsert" | "skip">();
    parsedRows.forEach((r) => {
      if (byName.has(r.supplier_name.toLowerCase())) map.set(r.rowNumber, "upsert");
      else if (byEmail.has(r.contact_email.toLowerCase())) map.set(r.rowNumber, "skip");
    });
    return map;
  }, [suppliers, parsedRows]);

  const selectedRows = useMemo(
    () => parsedRows.filter((r) => !excludedRows.has(r.rowNumber)),
    [parsedRows, excludedRows],
  );

  const toggleRow = (rowNumber: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Only .csv files are accepted");
      return;
    }
    setImportFile(file);
    const text = await file.text();
    const { rows, errors } = parseSupplierCsv(text);
    setParsedRows(rows);
    setRowErrors(errors);
    // Pre-exclude rows matching an existing contact email under a different supplier name.
    const byName = new Set(suppliers.map((s) => s.supplier_name.trim().toLowerCase()));
    const byEmail = new Set(suppliers.map((s) => s.contact_email.trim().toLowerCase()));
    setExcludedRows(
      new Set(
        rows
          .filter((r) => !byName.has(r.supplier_name.toLowerCase()) && byEmail.has(r.contact_email.toLowerCase()))
          .map((r) => r.rowNumber),
      ),
    );
    if (rows.length > 0) setImportStep("review");
  };

  const handleImport = async () => {
    if (selectedRows.length === 0) return;
    setImporting(true);
    const payload = selectedRows.map((r) => ({
      supplier_name: r.supplier_name,
      contact_email: r.contact_email,
      cc_email: r.cc_email || null,
    }));
    const { data, error } = await supabase
      .from("suppliers")
      .upsert(payload, { onConflict: "supplier_name" })
      .select("id");
    setImporting(false);
    if (error) {
      toast.error(`Import failed: ${error.message}`);
      return;
    }
    toast.success(`Successfully imported ${data?.length ?? payload.length} supplier${(data?.length ?? payload.length) === 1 ? "" : "s"}!`);
    setImportOpen(false);
    resetImport();
    void load();
  };

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet>
        <title>Supplier Management — Trade Portal — Maison Affluency</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-foreground">Supplier Management</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Directory of suppliers used for purchase-order dispatch and procurement emails.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { resetImport(); setImportOpen(true); }}>
              <FileUp className="h-4 w-4 mr-2" />
              Import from CSV
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Supplier
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="max-w-xs"
          />
          <Button variant="ghost" size="sm" onClick={() => void load()} aria-label="Refresh suppliers">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <span className="font-body text-xs text-muted-foreground">{filtered.length} of {suppliers.length}</span>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">Supplier</th>
                <th className="px-4 py-3 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">Contact Email</th>
                <th className="px-4 py-3 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">CC Email</th>
                <th className="px-4 py-3 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center font-body text-sm text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <Truck className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                    <p className="font-body text-sm text-muted-foreground">
                      {suppliers.length === 0 ? "No suppliers yet — add one or import a CSV." : "No suppliers match your search."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-display text-sm text-foreground">{s.supplier_name}</td>
                    <td className="px-4 py-3 font-body text-sm text-foreground">{s.contact_email}</td>
                    <td className="px-4 py-3 font-body text-sm text-muted-foreground">{s.cc_email || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-[11px] ${s.active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {s.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Supplier */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add New Supplier</DialogTitle>
            <DialogDescription className="font-body text-sm">Used for PO dispatch and procurement emails.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <label className="font-body text-xs text-muted-foreground">Supplier Name *</label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Atelier Vime" className="mt-1" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">Contact Email *</label>
              <Input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="orders@supplier.com" className="mt-1" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">CC Email (optional)</label>
              <Input value={addCc} onChange={(e) => setAddCc(e.target.value)} placeholder="production@supplier.com" className="mt-1" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => void handleAdd()} disabled={saving}>{saving ? "Saving…" : "Save Supplier"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Import */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) resetImport(); }}>
        <DialogContent className={importStep === "review" ? "sm:max-w-3xl" : "sm:max-w-lg"}>
          <DialogHeader>
            <DialogTitle className="font-display">
              {importStep === "review" ? "Review & Confirm" : "Import Suppliers from CSV"}
            </DialogTitle>
            <DialogDescription className="font-body text-sm">
              {importStep === "review"
                ? "Check the parsed records below. Duplicates are flagged; uncheck any row to exclude it from the import."
                : "Required columns: Supplier Name, Contact Email. CC Email is optional. Existing supplier names are updated; new names are inserted."}
            </DialogDescription>
          </DialogHeader>

          {importStep === "review" ? (
            <div className="space-y-3">
              <div className="max-h-[50vh] overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                    <tr className="border-b border-border">
                      <th className="w-10 px-3 py-2"></th>
                      <th className="px-3 py-2 text-left font-display text-[11px] uppercase tracking-widest text-muted-foreground">Supplier Name</th>
                      <th className="px-3 py-2 text-left font-display text-[11px] uppercase tracking-widest text-muted-foreground">Contact Email</th>
                      <th className="px-3 py-2 text-left font-display text-[11px] uppercase tracking-widest text-muted-foreground">CC Email</th>
                      <th className="px-3 py-2 text-left font-display text-[11px] uppercase tracking-widest text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r) => {
                      const dup = duplicateStatus.get(r.rowNumber);
                      const excluded = excludedRows.has(r.rowNumber);
                      return (
                        <tr
                          key={r.rowNumber}
                          className={`border-b border-border/60 last:border-0 transition-colors ${
                            dup ? "bg-amber-50/70 dark:bg-amber-500/10" : ""
                          } ${excluded ? "opacity-45" : ""}`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-foreground cursor-pointer"
                              checked={!excluded}
                              onChange={() => toggleRow(r.rowNumber)}
                              aria-label={`Include ${r.supplier_name}`}
                            />
                          </td>
                          <td className="px-3 py-2 font-display text-sm text-foreground">{r.supplier_name}</td>
                          <td className="px-3 py-2 font-body text-sm text-foreground">{r.contact_email}</td>
                          <td className="px-3 py-2 font-body text-sm text-muted-foreground">{r.cc_email || "—"}</td>
                          <td className="px-3 py-2">
                            {dup === "upsert" ? (
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100/60 px-2 py-0.5 font-body text-[11px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                                Duplicate (Will Upsert)
                              </span>
                            ) : dup === "skip" ? (
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100/60 px-2 py-0.5 font-body text-[11px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                                Duplicate (Skip)
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 font-body text-[11px] text-emerald-700 dark:text-emerald-400">
                                New
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="font-body text-xs text-muted-foreground">
                {selectedRows.length} of {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"} selected
                {rowErrors.length > 0 && (
                  <span className="text-destructive"> — {rowErrors.length} row{rowErrors.length === 1 ? "" : "s"} rejected during parsing</span>
                )}
              </p>

              {rowErrors.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  {rowErrors.map((err, i) => (
                    <p key={i} className="font-body text-xs text-destructive">{err.message}</p>
                  ))}
                </div>
              )}

              <div className="flex justify-between gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => { resetImport(); }}>Choose another file</Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setImportOpen(false); resetImport(); }}>Cancel</Button>
                  <Button size="sm" onClick={() => void handleImport()} disabled={importing || selectedRows.length === 0}>
                    {importing ? "Importing…" : `Confirm Import (${selectedRows.length} Row${selectedRows.length === 1 ? "" : "s"})`}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
          <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver ? "border-foreground/60 bg-muted/50" : "border-border hover:border-foreground/30"
            }`}
          >
            <UploadCloud className="h-8 w-8 text-muted-foreground mb-3" />
            {importFile ? (
              <p className="font-body text-sm text-foreground">{importFile.name}</p>
            ) : (
              <>
                <p className="font-body text-sm text-foreground">Drag &amp; drop a .csv file here</p>
                <p className="font-body text-xs text-muted-foreground mt-1">or click to browse</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          <button
            type="button"
            onClick={downloadSampleCsv}
            className="mt-2 inline-flex items-center gap-1 font-body text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            Download Sample Template CSV
          </button>

          {importFile && rowErrors.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              {rowErrors.map((err, i) => (
                <p key={i} className="font-body text-xs text-destructive">{err.message}</p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { setImportOpen(false); resetImport(); }}>Cancel</Button>
            <Button size="sm" onClick={() => setImportStep("review")} disabled={parsedRows.length === 0}>
              Review {parsedRows.length > 0 ? parsedRows.length : ""} Row{parsedRows.length === 1 ? "" : "s"}
            </Button>
          </div>
          </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
