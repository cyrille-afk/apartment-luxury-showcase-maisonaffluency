import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import AdminOnly from "@/components/trade/AdminOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useCuratedPairingRules } from "@/hooks/useCuratedPairingRules";
import { useDbCuratorPicks } from "@/hooks/useDbCuratorPicks";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PAIRING_CATEGORIES, pairingCategory, type PairingCategory, type PairingRule } from "@/lib/curatedPairings";
import { parsePairingFinishOptions, pairingFinishError } from "@/lib/pairingFinishPricing";
import PairingFinishEditor from "@/components/product/PairingFinishEditor";

const label = (category: string) => PAIRING_CATEGORIES[category as PairingCategory] || category;
function Catalog() {
  const { data: rules = [], isLoading, error, refetch } = useCuratedPairingRules(true, true);
  const { data: catalog = [], isLoading: productsLoading, error: productsError } = useDbCuratorPicks();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [source, setSource] = useState("ceiling");
  const [draft, setDraft] = useState<PairingRule | null>(null);
  const [remove, setRemove] = useState<PairingRule | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const products = useMemo(() => catalog.flatMap(({ pick, designerName }) => pick.id ? [{ id: pick.id, title: pick.title, brand: designerName, image: pick.image, category: pairingCategory(pick) }] : []), [catalog]);
  const visible = rules.filter((r) => r.source_category === source);
  const selected = products.find((p) => p.id === draft?.preferred_pick_id);
  const candidates = products.filter((p) => p.category === draft?.target_category && (`${p.brand} ${p.title}`.toLowerCase().includes(search.toLowerCase()) || p.id === draft?.preferred_pick_id));
  async function save() {
    if (!draft || busy) return;
    const finishOptions = parsePairingFinishOptions(draft.finish_options);
    const finishError = pairingFinishError((draft.finish_options || []) as typeof finishOptions, draft.preferred_pick_id);
    if (finishError) { toast({ title: finishError, variant: "destructive" }); return; }
    if (draft.source_category === draft.target_category || !Number.isInteger(draft.sort_order) || draft.sort_order < 0 || draft.sort_order > 999) {
      toast({ title: "Choose a different category and a priority from 0 to 999", variant: "destructive" }); return;
    }
    if (draft.preferred_pick_id && (!selected || selected.category !== draft.target_category)) {
      toast({ title: "Choose a published piece from the selected category", variant: "destructive" }); return;
    }
    setBusy(true);
    const { id, ...rest } = draft;
    const values = { ...rest, finish_options: finishOptions.map((o) => ({ ...o, name: o.name.trim() })), finish_currency: draft.finish_currency || "USD" };
    const result = id ? await supabase.from("curated_pairing_rules").update(values).eq("id", id).select().single() : await supabase.from("curated_pairing_rules").insert(values).select().single();
    setBusy(false);
    if (result.error) { toast({ title: "Pairing could not be saved", description: result.error.message, variant: "destructive" }); return; }
    await qc.invalidateQueries({ queryKey: ["curated-pairing-rules"] });
    setDraft(null); toast({ title: "Pairing saved" });
  }
  async function deleteRule() {
    if (!remove || busy) return;
    setBusy(true);
    const { error: deleteError } = await supabase.from("curated_pairing_rules").delete().eq("id", remove.id).select().single();
    setBusy(false);
    if (deleteError) { toast({ title: "Pairing could not be removed", description: deleteError.message, variant: "destructive" }); return; }
    await qc.invalidateQueries({ queryKey: ["curated-pairing-rules"] });
    setRemove(null); toast({ title: "Pairing removed" });
  }
  return <>
    <Helmet><title>Curated Pairings — Maison Affluency</title><meta name="robots" content="noindex, nofollow" /></Helmet>
    <div className="max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="font-display text-3xl text-foreground">Curated Pairings</h1><Button onClick={() => { setSearch(""); setDraft({ id: "", source_category: source, target_category: source === "decor" ? "tables" : "decor", preferred_pick_id: null, sort_order: visible.length, enabled: true }); }}><Plus className="h-4 w-4" />Add pairing</Button></header>
      <div className="max-w-xs space-y-2"><Label>Primary selection</Label><Select value={source} onValueChange={setSource}><SelectTrigger aria-label="Primary selection"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PAIRING_CATEGORIES).map(([value, name]) => <SelectItem key={value} value={value}>{name}</SelectItem>)}</SelectContent></Select></div>
      {error ? <div role="alert" className="text-destructive">Pairings could not be loaded. <Button variant="link" onClick={() => refetch()}>Retry</Button></div> : isLoading ? <p className="text-muted-foreground">Loading pairings…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left font-body text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-3">Priority</th><th>Complementary category</th><th>Preferred piece</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((row) => {
        const piece = products.find((p) => p.id === row.preferred_pick_id);
        return <tr key={row.id} className="border-b border-border/60"><td className="py-5">{row.sort_order}</td><td>{label(row.target_category)}</td><td><div className="flex items-center gap-3">{piece?.image && <img src={piece.image} alt={piece.title} className="h-14 w-14 object-contain" />}<div>{row.preferred_pick_id ? piece?.title || "Unavailable piece" : "Automatic selection"}{piece && <div className="text-xs text-muted-foreground">{piece.brand}</div>}</div></div></td><td>{row.enabled ? "Active" : "Paused"}</td><td><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" aria-label={`Edit ${label(row.target_category)} pairing`} title="Edit pairing" onClick={() => { setSearch(""); setDraft({ ...row }); }}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Delete ${label(row.target_category)} pairing`} title="Delete pairing" onClick={() => setRemove(row)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>;
      })}</tbody></table>{!visible.length && <p className="py-8 text-muted-foreground">No pairings for {label(source).toLowerCase()}.</p>}</div>}
    </div>
    <Dialog open={!!draft} onOpenChange={(open) => { if (!open && !busy) setDraft(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{draft?.id ? "Edit pairing" : "New pairing"}</DialogTitle></DialogHeader>{draft && <div className="space-y-4">
      <div className="space-y-2"><Label>Primary category</Label><Select value={draft.source_category} onValueChange={(value) => setDraft({ ...draft, source_category: value, ...(value === draft.target_category ? { target_category: value === "decor" ? "tables" : "decor", preferred_pick_id: null, finish_options: [] } : {}) })}><SelectTrigger aria-label="Primary category"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PAIRING_CATEGORIES).map(([value, name]) => <SelectItem key={value} value={value}>{name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Complementary category</Label><Select value={draft.target_category} onValueChange={(value) => { setSearch(""); setDraft({ ...draft, target_category: value, preferred_pick_id: null, finish_options: [] }); }}><SelectTrigger aria-label="Complementary category"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PAIRING_CATEGORIES).filter(([value]) => value !== draft.source_category).map(([value, name]) => <SelectItem key={value} value={value}>{name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="piece-search">Find a preferred piece</Label><Input id="piece-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or designer" /><Select value={draft.preferred_pick_id || "automatic"} onValueChange={(value) => setDraft({ ...draft, preferred_pick_id: value === "automatic" ? null : value, finish_options: [] })}><SelectTrigger aria-label="Preferred piece"><SelectValue placeholder="Automatic selection" /></SelectTrigger><SelectContent><SelectItem value="automatic">Automatic selection</SelectItem>{draft.preferred_pick_id && !selected && <SelectItem value={draft.preferred_pick_id}>Unavailable piece</SelectItem>}{candidates.map((p) => <SelectItem key={p.id} value={p.id}>{p.brand} — {p.title}</SelectItem>)}</SelectContent></Select>{productsLoading && <p className="text-sm text-muted-foreground">Loading pieces…</p>}{productsError && <p role="alert" className="text-sm text-destructive">Published pieces could not be loaded.</p>}</div>
      {selected?.image && <div className="flex items-center gap-4"><img src={selected.image} alt={selected.title} className="h-24 w-24 object-contain" /><span className="font-display">{selected.title}</span></div>}
      <PairingFinishEditor options={(draft.finish_options || []) as ReturnType<typeof parsePairingFinishOptions>} currency={draft.finish_currency || "USD"} disabled={!selected} onChange={(finish_options) => setDraft({ ...draft, finish_options })} onCurrencyChange={(finish_currency) => setDraft({ ...draft, finish_currency })} />
      <div className="space-y-2"><Label htmlFor="pairing-priority">Priority</Label><Input id="pairing-priority" type="number" min={0} max={999} step={1} value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} /></div>
      <div className="flex items-center justify-between"><Label htmlFor="pairing-active">Active</Label><Switch id="pairing-active" checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} /></div>
    </div>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDraft(null)}>Cancel</Button><Button disabled={busy || productsLoading} onClick={save}><Save className="h-4 w-4" />{busy ? "Saving…" : "Save pairing"}</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={!!remove} onOpenChange={(open) => { if (!open && !busy) setRemove(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove pairing?</AlertDialogTitle><AlertDialogDescription>{remove && `${label(remove.source_category)} → ${label(remove.target_category)}`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); deleteRule(); }}>Remove pairing</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
export default function TradeAdminCuratedPairings() { return <AdminOnly><Catalog /></AdminOnly>; }
