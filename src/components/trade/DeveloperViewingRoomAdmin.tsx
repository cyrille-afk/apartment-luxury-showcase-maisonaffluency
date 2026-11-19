import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2, RotateCw, Copy, Send, ExternalLink, Pencil, Box, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import CloudUpload from "./CloudUpload";
import { viewingRoomPackageError, type ViewingRoomPackageDraft } from "@/lib/viewingRoomPackages";
import { managerBoardsSchema, managerBoardSummary, type ManagerBoard } from "@/lib/viewingRoomManager";
import { convertCents, useFxRates, type DisplayCurrency } from "./CurrencyToggle";
import { absoluteUrl } from "@/config/site";
import PackageHotspotsDrawer from "./PackageHotspotsDrawer";
import { developerDraftDirty, layoutDraftDirty, packagesDraftDirty, registerUnsavedAdminDraft, type SavedPackageRow } from "@/lib/unsavedAdminDraft";
import { adminRecoveryKey, hasRecoveryChanges, parseAdminRecovery, type AdminRecoveryDraft } from "@/lib/adminDraftRecovery";
import { Link } from "@/lib/router-compat";
import { moodFolderUrl } from "@/lib/moodFolderEditing";
import { viewingRoomPath, rememberViewingRoomReturn } from "@/lib/viewingRoomLink";
import { redeemViewingRoomAccess } from "@/lib/viewingRoom.functions";
import ViewingRoomAccessControls from "./ViewingRoomAccessControls";

const emptyDeveloper = { developer_name: "", developer_logo_url: "", hero_image_url: "" };
const emptyLayout = { name: "", floorplan_url: "", specs_label: "", room_environment_glb: "" };
const emptyPackage = (): ViewingRoomPackageDraft => ({ moodboard_id: "", tier_name: "", package_price: "", currency: "EUR", description: "", allow_alternatives: true });
const currencies = ["EUR", "USD", "SGD", "GBP", "CHF"];
const money = (cents: number, currency = "EUR") => new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);

function Readiness({ board }: { board?: ManagerBoard }) {
  if (!board) return null;
  const summary = managerBoardSummary(board);
  return <span className="inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[11px] text-muted-foreground">{summary.isReady ? <Check className="size-3" /> : <Box className="size-3" />}{summary.isReady ? "3D Ready" : "3D incomplete"} · {summary.ready}/{summary.count}</span>;
}

