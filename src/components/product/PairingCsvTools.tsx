import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { PairingRule } from "@/lib/curatedPairings";
import { exportPairingCsv, parsePairingCsv, pairingCsvSnapshot, type PairingCsvPreview } from "@/lib/curatedPairingCsv";

export default function PairingCsvTools({ rules, products, disabled, onSaved }: {
  rules: PairingRule[]; products: { id: string; title: string; brand: string; category: string | null }[];
  disabled: boolean; onSaved: () => Promise<unknown>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PairingCsvPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const names = new Map(products.map((p) => [p.id, `${p.brand} — ${p.title}`]));
  function download() {
    const url = URL.createObjectURL(new Blob([exportPairingCsv(rules, names)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "maison-affluency-pairing-finishes.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function readFile(file: File) {
    try {
      setPreview(file.size > 2_000_000 ? { updates: [], errors: ["Use a CSV file smaller than 2 MB."] } : parsePairingCsv(await file.text(), rules, products));
    } catch { setPreview({ updates: [], errors: ["This CSV file could not be read."] }); }
  }
  async function save() {
    if (!preview?.updates.length || preview.errors.length || saving) return;
    setSaving(true);
    try {
      const { data: current, error } = await supabase.from("curated_pairing_rules").select("*").in("id", preview.updates.map((u) => u.rule.id));
      if (error) throw error;
      const values = preview.updates.map((update) => {
        const row = current?.find((r) => r.id === update.rule.id);
        if (!row || pairingCsvSnapshot(row) !== pairingCsvSnapshot(update.rule)) throw new Error("A pairing changed after this file was reviewed. Export and review the current catalog again.");
        return { ...row, finish_options: update.options.map((o) => ({ ...o })), finish_currency: update.currency };
      });
      const result = await supabase.from("curated_pairing_rules").upsert(values, { onConflict: "id" }).select("id");
      if (result.error) throw result.error;
      if (result.data?.length !== values.length) throw new Error("The saved pairings could not be confirmed. Reload the catalog before retrying.");
      await onSaved();
      setPreview(null); toast({ title: `${values.length} pairing${values.length === 1 ? "" : "s"} updated` });
    } catch (error) { toast({ title: "Import could not be saved", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
    finally { setSaving(false); }
  }
  return <>
    <input ref={fileInput} type="file" accept=".csv,text/csv" aria-label="Import pairing finishes CSV" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void readFile(file); }} />
    <Button variant="outline" disabled={disabled || saving} onClick={download}><Download className="h-4 w-4" />Export CSV</Button>
    <Button variant="outline" disabled={disabled || saving} onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" />Import CSV</Button>
    <Dialog open={preview !== null} onOpenChange={(open) => { if (!open && !saving) setPreview(null); }}><DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Review finish & price import</DialogTitle><DialogDescription>Each included pairing’s finishes and retail prices will be replaced. Other pairings, categories, priorities and status stay unchanged. Blank retail prices mean Price upon Request; a row with all finish fields blank restores catalogue defaults.</DialogDescription></DialogHeader>
      {!!preview?.errors.length && <ul role="alert" className="space-y-2 text-sm text-destructive">{preview.errors.slice(0, 30).map((error, i) => <li key={i}>{error}</li>)}{preview.errors.length > 30 && <li>{preview.errors.length - 30} more errors. Correct the file before importing.</li>}</ul>}
      {!!preview?.updates.length && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="py-3">Pairing / piece</th><th>Finish</th><th className="text-right">Retail price</th></tr></thead><tbody>{preview.updates.flatMap((u) => (u.options.length ? u.options : [null]).map((o, index) => <tr key={`${u.rule.id}-${index}`} className="border-b border-border"><td className="py-3 pr-3">{u.rule.source_category} → {u.rule.target_category}<div className="text-xs text-muted-foreground">{names.get(u.rule.preferred_pick_id || "") || "Automatic selection"}</div></td><td className="pr-3">{o?.name || "Catalogue defaults"}</td><td className="whitespace-nowrap text-right">{o ? o.price_cents === null ? "Price upon Request" : `${u.currency} ${(o.price_cents / 100).toFixed(2)}` : "—"}</td></tr>))}</tbody></table></div>}
      <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setPreview(null)}>Cancel</Button><Button disabled={saving || !preview?.updates.length || !!preview?.errors.length} onClick={save}>{saving ? "Saving…" : `Confirm ${preview?.updates.length || 0} pairing updates`}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}