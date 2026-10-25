import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Tags } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FACET_VOCAB_OPTIONS, finishFacetKey, type ComparatorFacetKind, type FinishFacetOverride } from "@/lib/comparatorFacets";

const KINDS: [ComparatorFacetKind, string][] = [["material", "Material"], ["finish", "Finish"], ["color", "Colour"]];

/** Admin-only: assign explicit material / finish / colour categories to finish names. */
export function FinishCategoryDialog({ names, overrides }: { names: string[]; overrides: Map<string, FinishFacetOverride> }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, FinishFacetOverride>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) return; setDraft(Object.fromEntries(names.map(n => [n, { ...overrides.get(finishFacetKey(n)) }]))); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    setSaving(true);
    const rows = names.map(n => ({ finish_key: finishFacetKey(n), finish_name: n, material: draft[n]?.material?.trim() || null, finish: draft[n]?.finish?.trim() || null, color: draft[n]?.color?.trim() || null }));
    const keep = rows.filter(r => r.material || r.finish || r.color);
    const clear = rows.filter(r => !(r.material || r.finish || r.color) && overrides.has(r.finish_key)).map(r => r.finish_key);
    const { data: { user } } = await supabase.auth.getUser();
    const [a, b] = await Promise.all([
      keep.length ? supabase.from("finish_facet_overrides").upsert(keep.map(r => ({ ...r, updated_by: user?.id, updated_at: new Date().toISOString() }))) : Promise.resolve({ error: null }),
      clear.length ? supabase.from("finish_facet_overrides").delete().in("finish_key", clear) : Promise.resolve({ error: null }),
    ]);
    setSaving(false);
    if (a.error || b.error) { toast.error("Categories couldn't be saved. Please try again."); return; }
    await qc.invalidateQueries({ queryKey: ["finish-facet-overrides"] });
    toast.success("Finish categories saved");
    setOpen(false);
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="gap-2"><Tags className="h-3.5 w-3.5" />Categorise finishes</Button></DialogTrigger>
    <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display font-normal">Categorise finishes</DialogTitle>
        <DialogDescription>Set the material, finish and colour for each name. A category you set replaces the automatic guess for that list; leave blank to keep the guess. Applies to every piece using that name.</DialogDescription>
      </DialogHeader>
      {KINDS.map(([k]) => <datalist key={k} id={`facet-options-${k}`}>{FACET_VOCAB_OPTIONS[k].map(v => <option key={v} value={v} />)}</datalist>)}
      <div className="space-y-3">
        {names.map(n => <div key={n} className="grid grid-cols-1 gap-2 border-b border-border/60 pb-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:items-center">
          <span className="font-body text-sm text-foreground">{n}</span>
          {KINDS.map(([k, label]) => <Input key={k} aria-label={`${label} for ${n}`} placeholder={label} list={`facet-options-${k}`} value={draft[n]?.[k] ?? ""} onChange={e => setDraft(d => ({ ...d, [n]: { ...d[n], [k]: e.target.value } }))} className="h-9 text-sm" />)}
        </div>)}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save categories"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