export function DeveloperViewingRoomAdmin({ projectId }: { projectId: string }) {
  const { user, isAdmin, rolesLoaded } = useAuth();
  const fx = useFxRates();
  const [developers, setDevelopers] = useState<Tables<"developer_projects">[]>([]);
  const [layouts, setLayouts] = useState<Tables<"residence_layouts">[]>([]);
  const [boards, setBoards] = useState<ManagerBoard[]>([]);
  const [developerId, setDeveloperId] = useState("");
  const [layoutId, setLayoutId] = useState("");
  const [developer, setDeveloper] = useState(emptyDeveloper);
  const [layout, setLayout] = useState(emptyLayout);
  const [packages, setPackages] = useState<ViewingRoomPackageDraft[]>([]);
  const [savedPackages, setSavedPackages] = useState<SavedPackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [packageLoading, setPackageLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packageError, setPackageError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [assignment, setAssignment] = useState<{ index: number | null; draft: ViewingRoomPackageDraft } | null>(null);
  const [assignmentError, setAssignmentError] = useState("");
  const [savedPackageIds, setSavedPackageIds] = useState<Record<string, string>>({});
  const [hotspotPackage, setHotspotPackage] = useState<{ id: string; tier: string } | null>(null);
  const [recovery, setRecovery] = useState<AdminRecoveryDraft | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const restorePackages = useRef<AdminRecoveryDraft | null>(null);
  const packageState = useRef({ layoutId, packages, savedPackages });
  packageState.current = { layoutId, packages, savedPackages };
  const storageKey = user ? adminRecoveryKey(user.id, projectId) : null;
  useEffect(() => {
    if (!storageKey || !rolesLoaded || !isAdmin) return;
    try { setRecovery(parseAdminRecovery(localStorage.getItem(storageKey))); }
    catch { setStorageFailed(true); }
    setRecoveryReady(true);
  }, [storageKey, rolesLoaded, isAdmin]);

  const chooseLayout = (row?: Tables<"residence_layouts">) => {
    if ((row?.id ?? "") !== layoutId) { setPackages([]); setSavedPackages([]); }
    setLayoutId(row?.id ?? ""); setLayout(row ? { name: row.name, floorplan_url: row.floorplan_url ?? "", specs_label: row.specs_label ?? "", room_environment_glb: row.room_environment_glb ?? "" } : emptyLayout);
  };
  useEffect(() => {
    if (!rolesLoaded || !isAdmin) return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    (async () => {
      const [d, b] = await Promise.all([
        supabase.from("developer_projects").select("*").eq("project_id", projectId).order("created_at").abortSignal(controller.signal),
        supabase.rpc("get_viewing_room_board_summaries", { _project_id: projectId }).abortSignal(controller.signal),
      ]);
      if (d.error || b.error) throw new Error();
      const r = d.data.length ? await supabase.from("residence_layouts").select("*").in("developer_project_id", d.data.map(row => row.id)).order("created_at").abortSignal(controller.signal) : { data: [], error: null };
      if (r.error) throw r.error;
      if (controller.signal.aborted) return;
      setDevelopers(d.data); setBoards(managerBoardsSchema.parse(b.data)); setLayouts(r.data ?? []);
      if (!developerId && d.data[0]) {
        const first = d.data[0]; setDeveloperId(first.id);
        setDeveloper({ developer_name: first.developer_name, developer_logo_url: first.developer_logo_url ?? "", hero_image_url: first.hero_image_url ?? "" });
        chooseLayout(r.data?.find(row => row.developer_project_id === first.id));
      }
    })().catch(() => { if (!controller.signal.aborted) setError("The viewing room couldn’t load. Please retry."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, revision, rolesLoaded, isAdmin]);

  useEffect(() => {
    if (!layoutId || !rolesLoaded || !isAdmin) { setPackages([]); setSavedPackages([]); setPackageLoading(false); return; }
    const controller = new AbortController(); setPackageLoading(true); setPackageError(false); setSavedPackageIds({}); setHotspotPackage(null);
    Promise.resolve(supabase.from("furniture_packages").select("*").eq("residence_layout_id", layoutId).order("sort_order").abortSignal(controller.signal)).then(({ data, error: readError }) => {
      if (controller.signal.aborted) return;
      if (readError) { setPackageError(true); setError("Packages couldn’t load. Retry before saving."); return; }
      setSavedPackageIds(Object.fromEntries(data.map(row => [row.moodboard_id, row.id])));
      setSavedPackages(data);
      const restored = restorePackages.current;
      if (restored?.layoutId === layoutId) {
        if (restored.packages) setPackages(restored.packages);
        else setPackages(data.map(row => ({ moodboard_id: row.moodboard_id, tier_name: row.tier_name, package_price: String(row.package_price), currency: row.currency, description: row.description, lead_time_weeks: row.lead_time_weeks == null ? "" : String(row.lead_time_weeks), allow_alternatives: row.allow_alternatives })));
        restorePackages.current = null;
      } else if (packageState.current.layoutId !== layoutId || !packagesDraftDirty(packageState.current.packages, packageState.current.savedPackages)) {
        setPackages(data.map(row => ({ moodboard_id: row.moodboard_id, tier_name: row.tier_name, package_price: String(row.package_price), currency: row.currency, description: row.description, lead_time_weeks: row.lead_time_weeks == null ? "" : String(row.lead_time_weeks), allow_alternatives: row.allow_alternatives })));
      }
    }).catch(() => { if (!controller.signal.aborted) { setPackageError(true); setError("Packages couldn’t load. Please retry."); } }).finally(() => { if (!controller.signal.aborted) setPackageLoading(false); });
    return () => controller.abort();
  }, [layoutId, revision, rolesLoaded, isAdmin]);

  const disabled = pending || loading || packageLoading;
  const runSave = async (operation: () => Promise<void>, message: string) => {
    if (disabled || !rolesLoaded || !isAdmin) return;
    setPending(true); setError(null); setNotice(null);
    try { await operation(); setNotice(message); setRevision(value => value + 1); }
    catch { setError("Changes couldn’t save. Your draft is still here; please retry."); }
    finally { setPending(false); }
  };
  const savedDeveloper = developers.find(row => row.id === developerId);
  const accessEnded = !!savedDeveloper?.access_revoked_at || (!!savedDeveloper?.access_expires_at && Date.parse(savedDeveloper.access_expires_at) <= Date.now());
  const savedLayout = layouts.find(row => row.id === layoutId) ?? null;
  const draftIsUnsaved = useMemo(
    () =>
      developerDraftDirty(developer, savedDeveloper ?? null) ||
      layoutDraftDirty(layout, savedLayout) ||
      packagesDraftDirty(packages, savedPackages) || !!assignment,
    [developer, savedDeveloper, layout, savedLayout, packages, savedPackages, assignment],
  );
  // The navigation guard reads this at click time, so the newest render wins.
  const draftIsUnsavedRef = useRef(draftIsUnsaved);
  draftIsUnsavedRef.current = draftIsUnsaved;
  useEffect(() => registerUnsavedAdminDraft(() => draftIsUnsavedRef.current), []);
  useEffect(() => {
    if (!storageKey || !recoveryReady || recovery || disabled || error || packageError || restorePackages.current) return;
    const draft: AdminRecoveryDraft = {
      version: 1, updatedAt: Date.now(), developerId, layoutId,
      ...(developerDraftDirty(developer, savedDeveloper ?? null) ? { developer } : {}),
      ...(layoutDraftDirty(layout, savedLayout) ? { layout } : {}),
      ...(packagesDraftDirty(packages, savedPackages) ? { packages } : {}),
      ...(assignment ? { assignment } : {}),
    };
    try {
      if (hasRecoveryChanges(draft)) localStorage.setItem(storageKey, JSON.stringify(draft));
      else localStorage.removeItem(storageKey);
      setStorageFailed(false);
    } catch { setStorageFailed(true); }
  }, [storageKey, recoveryReady, recovery, disabled, error, packageError, developerId, layoutId, developer, savedDeveloper, layout, savedLayout, packages, savedPackages, assignment]);
  const discardRecovery = () => {
    try { if (storageKey) localStorage.removeItem(storageKey); setRecovery(null); }
    catch { setStorageFailed(true); }
  };
  const restoreRecovery = () => {
    if (!recovery) return;
    const targetDeveloper = developers.find(row => row.id === recovery.developerId);
    const targetLayout = layouts.find(row => row.id === recovery.layoutId && row.developer_project_id === recovery.developerId);
    if ((recovery.developerId && !targetDeveloper) || (recovery.layoutId && !targetLayout)) {
      setError("This draft’s developer or residence is no longer available. Discard the draft to continue."); return;
    }
    setDeveloperId(recovery.developerId);
    setDeveloper(recovery.developer ?? (targetDeveloper ? { developer_name: targetDeveloper.developer_name, developer_logo_url: targetDeveloper.developer_logo_url ?? "", hero_image_url: targetDeveloper.hero_image_url ?? "" } : emptyDeveloper));
    chooseLayout(targetLayout);
    if (recovery.layout) { setLayout(recovery.layout); setLayoutOpen(true); }
    if (recovery.layoutId === layoutId) { if (recovery.packages) setPackages(recovery.packages); }
    else if (recovery.layoutId) restorePackages.current = recovery;
    if (recovery.assignment) setAssignment(recovery.assignment);
    setRecovery(null); setNotice("Local draft restored. Changes remain unsaved.");
  };
  const magicLink = savedDeveloper ? absoluteUrl(viewingRoomPath(savedDeveloper.developer_name)) : "";
  const activeLayouts = layouts.filter(row => row.developer_project_id === developerId);
  const draftBoard = boards.find(row => row.id === assignment?.draft.moodboard_id);
  const draftSummary = draftBoard ? managerBoardSummary(draftBoard) : null;
  const boardPrice = (board: ManagerBoard, currency: string) => convertCents(managerBoardSummary(board).totalCents, "EUR", currency as DisplayCurrency, fx);
  const editAssignment = (change: Partial<ViewingRoomPackageDraft>) => setAssignment(current => current ? { ...current, draft: { ...current.draft, ...change } } : null);
  const setAssignmentBoard = (id: string) => {
    if (!id) return;
    const board = boards.find(row => row.id === id); if (!board || !assignment) return;
    const summary = managerBoardSummary(board);
    editAssignment({ moodboard_id: id, package_price: summary.unpriced ? "" : String(boardPrice(board, assignment.draft.currency) / 100) });
  };
  if (!rolesLoaded || !isAdmin) return null;
  return <section aria-label="Developer Viewing Room administration" className="viewing-room [&_button]:cursor-pointer [&_[role=combobox]]:cursor-pointer h-auto overflow-visible xl:h-full xl:overflow-y-auto bg-background px-4 py-6 text-foreground md:px-8 lg:px-12" data-trade-sensitive>
    <header className="mb-7 flex items-start justify-between gap-4"><div><p className="mb-2 text-[10px] uppercase text-muted-foreground">Private residences · Administration</p><h2 className="font-display text-3xl">Developer Viewing Room Manager</h2></div><Button variant="ghost" size="icon" aria-label="Reload viewing room" disabled={disabled} onClick={() => setRevision(value => value + 1)}><RotateCw className="size-4" /></Button></header>
    {loading && <p role="status" className="mb-4 text-sm text-muted-foreground">Loading viewing room…</p>}
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-destructive">{error}<Button variant="outline" disabled={disabled} onClick={() => setRevision(value => value + 1)}>Retry</Button></div>}
    {notice && <p role="status" className="mb-4 text-sm">{notice}</p>}
    {storageFailed && <p role="alert" className="mb-4 text-sm text-destructive">Draft recovery is unavailable on this device. Save your changes before refreshing.</p>}
    {recovery && <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4"><div><p className="text-sm">Unsaved Admin draft found</p><p className="mt-1 text-xs text-muted-foreground">Saved on this device · {new Date(recovery.updatedAt).toLocaleString()}</p></div><div className="flex gap-2"><Button variant="outline" disabled={disabled} onClick={discardRecovery}>Discard draft</Button><Button variant="studio-primary" disabled={disabled} onClick={restoreRecovery}>Restore draft</Button></div></div>}
    <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="min-w-0 space-y-6 xl:border-r xl:border-border xl:pr-7">
        <h3 className="border-b border-border pb-4 font-display text-xl">01 · Developer Settings</h3>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); void runSave(async () => {
          const values = { project_id: projectId, developer_name: developer.developer_name.trim(), developer_logo_url: developer.developer_logo_url || null, hero_image_url: developer.hero_image_url || null };
          const result = developerId ? await supabase.from("developer_projects").update(values).eq("id", developerId).eq("project_id", projectId).select("id").single() : await supabase.from("developer_projects").insert(values).select("id").single();
          if (result.error) throw result.error; setDeveloperId(result.data.id);
        }, "Developer project saved."); }}>
          <Select value={developerId || "new"} disabled={disabled} onValueChange={value => {
            if (!value) return;
            const row = developers.find(item => item.id === value); setDeveloperId(row?.id ?? "");
            setDeveloper(row ? { developer_name: row.developer_name, developer_logo_url: row.developer_logo_url ?? "", hero_image_url: row.hero_image_url ?? "" } : emptyDeveloper);
            chooseLayout(layouts.find(item => item.developer_project_id === row?.id));
          }}><SelectTrigger aria-label="Developer project"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">New developer project</SelectItem>{developers.map(row => <SelectItem key={row.id} value={row.id}>{row.developer_name}</SelectItem>)}</SelectContent></Select>
          <div className="space-y-2"><Label htmlFor="developer-name">Developer name</Label><Input id="developer-name" required value={developer.developer_name} disabled={disabled} onChange={event => setDeveloper({ ...developer, developer_name: event.target.value })} /></div>
          <div className="space-y-3"><Label>Developer logo</Label>{developer.developer_logo_url && <img src={developer.developer_logo_url} alt="Developer logo" className="h-16 max-w-full object-contain object-left" />}<CloudUpload folder={`viewing-room/${projectId}/logos`} accept="image/png,image/jpeg,image/webp,image/svg+xml" label="Replace Image" disabled={disabled} onUpload={urls => setDeveloper(current => ({ ...current, developer_logo_url: urls[0] ?? "" }))} /></div>
          <div className="space-y-3"><Label>Hero banner</Label>{developer.hero_image_url && <img src={developer.hero_image_url} alt={developer.developer_name} className="aspect-[16/9] w-full object-cover" />}<CloudUpload folder={`viewing-room/${projectId}/covers`} accept="image/png,image/jpeg,image/webp" label="Replace Image" disabled={disabled} onUpload={urls => setDeveloper(current => ({ ...current, hero_image_url: urls[0] ?? "" }))} /></div>
          <Button type="submit" variant="studio-primary" disabled={disabled || !developer.developer_name.trim()}><Save className="size-4" />Save developer</Button>
        </form>
        <div className="space-y-3 border-t border-border pt-5"><Label htmlFor="private-viewing-link">Private viewing room address</Label><Input id="private-viewing-link" readOnly value={magicLink} placeholder="Save a developer first" />
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!magicLink} onClick={() => void navigator.clipboard.writeText(magicLink).then(() => setNotice("Viewing room address copied.")).catch(() => setError("The address couldn’t be copied. Select it above and copy again."))}><Copy className="size-4" />Copy address</Button><Button variant="outline" disabled={!savedDeveloper || accessEnded} onClick={() => { if (!savedDeveloper) return; void navigator.clipboard.writeText(savedDeveloper.access_token).then(() => setNotice("Private access code copied. Share it only with your invited client.")).catch(() => setError("The code couldn’t be copied. Please try again.")); }}><Copy className="size-4" />Copy access code</Button><Button variant="outline" disabled={!magicLink || accessEnded} onClick={() => { if (!savedDeveloper) return; const body = `Your private viewing room:\n\n${magicLink}\n\nPrivate access code: ${savedDeveloper.access_token}`; const href = `mailto:?subject=${encodeURIComponent(`${developer.developer_name} · Private Viewing Room`)}&body=${encodeURIComponent(body)}`; const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); void navigator.clipboard.writeText(body).then(() => setNotice("Opening your email app. The invitation text is also copied — paste it into any email if no window appears.")).catch(() => setNotice("Opening your email app. If nothing appears, use Copy address and Copy access code.")); }}><Send className="size-4" />Send by email</Button><Button variant="ghost" disabled={!magicLink || accessEnded} aria-label="Open client viewing room" onClick={async () => { if (!savedDeveloper) return; try { const access = await redeemViewingRoomAccess({ data: { token: savedDeveloper.access_token } }); if (!access) { setError("This invitation is no longer available."); return; } rememberViewingRoomReturn(window.location.pathname + window.location.search); window.location.assign(access.path); } catch { setError("The viewing room couldn’t open. Please try again."); } }}><ExternalLink className="size-4" />Open</Button></div>
          {savedDeveloper && <ViewingRoomAccessControls key={savedDeveloper.id} developer={savedDeveloper} projectId={projectId} disabled={disabled} onChanged={updated => setDevelopers(rows => rows.map(row => row.id === updated.id ? updated : row))} />}
        </div>
      </div>
      <div className="min-w-0 space-y-4 xl:border-r xl:border-border xl:pr-7">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-4"><h3 className="font-display text-xl">02 · Apartment Layouts</h3><Button variant="ghost" size="icon" aria-label="Add residence layout" disabled={disabled || !developerId || activeLayouts.length >= 5} onClick={() => { chooseLayout(); setLayoutOpen(true); }}><Plus className="size-4" /></Button></div>
        <p className="text-xs text-muted-foreground">{activeLayouts.length} / 5 residences</p>
        {!activeLayouts.length && !loading && <p className="py-8 text-sm text-muted-foreground">No residence layouts assigned.</p>}
        {activeLayouts.map(row => <article key={row.id} className={`overflow-hidden border ${layoutId === row.id ? "border-foreground" : "border-border"}`}>
          <Button variant="ghost" aria-label={`Select ${row.name}`} aria-pressed={layoutId === row.id} disabled={disabled} className="h-auto w-full flex-col items-stretch gap-0 whitespace-normal rounded-none p-0 text-left" onClick={() => chooseLayout(row)}><div className="flex aspect-[16/9] items-center justify-center border-b border-border bg-background p-4">{row.floorplan_url ? <img src={row.floorplan_url} alt={`${row.name} floor plan`} className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">Floor plan pending</span>}</div><div className="p-4"><h4 className="font-display text-lg">{row.name}</h4><p className="mt-2 text-xs text-muted-foreground">{row.specs_label}</p></div></Button>
          <div className="flex items-center justify-between px-4 pb-3"><span className="text-[10px] uppercase text-muted-foreground">{layoutId === row.id ? "Active layout" : "Residence"}</span><Button variant="ghost" size="sm" disabled={disabled} onClick={() => { chooseLayout(row); setLayoutOpen(true); }}><Pencil className="size-3" />Edit</Button></div>
        </article>)}
      </div>
      <div className="min-w-0 space-y-4">
        <div className="sticky top-14 xl:top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background py-4"><h3 className="font-display text-xl">03 · Furniture Packages</h3><div className="flex items-center gap-1"><Button variant="studio-primary" disabled={disabled || !layoutId || packageError || packages.length < 3} onClick={() => {
          const validation = viewingRoomPackageError(packages, boards.map(row => row.id)); if (validation) { setError(validation); return; }
          void runSave(async () => { const result = await supabase.rpc("save_viewing_room_packages", { _layout_id: layoutId, _packages: packages.map(row => ({ ...row, tier_name: row.tier_name.trim(), package_price: Number(row.package_price) })) }); if (result.error) throw result.error; }, "Furniture packages saved.");
        }}><Save className="size-4" />Save packages</Button><Button variant="ghost" size="icon" aria-label="Assign Moodboard" disabled={disabled || !layoutId || packageError || packages.length >= 5} onClick={() => { setAssignmentError(""); setAssignment({ index: null, draft: emptyPackage() }); }}><Plus className="size-4" /></Button></div></div>
        <p className="text-xs text-muted-foreground">{layoutId ? layout.name : "Select a residence"} · {packages.length} / 5 tiers</p>
        {packageLoading && <p role="status" className="py-8 text-sm text-muted-foreground">Loading packages…</p>}
        {!packageLoading && !packages.length && <p className="py-8 text-sm text-muted-foreground">No furniture packages assigned.</p>}
        {!packageLoading && packages.map((row, index) => { const board = boards.find(item => item.id === row.moodboard_id); const summary = board ? managerBoardSummary(board) : null;
          return <article key={row.moodboard_id} className="space-y-4 border border-border p-5">
            <div className="flex items-start justify-between gap-2"><div><h4 className="font-display text-2xl">{row.tier_name}</h4><p className="mt-2 text-xs text-muted-foreground">{board?.title ?? "Moodboard unavailable"} · {summary?.count ?? "—"} pieces</p></div><div className="flex"><Button variant="ghost" size="icon" aria-label={`Edit ${row.tier_name}`} disabled={disabled} onClick={() => { setAssignmentError(""); setAssignment({ index, draft: { ...row } }); }}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" aria-label={`Remove ${row.tier_name}`} disabled={disabled || packages.length <= 3} onClick={() => setPackages(current => current.filter((_, i) => i !== index))}><Trash2 className="size-3.5" /></Button></div></div>
            {board && <div className="grid grid-cols-3 gap-2">{board.items.slice(0, 3).map(item => <div key={item.id} className="flex aspect-square items-center justify-center bg-background">{item.image && <img src={item.image} alt={item.name ?? "Furniture"} className="h-full w-full object-contain" />}</div>)}</div>}
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-display text-xl">{money(Math.round(Number(row.package_price) * 100), row.currency)}</span><Readiness board={board} /></div>
            {summary && <p className="text-xs text-muted-foreground">Furniture total · {summary.from ? "From " : ""}{money(board ? boardPrice(board, row.currency) : 0, row.currency)}{summary.unpriced ? ` · ${summary.unpriced} unpriced` : ""}</p>}
            <p className="text-xs text-muted-foreground">Lead time · {row.lead_time_weeks ? `${row.lead_time_weeks} weeks` : "To be confirmed"}</p>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3"><Label htmlFor={`swap-${index}`} className="text-xs">Buyer swaps via hotspots</Label><Switch id={`swap-${index}`} disabled={disabled} checked={row.allow_alternatives ?? true} onCheckedChange={checked => setPackages(current => current.map((item, i) => i === index ? { ...item, allow_alternatives: checked } : item))} /></div>
            <Button variant="outline" disabled={disabled || !savedPackageIds[row.moodboard_id]} onClick={() => { const id = savedPackageIds[row.moodboard_id]; if (id) setHotspotPackage({ id, tier: row.tier_name }); }}>Configure Hotspots</Button>
            {board && <Button asChild variant="ghost" className="h-auto gap-1.5 px-0"><Link to={moodFolderUrl(projectId, row.moodboard_id)}><Pencil className="size-3.5" />Edit Items</Link></Button>}
            {!savedPackageIds[row.moodboard_id] && <p className="text-xs text-muted-foreground">Save packages before configuring hotspots.</p>}
          </article>;
        })}
        <Button variant="outline" disabled={disabled || !layoutId || packageError || packages.length >= 5} onClick={() => { setAssignmentError(""); setAssignment({ index: null, draft: emptyPackage() }); }}><Plus className="size-4" />Assign Moodboard</Button>
        {packages.length < 3 && <p className="mt-3 text-xs text-muted-foreground">Assign 3–5 distinct moodboards before saving.</p>}
      </div>
    </div>
    <Dialog open={layoutOpen} onOpenChange={setLayoutOpen}><DialogContent className="viewing-room max-h-[90dvh] overflow-y-auto bg-background text-foreground"><DialogHeader><DialogTitle className="font-display text-2xl">{layoutId ? "Edit Residence Layout" : "Add Residence Layout"}</DialogTitle><DialogDescription>{developer.developer_name}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void runSave(async () => {
        const values = { developer_project_id: developerId, name: layout.name.trim(), floorplan_url: layout.floorplan_url || null, specs_label: layout.specs_label || null, room_environment_glb: layout.room_environment_glb || null };
        const result = layoutId ? await supabase.from("residence_layouts").update(values).eq("id", layoutId).eq("developer_project_id", developerId).select("id").single() : await supabase.from("residence_layouts").insert(values).select("id").single(); if (result.error) throw result.error; setLayoutId(result.data.id); setLayoutOpen(false);
      }, "Residence layout saved."); }}>
        <div className="space-y-2"><Label htmlFor="residence-name">Layout name</Label><Input id="residence-name" required value={layout.name} disabled={disabled} onChange={event => setLayout({ ...layout, name: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="residence-specs">Room specifications</Label><Input id="residence-specs" placeholder="3 Bed · 2,400 sq ft" value={layout.specs_label} disabled={disabled} onChange={event => setLayout({ ...layout, specs_label: event.target.value })} /></div>
        <div className="space-y-3"><Label htmlFor="residence-plan">Floor plan</Label>{layout.floorplan_url && <img src={layout.floorplan_url} alt="Residence floor plan" className="max-h-48 w-full object-contain" />}<CloudUpload folder={`viewing-room/${projectId}/plans`} accept="image/png,image/jpeg,image/webp" label="Upload floor plan" disabled={disabled} onUpload={urls => setLayout(current => ({ ...current, floorplan_url: urls[0] ?? "" }))} /><Input id="residence-plan" type="text" inputMode="url" value={layout.floorplan_url} disabled={disabled} onChange={event => setLayout({ ...layout, floorplan_url: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="residence-glb">Room environment GLB URL</Label><Input id="residence-glb" type="text" inputMode="url" value={layout.room_environment_glb} disabled={disabled} onChange={event => setLayout({ ...layout, room_environment_glb: event.target.value })} /></div>
        <Button type="submit" variant="studio-primary" disabled={disabled || !developerId || !layout.name.trim()}><Save className="size-4" />Save layout</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </form>
    </DialogContent></Dialog>
    <Dialog open={!!assignment} onOpenChange={open => { if (!open) setAssignment(null); }}><DialogContent className="viewing-room max-h-[90dvh] overflow-y-auto bg-background text-foreground"><DialogHeader><DialogTitle className="font-display text-2xl">Assign Moodboard</DialogTitle><DialogDescription>{layout.name}</DialogDescription></DialogHeader>
      {assignment && <form className="space-y-4" onSubmit={event => { event.preventDefault(); const row = assignment.draft;
        if (!row.moodboard_id || !row.tier_name.trim() || !row.package_price.trim() || Number(row.package_price) < 0) { setAssignmentError("Choose a moodboard, name the tier and confirm its package price."); return; }
        if (packages.some((item, i) => i !== assignment.index && item.tier_name.trim() === row.tier_name.trim())) { setAssignmentError("Choose a unique tier name."); return; }
        setPackages(current => assignment.index == null ? [...current, row] : current.map((item, i) => i === assignment.index ? row : item)); setAssignment(null); setNotice("Tier added to draft. Save packages to publish the changes.");
      }}>
        <div className="space-y-2"><Label>Project Studio moodboard</Label><Select value={assignment.draft.moodboard_id || undefined} onValueChange={setAssignmentBoard}><SelectTrigger aria-label="Assign moodboard selection"><SelectValue placeholder="Select moodboard" /></SelectTrigger><SelectContent>{boards.map((board, index) => <SelectItem key={board.id} value={board.id} disabled={packages.some((row, i) => i !== assignment.index && row.moodboard_id === board.id)}>{board.title} · Folder {index + 1} · {board.items.length} pieces</SelectItem>)}</SelectContent></Select></div>
        {draftBoard && draftSummary && <div className="space-y-3 border-y border-border py-4"><div className="grid grid-cols-4 gap-2">{draftBoard.items.slice(0, 4).map(item => <div key={item.id} className="aspect-square">{item.image && <img src={item.image} alt={item.name ?? "Furniture"} className="h-full w-full object-contain" />}</div>)}</div><Readiness board={draftBoard} /><p className="font-display text-xl">Furniture total · {draftSummary.from ? "From " : ""}{money(boardPrice(draftBoard, assignment.draft.currency), assignment.draft.currency)}</p>{draftSummary.unpriced > 0 && <p className="text-xs text-destructive">{draftSummary.unpriced} item prices unconfirmed. Confirm the package price before assigning.</p>}</div>}
        <div className="space-y-2"><Label htmlFor="assignment-tier">Tier name</Label><Input id="assignment-tier" required placeholder="Essential, Signature or Bespoke" value={assignment.draft.tier_name} onChange={event => editAssignment({ tier_name: event.target.value })} /></div>
        <div className="grid grid-cols-[1fr_100px] gap-3"><div className="space-y-2"><Label htmlFor="assignment-price">Package price · {assignment.draft.currency}</Label><Input id="assignment-price" required type="number" min="0" step="0.01" value={assignment.draft.package_price} onChange={event => editAssignment({ package_price: event.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Select value={assignment.draft.currency} onValueChange={currency => { if (currency) editAssignment({ currency, package_price: draftBoard && !draftSummary?.unpriced ? String(boardPrice(draftBoard, currency) / 100) : "" }); }}><SelectTrigger aria-label="Package currency"><SelectValue /></SelectTrigger><SelectContent>{currencies.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div></div>
        <div className="space-y-2"><Label htmlFor="assignment-lead">Lead time · weeks</Label><Input id="assignment-lead" type="number" min="1" step="1" value={assignment.draft.lead_time_weeks ?? ""} onChange={event => editAssignment({ lead_time_weeks: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="assignment-description">Description</Label><Textarea id="assignment-description" rows={2} value={assignment.draft.description} onChange={event => editAssignment({ description: event.target.value })} /></div>
        <div className="flex items-center justify-between gap-3"><Label htmlFor="assignment-swaps">Buyer swaps via hotspots</Label><Switch id="assignment-swaps" checked={assignment.draft.allow_alternatives ?? true} onCheckedChange={checked => editAssignment({ allow_alternatives: checked })} /></div>
        {assignmentError && <p role="alert" className="text-sm text-destructive">{assignmentError}</p>}<Button type="submit" variant="studio-primary">{assignment.index == null ? "Add to packages" : "Update package"}</Button>
      </form>}
    </DialogContent></Dialog>
    {hotspotPackage && <PackageHotspotsDrawer key={hotspotPackage.id} projectId={projectId} packageId={hotspotPackage.id} tier={hotspotPackage.tier} onClose={() => setHotspotPackage(null)} />}
  </section>;
}
