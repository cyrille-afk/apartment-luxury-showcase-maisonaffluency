import { useEffect, useState } from "react";
import { Save, RotateCw, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { packageHotspotsSchema, hotspotConfigurationError, hotspotCategoryOptions, type PackageHotspot } from "@/lib/packageHotspots";

const money = (value: number) => new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(value);
const dimensions = (item: { width_m: number | null; depth_m: number | null; height_m: number | null }) => `${item.width_m ?? "—"} × ${item.depth_m ?? "—"} × ${item.height_m ?? "—"} m · W × D × H`;
export default function PackageHotspotsDrawer({ projectId, packageId, tier, onClose }: { projectId: string; packageId: string; tier: string; onClose: () => void }) {
  const [slots, setSlots] = useState<PackageHotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setFailed(false); setFeedback("");
    void Promise.resolve(supabase.rpc("get_package_hotspot_configuration", { _project_id: projectId, _package_id: packageId }).abortSignal(controller.signal)).then(result => {
      if (controller.signal.aborted) return;
      if (result.error) throw result.error;
      setSlots(packageHotspotsSchema.parse(result.data));
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, packageId, revision]);
  const update = (id: string, values: Partial<PackageHotspot>) => { setFeedback(""); setSlots(current => current.map(slot => slot.id === id ? { ...slot, ...values } : slot)); };
  const updateMeasurement = (slot: PackageHotspot, axis: "width" | "depth" | "height", raw: string) => {
    const value = raw === "" ? null : Number(raw);
    update(slot.id, { [`${axis}_m`]: value, [`${axis}_m_override`]: value } as Partial<PackageHotspot>);
  };
  const save = async () => {
    const invalid = slots.map(hotspotConfigurationError).find(Boolean); if (invalid) { setFeedback(invalid); return; }
    setPending(true); setFeedback("");
    try {
      const result = await supabase.rpc("save_package_hotspot_configuration", { _project_id: projectId, _package_id: packageId, _rules: slots.map(slot => ({ id: slot.id, is_swappable: slot.is_swappable, allow_finish_customization: slot.allow_finish_customization, pinned_alternative_ids: slot.pinned_alternative_ids, category_role_override: slot.category_role_override, width_m_override: slot.width_m_override, depth_m_override: slot.depth_m_override, height_m_override: slot.height_m_override })) });
      if (result.error) throw result.error;
      setSlots(packageHotspotsSchema.parse(result.data)); setFeedback("Hotspot settings saved.");
    } catch { setFeedback("Settings couldn’t save. Your selections are retained; please retry."); }
    finally { setPending(false); }
  };
  return <Sheet open onOpenChange={open => { if (!open && !pending) onClose(); }}><SheetContent side="right" className="viewing-room flex w-full flex-col bg-background text-foreground sm:max-w-2xl" data-trade-sensitive>
    <div className="border-b border-border pb-5 pr-10"><SheetTitle className="font-display text-2xl">Configure Hotspots</SheetTitle><SheetDescription>{tier} · {loading ? "Loading furniture…" : `${slots.length} furniture items`}</SheetDescription></div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {loading && <p role="status" className="py-10 text-sm text-muted-foreground">Loading hotspot settings…</p>}
      {failed && <div role="alert" className="space-y-4 py-8"><p>Hotspot settings couldn’t load.</p><Button variant="outline" onClick={() => setRevision(value => value + 1)}><RotateCw className="size-4" />Retry</Button></div>}
      {!loading && !failed && !slots.length && <p className="py-8 text-muted-foreground">This assigned moodboard has no furniture items.</p>}
      {!loading && !failed && slots.map(slot => <section key={slot.id} className="space-y-4 border-b border-border py-6" aria-label={slot.name ?? "Furniture item"}>
        <div className="flex items-center gap-4"><div className="flex size-20 shrink-0 items-center justify-center bg-muted">{slot.image ? <img src={slot.image} alt={slot.name ?? "Furniture"} className="h-full w-full object-contain" /> : <ImageIcon className="size-5 text-muted-foreground" />}</div><div className="min-w-0"><h3 className="font-display text-xl">{slot.name ?? "Unnamed furniture"}</h3><p className="mt-1 text-xs text-muted-foreground">{slot.category_role ?? "Category unconfirmed"}</p><p className="mt-1 text-xs text-muted-foreground">{dimensions(slot)}</p></div></div>
        <div className="space-y-3 border-y border-border py-4">
          <div><h4 className="text-sm">Category & dimensions</h4><p className="mt-1 text-xs text-muted-foreground">{slot.catalog_id ? "Auto-linked from the collection. Edit only to override this hotspot." : "Custom or unlinked piece. Enter its details to select compatible 3D options."}</p></div>
          <div className="space-y-2"><Label htmlFor={`hotspot-category-${slot.id}`}>Category</Label><Select value={slot.category_role ?? undefined} disabled={pending} onValueChange={category_role => update(slot.id, { category_role, category_role_override: category_role })}><SelectTrigger id={`hotspot-category-${slot.id}`} aria-label={`Category for ${slot.name}`}><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{hotspotCategoryOptions.map(category => <SelectItem key={category} value={category}>{category.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-3 gap-2">{(["width", "depth", "height"] as const).map(axis => { const key = `${axis}_m` as const; const overrideKey = `${axis}_m_override` as const; return <div key={axis} className="space-y-2"><Label htmlFor={`hotspot-${axis}-${slot.id}`}>{axis.slice(0, 1).toUpperCase()} · m</Label><Input id={`hotspot-${axis}-${slot.id}`} aria-label={`${axis} in metres for ${slot.name}`} type="number" min="0.001" step="0.001" disabled={pending} value={slot[overrideKey] ?? slot[key] ?? ""} onChange={event => updateMeasurement(slot, axis, event.target.value)} /></div>; })}</div>
        </div>
        <div className="flex items-center justify-between gap-4"><Label htmlFor={`hotspot-swap-${slot.id}`}>Enable Hotspot Swap</Label><Switch id={`hotspot-swap-${slot.id}`} disabled={pending} checked={slot.is_swappable} onCheckedChange={checked => update(slot.id, { is_swappable: checked })} /></div>
        <div className="flex items-center justify-between gap-4"><Label htmlFor={`hotspot-finish-${slot.id}`}>Allow 3D Finish Change</Label><Switch id={`hotspot-finish-${slot.id}`} disabled={pending} checked={slot.allow_finish_customization} onCheckedChange={checked => update(slot.id, { allow_finish_customization: checked })} /></div>
        {!slot.catalog_id ? <p className="text-xs text-muted-foreground">Manual details stay with this package hotspot.</p> : slot.alternatives.length < 2 && <p className="text-xs text-muted-foreground">Fewer than two compatible 3D options are available.</p>}
        {slot.is_swappable && <div className="space-y-3"><div className="flex items-center justify-between gap-2"><h4 className="text-sm">Approved swap options</h4><span className="text-xs text-muted-foreground">{slot.pinned_alternative_ids.length} / 4 selected · minimum 2</span></div><Input aria-label={`Search alternatives for ${slot.name}`} placeholder="Search compatible furniture" value={search[slot.id] ?? ""} onChange={event => setSearch(current => ({ ...current, [slot.id]: event.target.value }))} />
          <div className="max-h-80 overflow-y-auto">{slot.alternatives.filter(option => option.name.toLowerCase().includes((search[slot.id] ?? "").toLowerCase())).map(option => {
            const checked = slot.pinned_alternative_ids.includes(option.id); const difference = option.base_price_sgd != null && slot.base_price_sgd != null ? option.base_price_sgd - slot.base_price_sgd : null;
            return <label key={option.id} className="flex cursor-pointer items-center gap-3 border-b border-border py-3"><Checkbox aria-label={`Pin ${option.name}`} checked={checked} disabled={pending || (!checked && slot.pinned_alternative_ids.length >= 4)} onCheckedChange={value => update(slot.id, { pinned_alternative_ids: value ? [...slot.pinned_alternative_ids, option.id] : slot.pinned_alternative_ids.filter(id => id !== option.id) })} /><div className="flex size-14 shrink-0 items-center justify-center bg-muted">{option.image ? <img src={option.image} alt={option.name} className="h-full w-full object-contain" /> : <ImageIcon className="size-4 text-muted-foreground" />}</div><div className="min-w-0"><p className="font-display">{option.name}</p><p className="text-xs text-muted-foreground">{dimensions(option)}</p><p className="mt-1 text-xs">{option.base_price_sgd == null ? "Price unconfirmed" : money(option.base_price_sgd)} · {difference == null ? "Difference unconfirmed" : `${difference >= 0 ? "+" : "−"}${money(Math.abs(difference))}${slot.base_price_sgd ? ` (${difference >= 0 ? "+" : ""}${(difference / slot.base_price_sgd * 100).toFixed(1)}%)` : ""}`}</p></div></label>;
          })}</div>
          {slot.pinned_alternative_ids.filter(id => !slot.alternatives.some(option => option.id === id)).map(id => <Button key={id} variant="outline" disabled={pending} onClick={() => update(slot.id, { pinned_alternative_ids: slot.pinned_alternative_ids.filter(pin => pin !== id) })}>Remove unavailable pinned option</Button>)}
        </div>}
      </section>)}
    </div>
    <footer className="space-y-3 border-t border-border pt-4">{feedback && <p role="status" className="text-sm">{feedback}</p>}<Button variant="studio-primary" disabled={loading || failed || pending || !slots.length} onClick={() => void save()}><Save className="size-4" />{pending ? "Saving…" : "Save hotspot settings"}</Button></footer>
  </SheetContent></Sheet>;
}