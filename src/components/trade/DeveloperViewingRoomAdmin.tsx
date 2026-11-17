import { useEffect, useState } from "react";
import { Plus, Save, Trash2, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { viewingRoomPackageError, type ViewingRoomPackageDraft } from "@/lib/viewingRoomPackages";
import { absoluteUrl } from "@/config/site";

const emptyDeveloper = { developer_name: "", developer_logo_url: "", hero_image_url: "" };
const emptyLayout = { name: "", floorplan_url: "", specs_label: "", room_environment_glb: "" };
const emptyPackage = (): ViewingRoomPackageDraft => ({ moodboard_id: "", tier_name: "", package_price: "", currency: "EUR", description: "" });

export function DeveloperViewingRoomAdmin({ projectId }: { projectId: string }) {
  const { isAdmin, rolesLoaded } = useAuth();
  const [developers, setDevelopers] = useState<Tables<"developer_projects">[]>([]);
  const [layouts, setLayouts] = useState<Tables<"residence_layouts">[]>([]);
  const [boards, setBoards] = useState<{ id: string; title: string }[]>([]);
  const [developerId, setDeveloperId] = useState("");
  const [layoutId, setLayoutId] = useState("");
  const [developer, setDeveloper] = useState(emptyDeveloper);
  const [layout, setLayout] = useState(emptyLayout);
  const [packages, setPackages] = useState<ViewingRoomPackageDraft[]>([emptyPackage(), emptyPackage(), emptyPackage()]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!rolesLoaded || !isAdmin) return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    (async () => {
      const [d, b] = await Promise.all([
        supabase.from("developer_projects").select("*").eq("project_id", projectId).order("created_at").abortSignal(controller.signal),
        supabase.from("client_boards").select("id,title").eq("project_id", projectId).order("created_at").abortSignal(controller.signal),
      ]);
      if (d.error || b.error) throw new Error();
      const r = d.data.length ? await supabase.from("residence_layouts").select("*").in("developer_project_id", d.data.map(row => row.id)).order("created_at").abortSignal(controller.signal) : { data: [], error: null };
      if (r.error) throw new Error();
      if (!controller.signal.aborted) { setDevelopers(d.data); setBoards(b.data); setLayouts(r.data ?? []); }
    })().catch(() => { if (!controller.signal.aborted) setError("The viewing room couldn’t load. Please retry."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, revision, rolesLoaded, isAdmin]);

  useEffect(() => {
    if (!layoutId || !rolesLoaded || !isAdmin) { setPackages([emptyPackage(), emptyPackage(), emptyPackage()]); return; }
    const controller = new AbortController();
    setLoading(true); setError(null);
    Promise.resolve(supabase.from("furniture_packages").select("*").eq("residence_layout_id", layoutId).order("sort_order").abortSignal(controller.signal)).then(({ data, error: readError }) => {
      if (controller.signal.aborted) return;
      if (readError) { setError("Packages couldn’t load. Retry before saving."); return; }
      setPackages(data.length ? data.map(row => ({ moodboard_id: row.moodboard_id, tier_name: row.tier_name, package_price: String(row.package_price), currency: row.currency, description: row.description, lead_time_weeks: row.lead_time_weeks == null ? "" : String(row.lead_time_weeks) })) : [emptyPackage(), emptyPackage(), emptyPackage()]);
    }).catch(() => { if (!controller.signal.aborted) setError("Packages couldn’t load. Retry before saving."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [layoutId, revision, rolesLoaded, isAdmin]);

  const runSave = async (operation: () => Promise<void>, message: string) => {
    if (pending || loading || !rolesLoaded || !isAdmin) return;
    setPending(true); setError(null); setNotice(null);
    try { await operation(); setNotice(message); setRevision(value => value + 1); }
    catch { setError("Changes couldn’t save. Your draft is still here; please retry."); }
    finally { setPending(false); }
  };
  const selectDeveloper = (value: string) => {
    setDeveloperId(value === "new" ? "" : value); setLayoutId(""); setLayout(emptyLayout); setNotice(null);
    const row = developers.find(item => item.id === value);
    setDeveloper(row ? { developer_name: row.developer_name, developer_logo_url: row.developer_logo_url ?? "", hero_image_url: row.hero_image_url ?? "" } : emptyDeveloper);
  };
  const selectLayout = (value: string) => {
    setLayoutId(value === "new" ? "" : value); setNotice(null);
    const row = layouts.find(item => item.id === value);
    setLayout(row ? { name: row.name, floorplan_url: row.floorplan_url ?? "", specs_label: row.specs_label ?? "", room_environment_glb: row.room_environment_glb ?? "" } : emptyLayout);
  };
  const editPackage = (index: number, change: Partial<ViewingRoomPackageDraft>) => setPackages(current => current.map((row, i) => i === index ? { ...row, ...change } : row));
  const disabled = pending || loading;
  if (!rolesLoaded || !isAdmin) return null;
  return <section aria-label="Developer Viewing Room administration" className="h-full overflow-y-auto px-4 py-6 md:px-8 lg:px-12" data-trade-sensitive>
    <div className="mb-6 flex items-center justify-between gap-4"><h2 className="font-display text-2xl">Developer Viewing Room</h2><Button variant="ghost" size="icon" aria-label="Reload viewing room" disabled={disabled} onClick={() => setRevision(value => value + 1)}><RotateCw className="size-4" /></Button></div>
    {loading && <p role="status" className="mb-4 text-sm text-muted-foreground">Loading viewing room…</p>}
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-destructive">{error}<Button variant="outline" disabled={disabled} onClick={() => setRevision(value => value + 1)}>Retry</Button></div>}
    {notice && <p role="status" className="mb-4 text-sm text-foreground">{notice}</p>}
    <div className="grid gap-10 xl:grid-cols-2">
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void runSave(async () => {
        const values = { project_id: projectId, developer_name: developer.developer_name.trim(), developer_logo_url: developer.developer_logo_url || null, hero_image_url: developer.hero_image_url || null };
        const result = developerId ? await supabase.from("developer_projects").update(values).eq("id", developerId).eq("project_id", projectId).select("id").single() : await supabase.from("developer_projects").insert(values).select("id").single();
        if (result.error) throw result.error;
        setDeveloperId(result.data.id);
      }, "Developer project saved."); }}>
        <h3 className="trade-micro-label">01 · Developer project</h3>
        <Select value={developerId || "new"} disabled={disabled} onValueChange={selectDeveloper}><SelectTrigger aria-label="Developer project"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">New developer project</SelectItem>{developers.map(row => <SelectItem key={row.id} value={row.id}>{row.developer_name}</SelectItem>)}</SelectContent></Select>
        <div className="space-y-2"><Label htmlFor="developer-name">Developer name</Label><Input id="developer-name" required value={developer.developer_name} disabled={disabled} onChange={event => setDeveloper({ ...developer, developer_name: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="developer-logo">Developer logo URL</Label><Input id="developer-logo" type="url" value={developer.developer_logo_url} disabled={disabled} onChange={event => setDeveloper({ ...developer, developer_logo_url: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="developer-hero">Hero image URL</Label><Input id="developer-hero" type="url" value={developer.hero_image_url} disabled={disabled} onChange={event => setDeveloper({ ...developer, hero_image_url: event.target.value })} /></div>
        {developer.hero_image_url && <img src={developer.hero_image_url} alt={developer.developer_name} className="aspect-[16/9] w-full object-cover" />}
        <Button type="submit" variant="studio-primary" disabled={disabled || !developer.developer_name.trim()}><Save className="size-4" />Save developer</Button>
        {developerId && <Button type="button" variant="outline" className="ml-2" onClick={() => { const saved = developers.find(row => row.id === developerId); if (saved) window.location.assign(absoluteUrl(`/viewing-room/${encodeURIComponent(saved.access_token)}`)); }}>Open client viewing room</Button>}
      </form>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!developerId) return; void runSave(async () => {
        const values = { developer_project_id: developerId, name: layout.name.trim(), floorplan_url: layout.floorplan_url || null, specs_label: layout.specs_label || null, room_environment_glb: layout.room_environment_glb || null };
        const result = layoutId ? await supabase.from("residence_layouts").update(values).eq("id", layoutId).eq("developer_project_id", developerId).select("id").single() : await supabase.from("residence_layouts").insert(values).select("id").single();
        if (result.error) throw result.error;
        setLayoutId(result.data.id);
      }, "Residence layout saved."); }}>
        <h3 className="trade-micro-label">02 · Residence layout</h3>
        <Select value={layoutId || "new"} disabled={disabled || !developerId} onValueChange={selectLayout}><SelectTrigger aria-label="Residence layout"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">New residence layout</SelectItem>{layouts.filter(row => row.developer_project_id === developerId).map(row => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select>
        <div className="space-y-2"><Label htmlFor="residence-name">Layout name</Label><Input id="residence-name" required disabled={disabled || !developerId} value={layout.name} onChange={event => setLayout({ ...layout, name: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="residence-specs">Specifications</Label><Input id="residence-specs" placeholder="3 Bed · 2,400 sq ft" disabled={disabled || !developerId} value={layout.specs_label} onChange={event => setLayout({ ...layout, specs_label: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="residence-plan">Floor plan URL</Label><Input id="residence-plan" type="url" disabled={disabled || !developerId} value={layout.floorplan_url} onChange={event => setLayout({ ...layout, floorplan_url: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="residence-glb">Room environment GLB URL</Label><Input id="residence-glb" type="url" disabled={disabled || !developerId} value={layout.room_environment_glb} onChange={event => setLayout({ ...layout, room_environment_glb: event.target.value })} /></div>
        {layout.floorplan_url && <img src={layout.floorplan_url} alt={layout.name} className="aspect-[16/9] w-full object-contain" />}
        <Button type="submit" variant="studio-primary" disabled={disabled || !developerId || !layout.name.trim()}><Save className="size-4" />Save layout</Button>
      </form>
    </div>
    <form className="mt-10 border-t border-border pt-6" onSubmit={event => { event.preventDefault(); if (!layoutId || error) return; const validation = viewingRoomPackageError(packages, boards.map(row => row.id)); if (validation) { setError(validation); return; } void runSave(async () => {
      const { error: saveError } = await supabase.rpc("save_viewing_room_packages", { _layout_id: layoutId, _packages: packages.map(row => ({ ...row, tier_name: row.tier_name.trim(), package_price: Number(row.package_price) })) });
      if (saveError) throw saveError;
    }, `${packages.length} packages saved.`); }}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h3 className="trade-micro-label">03 · Tiered packages · {packages.length} / 5</h3><Button type="button" variant="outline" disabled={disabled || !layoutId || packages.length >= 5} onClick={() => setPackages(current => [...current, emptyPackage()])}><Plus className="size-4" />Add tier</Button></div>
      {boards.length < 3 && <p className="mb-5 text-sm text-muted-foreground">This project has {boards.length} mood boards. At least 3 distinct mood boards are required to save packages.</p>}
      <fieldset disabled={disabled || !layoutId} className="space-y-5">
        {packages.map((row, index) => <div key={index} className="grid gap-4 border-b border-border pb-5 md:grid-cols-2 xl:grid-cols-[1fr_1.4fr_1fr_100px_40px]">
          <div className="space-y-2"><Label htmlFor={`tier-${index}`}>Tier {index + 1}</Label><Input id={`tier-${index}`} required value={row.tier_name} onChange={event => { setError(null); editPackage(index, { tier_name: event.target.value }); }} /></div>
          <div className="space-y-2"><Label>Mood board</Label><Select value={row.moodboard_id || undefined} disabled={disabled || !layoutId} onValueChange={value => { setError(null); editPackage(index, { moodboard_id: value }); }}><SelectTrigger aria-label={`Mood board for tier ${index + 1}`}><SelectValue placeholder="Select mood board" /></SelectTrigger><SelectContent>{boards.map((board, boardIndex) => <SelectItem key={board.id} value={board.id} disabled={packages.some((other, i) => i !== index && other.moodboard_id === board.id)}>{board.title} · Folder {boardIndex + 1}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor={`price-${index}`}>Package price · {row.currency}</Label><Input id={`price-${index}`} type="number" min="0" step="0.01" required value={row.package_price} onChange={event => { setError(null); editPackage(index, { package_price: event.target.value }); }} /></div>
          <div className="space-y-2"><Label>Currency</Label><Select value={row.currency} disabled={disabled || !layoutId} onValueChange={value => editPackage(index, { currency: value })}><SelectTrigger aria-label={`Currency for tier ${index + 1}`}><SelectValue /></SelectTrigger><SelectContent>{["EUR", "USD", "SGD", "GBP", "CHF"].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <Button type="button" variant="ghost" size="icon" className="self-end" aria-label={`Remove tier ${index + 1}`} disabled={disabled || !layoutId || packages.length <= 3} onClick={() => setPackages(current => current.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button>
          <div className="space-y-2 md:col-span-2 xl:col-span-5"><Label htmlFor={`description-${index}`}>Description</Label><Textarea id={`description-${index}`} rows={2} value={row.description} onChange={event => editPackage(index, { description: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor={`lead-${index}`}>Lead time · weeks</Label><Input id={`lead-${index}`} type="number" min="1" step="1" value={row.lead_time_weeks ?? ""} onChange={event => editPackage(index, { lead_time_weeks: event.target.value })} /></div>
        </div>)}
      </fieldset>
      <Button type="submit" variant="studio-primary" className="mt-5" disabled={disabled || !layoutId || !!error || boards.length < 3}><Save className="size-4" />{pending ? "Saving…" : "Save packages"}</Button>
    </form>
  </section>;
}