import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { ArrowDown, ArrowUp, Camera, Clapperboard, Copy, Film, Link2, Loader2, Pause, Play, Plus, RefreshCw, Repeat, RotateCcw, Save, Sparkles, Square, Trash2, X } from "lucide-react";
import { CINEMATIC_PRESETS, useCinematicPath, type CinematicPreset } from "@/hooks/useCinematicPath";
import CinematicCameraRig from "@/components/trade/visualiser/CinematicCameraRig";
import { CustomPathBuilderModal, PathStoragePreferencesModal } from "@/components/trade/visualiser/CustomPathModals";
import { CameraSamplerBridge, FloorPlanDrawLayer, PathNodesGuide, type CameraSampler } from "@/components/trade/visualiser/PathAuthoringTools";
import { buildCustomCinematicPath, checkPathClearance, type ClearanceConflict, clusterCentre, listAccountPaths, listLayoutPaths, nodesFromDescription, persistCustomPath, readLocalPaths, readPathSyncStatus, readPathSyncHistory, type PathSyncHistoryEntry, type CustomCameraPath, type CustomPathNode, type PathMode, type PathSyncStatus, type StorageMode, syncLocalPathsToAccount, autoRaiseFlaggedNodes, autoShiftFlaggedNodes, type ShiftDirection } from "@/lib/customCameraPaths";
import { CINEMATIC_ENTRY_SECONDS, playbackTimeLabel, readCustomPathPreference, readWalkthroughPreferences, saveCustomPathPreference, saveWalkthroughPreferences, steppedPlaybackSpeed, WALKTHROUGH_SPEEDS, walkthroughShortcut } from "@/lib/cinematicPlayback";
import { fetchRemoteWalkthroughPreferences, pushRemoteWalkthroughPreferences } from "@/lib/walkthroughPreferenceSync";
import { Slider } from "@/components/ui/slider";
import { exportSceneToVideoAPI } from "@/lib/sceneVideoExport";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { deleteLayout, listLayouts, saveLayout, setShared, shareUrl, snapshotProducts, type SavedLayout } from "@/lib/aiLayoutStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AICuratedEnvironment from "@/components/trade/visualiser/AICuratedEnvironment";
import { DEFAULT_BRIEF, fetchLiveCatalogue, generateRoomLayout, repriceScene, summarise, toAsset, type LayoutBrief, type LiveCatalogueItem } from "@/lib/mockAiLayoutService";
import type { AICuratedSceneSchema, Vec3 } from "@/types/aiCuratedScene";
import { Textarea } from "@/components/ui/textarea";
import { curate, sceneFromCuration, type CurationResult } from "@/lib/curationEngine";

const micro = "text-[10px] uppercase tracking-[0.15em] text-muted-foreground";

/** "just now" / "5 min ago" / "2 h ago" / "3 d ago" for the camera-path sync indicator. */
function syncTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
const stockLabel = (s: string | null) => (s ? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Available");
const eur = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const ClearanceWarning = ({ conflicts }: { conflicts: ClearanceConflict[] }) => (
  <div role="alert" className="border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
    <p className="font-medium">May pass through {conflicts.length === 1 ? "1 object" : `${conflicts.length} objects`}:</p>
    <ul className="mt-1 space-y-0.5">
      {conflicts.slice(0, 5).map((c, i) => <li key={i}>{c.label} · {c.fromPct === c.toPct ? `${c.fromPct}%` : `${c.fromPct}–${c.toPct}%`} along the path</li>)}
    </ul>
    <p className="mt-1 text-muted-foreground">Raise or move nearby points to clear it.</p>
  </div>
);

const TradeAILayoutStudio = () => {
  const [brief, setBrief] = useState<LayoutBrief>(DEFAULT_BRIEF);
  const [scene, setScene] = useState<AICuratedSceneSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [catalogue, setCatalogue] = useState<LiveCatalogueItem[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [title, setTitle] = useState("Living room proposal");
  const [current, setCurrent] = useState<SavedLayout | null>(null);
  const [saved, setSaved] = useState<SavedLayout[]>([]);
  const [saving, setSaving] = useState(false);
  const [briefText, setBriefText] = useState("Warm minimalism, neutral tones, budget €50,000");
  const [curation, setCuration] = useState<CurationResult | null>(null);

  const refreshSaved = useCallback(async () => {
    try { setSaved(await listLayouts()); } catch { /* list stays empty */ }
  }, []);
  useEffect(() => { void refreshSaved(); }, [refreshSaved]);

  const save = async (asNew = false) => {
    if (!scene) return;
    setSaving(true);
    try {
      const row = await saveLayout({ id: asNew ? undefined : current?.id, title, brief, scene, products: snapshotProducts(scene, catalogue) });
      setCurrent(row);
      toast.success("Layout saved");
      void refreshSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save layout");
    } finally {
      setSaving(false);
    }
  };

  const toggleShare = async (on: boolean) => {
    if (!current) return;
    try {
      // Re-save first so the client sees the latest pieces and budget.
      if (on && scene) await saveLayout({ id: current.id, title, brief, scene, products: snapshotProducts(scene, catalogue) });
      await setShared(current.id, on);
      setCurrent({ ...current, is_shared: on });
      void refreshSaved();
      if (on) { await navigator.clipboard?.writeText(shareUrl(current.share_token)).catch(() => {}); toast.success("Share link copied"); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update sharing");
    }
  };

  const openSaved = (l: SavedLayout) => {
    setCurrent(l);
    setTitle(l.title);
    setBrief(l.brief);
    setSelectedId(null);
    setSkipped([]);
    setScene(catalogue.length ? repriceScene(l.scene, catalogue) : l.scene);
  };

  const removeSaved = async (l: SavedLayout) => {
    try {
      await deleteLayout(l.id);
      if (current?.id === l.id) setCurrent(null);
      void refreshSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete layout");
    }
  };

  const byId = useMemo(() => new Map(catalogue.map((c) => [c.componentId, c])), [catalogue]);

  const loadCatalogue = useCallback(async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      const live = await fetchLiveCatalogue();
      setCatalogue(live);
      // Products changed upstream → re-price the current layout.
      setScene((s) => (s ? repriceScene(s, live) : s));
      return live;
    } catch (e) {
      setCatError(e instanceof Error ? e.message : "Could not load catalogue prices");
      return null;
    } finally {
      setCatLoading(false);
    }
  }, []);

  useEffect(() => { void loadCatalogue(); }, [loadCatalogue]);

  const generate = async () => {
    setLoading(true);
    setSelectedId(null);
    setCurrent(null);
    try {
      const live = (await loadCatalogue()) ?? catalogue;
      const { scene: next, skipped: miss } = await generateRoomLayout(brief, live);
      setScene(next);
      setSkipped(miss);
    } finally {
      setLoading(false);
    }
  };

  const runCuration = () => {
    const result = curate(briefText, catalogue, brief.totalBudget);
    setCuration(result);
    setSelectedId(null);
    setCurrent(null);
    setSkipped(result.matrix.filter((r) => !r.eligible).map((r) => `${r.item.name} (${r.reason})`));
    if (result.parsed.budget) setBrief((b) => ({ ...b, totalBudget: result.budget }));
    setScene(sceneFromCuration(result, brief));
  };

  const withLedger = (next: AICuratedSceneSchema) => ({ ...next, financialSummary: summarise(next) });

  const swapAsset = (index: number, componentId: string) => {
    const item = byId.get(componentId);
    if (!item) return;
    setScene((s) => s && withLedger({
      ...s,
      curatedAssets: s.curatedAssets.map((a, i) => (i === index ? toAsset(item, a.position, a.rotation, a.scale) : a)),
    }));
  };

  const removeAsset = (index: number) => {
    setSelectedId(null);
    setScene((s) => s && withLedger({ ...s, curatedAssets: s.curatedAssets.filter((_, i) => i !== index) }));
  };

  // Budget edits apply to the live ledger immediately.
  useEffect(() => {
    setScene((s) => s && s.financialSummary.totalBudget !== brief.totalBudget
      ? withLedger({ ...s, financialSummary: { ...s.financialSummary, totalBudget: brief.totalBudget } })
      : s);
  }, [brief.totalBudget]);

  const onAssetTransform = useCallback((index: number, position: Vec3, rotation: Vec3) => {
    setScene((s) => {
      if (!s) return s;
      const curatedAssets = s.curatedAssets.map((a, i) => (i === index ? { ...a, position, rotation } : a));
      const next = { ...s, curatedAssets };
      return { ...next, financialSummary: summarise(next) };
    });
  }, []);

  const [walking, setWalking] = useState(false);
  const [walkPreferences] = useState(readWalkthroughPreferences);
  const [walkActive, setWalkActive] = useState(false);
  const [walkTime, setWalkTime] = useState(0);
  const [walkSpeed, setWalkSpeed] = useState(walkPreferences.speed);
  const [walkSeek, setWalkSeek] = useState({ id: 0, time: 0, restart: false });
  const [walkLoop, setWalkLoop] = useState(walkPreferences.loop);
  const [exporting, setExporting] = useState(false);
  const [walkPreset, setWalkPreset] = useState<CinematicPreset>(walkPreferences.preset);
  useEffect(() => {
    saveWalkthroughPreferences({ preset: walkPreset, speed: walkSpeed, loop: walkLoop });
  }, [walkPreset, walkSpeed, walkLoop]);
  const presetCinematic = useCinematicPath(scene, 24, walkPreset);
  // Custom path authoring
  const [builderOpen, setBuilderOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [authorMode, setAuthorMode] = useState<PathMode | null>(null);
  const [authorNodes, setAuthorNodes] = useState<CustomPathNode[]>([]);
  const [authorText, setAuthorText] = useState<string | undefined>();
  const [drawHeight, setDrawHeight] = useState(1.8);
  const [pathName, setPathName] = useState("My walkthrough");
  const [shiftDirection, setShiftDirection] = useState<ShiftDirection>("auto");
  const [customPaths, setCustomPaths] = useState<Array<CustomCameraPath & { source: "layout" | "account" | "local" }>>([]);
  const [pathSyncStatus, setPathSyncStatus] = useState<PathSyncStatus>(readPathSyncStatus);
  const [pathSyncHistory, setPathSyncHistory] = useState<PathSyncHistoryEntry[]>(readPathSyncHistory);
  const [syncHistoryOpen, setSyncHistoryOpen] = useState(false);
  const [activeCustomId, setActiveCustomId] = useState<string | null>(readCustomPathPreference);
  // Cross-device sync: account row wins on load; local stays the offline fallback.
  const prefsHydrated = useRef(false);
  useEffect(() => {
    let cancelled = false;
    fetchRemoteWalkthroughPreferences().then((remote) => {
      if (cancelled) return;
      if (remote) { setWalkPreset(remote.preset); setWalkSpeed(remote.speed); setWalkLoop(remote.loop); setActiveCustomId(remote.customPathId); }
    }).catch(() => { /* offline: keep local */ }).finally(() => { if (!cancelled) prefsHydrated.current = true; });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    saveCustomPathPreference(activeCustomId);
    if (!prefsHydrated.current) return;
    const t = window.setTimeout(() => {
      pushRemoteWalkthroughPreferences({ preset: walkPreset, speed: walkSpeed, loop: walkLoop, customPathId: activeCustomId }).catch(() => { /* retried on next change */ });
    }, 600);
    return () => window.clearTimeout(t);
  }, [walkPreset, walkSpeed, walkLoop, activeCustomId]);
  const samplerRef = useRef<CameraSampler | null>(null);
  const layoutKey = current?.id ?? null;
  const loadCustomPaths = useCallback(async () => {
    const moved = await syncLocalPathsToAccount().catch(() => new Map<string, string>());
    if (moved.size) {
      setActiveCustomId((id) => (id && moved.has(id) ? moved.get(id)! : id));
      toast.success(`${moved.size} browser-only camera path${moved.size > 1 ? "s" : ""} synced to your account`);
    }
    const local = readLocalPaths(layoutKey ?? "unsaved").map((p) => ({ ...p, source: "local" as const }));
    const [layout, account] = await Promise.all([
      layoutKey ? listLayoutPaths(layoutKey).catch(() => []) : Promise.resolve([]),
      listAccountPaths().catch(() => []),
    ]);
    setCustomPaths([...layout.map((p) => ({ ...p, source: "layout" as const })), ...account.map((p) => ({ ...p, source: "account" as const })), ...local]);
    setPathSyncStatus(readPathSyncStatus());
    setPathSyncHistory(readPathSyncHistory());
  }, [layoutKey]);
  useEffect(() => { void loadCustomPaths(); }, [loadCustomPaths]);
  const activeCustom = customPaths.find((p) => p.id === activeCustomId) ?? null;
  const customCinematic = useMemo(() => (scene && activeCustom ? buildCustomCinematicPath(scene, activeCustom.nodes) : null), [scene, activeCustom]);
  const cinematic = activeCustom ? customCinematic : presetCinematic;
  const walkDuration = cinematic ? cinematic.durationSec + CINEMATIC_ENTRY_SECONDS : 0;
  const onPathModeSelect = (mode: PathMode, customText?: string) => {
    setBuilderOpen(false);
    setWalking(false); setWalkActive(false);
    setAuthorText(customText);
    if (mode === "text" && scene) {
      const nodes = nodesFromDescription(scene, customText ?? "");
      setAuthorNodes(nodes);
      if (nodes.length < 2) { toast.error("Couldn't build a safe path from that description"); return; }
      setAuthorMode("capture"); // review/refine the generated nodes in the capture panel
      toast.success(`Built ${nodes.length} viewpoints from your description — adjust, then save`);
      return;
    }
    setAuthorNodes([]);
    setAuthorMode(mode);
  };
  const addViewpoint = () => {
    const node = samplerRef.current?.();
    if (node) setAuthorNodes((n) => [...n, node]);
  };
  const moveNode = (i: number, d: number) => setAuthorNodes((n) => {
    const j = i + d; if (j < 0 || j >= n.length) return n;
    const next = [...n]; const a = next[i]; const b = next[j];
    if (a && b) { next[i] = b; next[j] = a; }
    return next;
  });
  const onStoragePreferenceSubmit = async (mode: StorageMode, customText?: string) => {
    if (!scene) return;
    const path: CustomCameraPath = { id: crypto.randomUUID(), name: pathName, mode: authorText ? "text" : authorMode ?? "capture", nodes: authorNodes, description: authorText };
    try {
      const saved = await persistCustomPath(mode, path, layoutKey, customText);
      toast.success(mode === "layout" ? "Path saved with this layout" : mode === "account" ? "Path saved to your library" : "Path saved in this browser");
      setStorageOpen(false); setAuthorMode(null); setAuthorNodes([]);
      await loadCustomPaths();
      if (mode !== "account") setActiveCustomId(saved.id);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save path"); }
  };
  const authorPreview = useMemo(() => (scene && authorNodes.length > 1 ? buildCustomCinematicPath(scene, authorNodes) : null), [scene, authorNodes]);
  const authorConflicts = useMemo(() => (scene ? checkPathClearance(scene, authorPreview) : []), [scene, authorPreview]);
  const activeConflicts = useMemo(() => (scene && activeCustom ? checkPathClearance(scene, customCinematic) : []), [scene, activeCustom, customCinematic]);
  useEffect(() => {
    if (activeCustom && activeConflicts.length) toast.warning(`"${activeCustom.name}" may pass through ${activeConflicts.length === 1 ? activeConflicts[0]?.label : `${activeConflicts.length} objects`}`);
  }, [activeCustom, activeConflicts]);
  useEffect(() => { setWalking(false); setWalkActive(false); setWalkTime(0); }, [scene]);
  useEffect(() => {
    if (!cinematic) { setWalking(false); setWalkActive(false); setWalkTime(0); }
  }, [cinematic]);
  const seekWalk = useCallback((time: number, restart = false) => {
    setWalkTime(time);
    setWalkSeek((s) => ({ id: s.id + 1, time, restart }));
  }, []);
  const startWalk = () => {
    setSelectedId(null);
    seekWalk(0, true);
    setWalkActive(true);
    setWalking(true);
  };
  const stopWalk = () => { setWalking(false); setWalkActive(false); setWalkTime(0); };
  const restartWalk = useCallback(() => { seekWalk(0, true); setWalking(true); }, [seekWalk]);
  const toggleWalk = useCallback(() => {
    if (!walking && walkTime >= walkDuration - 0.1) seekWalk(0, true);
    setWalking((w) => !w);
  }, [walking, walkTime, walkDuration, seekWalk]);
  const finishWalk = useCallback(() => {
    if (walkLoop) restartWalk();
    else setWalking(false);
  }, [walkLoop, restartWalk]);
  useEffect(() => {
    if (!walkActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const action = walkthroughShortcut(event);
      if (!action) return;
      event.preventDefault();
      if (action === "toggle") toggleWalk();
      else if (action === "restart") restartWalk();
      else setWalkSpeed((speed) => steppedPlaybackSpeed(speed, action === "faster" ? 1 : -1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [walkActive, toggleWalk, restartWalk]);
  const exportVideo = async () => {
    if (!scene || !cinematic) return;
    setExporting(true);
    try {
      const r = await exportSceneToVideoAPI(scene, cinematic, briefText);
      if (r.status === "dry-run") {
        console.info("[video export] dry run payload", r.payload);
        toast.success(`Render payload ready (${r.payload.camera.path.length} camera points) — webhook not bound yet`);
      } else toast.success("Render requested");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Render request failed");
    } finally { setExporting(false); }
  };

  const fin = scene?.financialSummary;
  const pct = fin ? Math.min(100, (fin.allocatedSpend / fin.totalBudget) * 100) : 0;
  const dim = (k: keyof LayoutBrief["roomDimensions"], v: string) =>
    setBrief((b) => ({ ...b, roomDimensions: { ...b.roomDimensions, [k]: Math.max(3, Math.min(20, Number(v) || 0)) } }));

  return (
    <div className="mx-auto grid max-w-[1500px] gap-6 px-6 py-8 lg:grid-cols-[340px_1fr] xl:grid-cols-[340px_1fr_320px]">
      <Helmet>
        <title>AI Layout Studio | Maison Affluency Trade</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <aside className="space-y-6 border border-border bg-card p-6">
        <div>
          <p className={micro}>AI Ingestion</p>
          <h1 className="mt-1 font-serif text-2xl">Curated Room Layout</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {catLoading ? "Loading live catalogue prices…" : catError ? `Prices unavailable: ${catError}` : `Live RRPs · ${catalogue.filter((c) => c.available).length} of ${catalogue.length} pieces available`}
          </p>
          <Button variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs" onClick={() => void loadCatalogue()} disabled={catLoading}>
            <RefreshCw className={`mr-1 h-3 w-3 ${catLoading ? "animate-spin" : ""}`} /> Refresh prices
          </Button>
        </div>

        <section className="space-y-3">
          <p className={micro}>Brief criteria</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Room</Label>
              <Select value={brief.roomType} onValueChange={(v) => setBrief((b) => ({ ...b, roomType: v as LayoutBrief["roomType"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="living">Living</SelectItem>
                  <SelectItem value="lounge">Lounge</SelectItem>
                  <SelectItem value="salon">Salon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Style</Label>
              <Select value={brief.style} onValueChange={(v) => setBrief((b) => ({ ...b, style: v as LayoutBrief["style"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quiet-luxury">Quiet luxury</SelectItem>
                  <SelectItem value="sculptural">Sculptural</SelectItem>
                  <SelectItem value="warm-minimal">Warm minimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Total budget (EUR)</Label>
            <Input type="number" min={5000} step={1000} value={brief.totalBudget}
              onChange={(e) => setBrief((b) => ({ ...b, totalBudget: Math.max(0, Number(e.target.value) || 0) }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["width", "length", "height"] as const).map((k) => (
              <div key={k}>
                <Label className="text-xs capitalize">{k} (m)</Label>
                <Input type="number" step={0.1} value={brief.roomDimensions[k]} onChange={(e) => dim(k, e.target.value)} />
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={generate} disabled={loading || catLoading || !!catError}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate Room Layout
          </Button>
        </section>

        <section className="space-y-2">
          <p className={micro}>Budget status</p>
          <Progress value={pct} />
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-muted-foreground">Budget</dt><dd>{eur(fin?.totalBudget ?? brief.totalBudget)}</dd></div>
            <div><dt className="text-muted-foreground">Allocated</dt><dd>{eur(fin?.allocatedSpend ?? 0)}</dd></div>
            <div><dt className="text-muted-foreground">Buffer</dt><dd className={fin && fin.remainingBuffer < 0 ? "text-destructive" : ""}>{eur(fin?.remainingBuffer ?? brief.totalBudget)}</dd></div>
          </dl>
        </section>

        {scene && (
          <section className="space-y-2">
            <p className={micro}>Save &amp; share</p>
            <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Layout title" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => save()} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}{current ? "Save changes" : "Save layout"}
              </Button>
              {current && <Button size="sm" variant="ghost" onClick={() => save(true)} disabled={saving}>Save as new</Button>}
            </div>
            {current && (
              <div className="space-y-2 border border-border p-3">
                <label className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Read-only client link</span>
                  <Switch checked={current.is_shared} onCheckedChange={toggleShare} aria-label="Share with client" />
                </label>
                {current.is_shared && (
                  <div className="flex items-center gap-2">
                    <Input readOnly value={shareUrl(current.share_token)} className="h-8 text-xs" />
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Copy link"
                      onClick={() => navigator.clipboard?.writeText(shareUrl(current.share_token)).then(() => toast.success("Link copied"))}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {saved.length > 0 && (
          <section className="space-y-1">
            <p className={micro}>Saved layouts ({saved.length})</p>
            <ul className="divide-y divide-border text-xs">
              {saved.map((l) => (
                <li key={l.id} className="flex items-center gap-2 py-1.5">
                  <button className="flex-1 truncate text-left hover:underline" onClick={() => openSaved(l)}>
                    {l.title}{current?.id === l.id ? " ·" : ""}
                  </button>
                  {l.is_shared && <Link2 className="h-3 w-3 text-muted-foreground" aria-label="Shared" />}
                  <button aria-label="Delete layout" onClick={() => removeSaved(l)} className="text-muted-foreground hover:text-foreground"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {scene && (
          <section className="space-y-1">
            <p className={micro}>Curated pieces ({scene.curatedAssets.length})</p>
            <ul className="divide-y divide-border text-xs">
              {scene.curatedAssets.map((a, i) => {
                const item = byId.get(a.componentId);
                const options = catalogue.filter((c) => c.role === item?.role && c.available && c.price != null);
                return (
                  <li key={`${a.componentId}-${i}`} className="py-2">
                    <div className="flex items-center gap-2">
                      <Select value={a.componentId} onValueChange={(v) => swapAsset(i, v)}>
                        <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder={a.sku} /></SelectTrigger>
                        <SelectContent>
                          {options.map((c) => (
                            <SelectItem key={c.componentId} value={c.componentId} className="text-xs">{c.name} · {eur(c.price ?? 0)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="w-20 text-right">{item?.price != null ? eur(a.priceAtCuration) : "Price upon Request"}</span>
                      <button aria-label="Remove piece" onClick={() => removeAsset(i)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                    </div>
                    <p className={`mt-0.5 ${item && !item.available ? "text-destructive" : "text-muted-foreground"}`}>
                      {!item ? "Not in live catalogue" : !item.available ? "No longer available" : item.leadWeeks ? `${stockLabel(item.stockStatus)} · ${item.leadWeeks[0]}–${item.leadWeeks[1]} weeks` : stockLabel(item.stockStatus)}
                    </p>
                  </li>
                );
              })}
            </ul>
            {skipped.length > 0 && <p className="pt-1 text-xs text-muted-foreground">Skipped: {skipped.join(", ")}</p>}
          </section>
        )}
      </aside>

      <div className="relative h-[70vh] min-h-[520px] border border-border bg-muted/30">
        {scene && (
          <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap justify-end gap-2">
            <Select value={activeCustomId ? `custom:${activeCustomId}` : walkPreset} onValueChange={(value) => {
              if (value.startsWith("custom:")) { setActiveCustomId(value.slice(7)); return; }
              const preset = CINEMATIC_PRESETS.find((p) => p.value === value);
              if (preset) { setActiveCustomId(null); setWalkPreset(preset.value); }
            }}>
              <SelectTrigger aria-label="Camera path preset" className="h-9 w-[200px] bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CINEMATIC_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                {customPaths.map((p) => <SelectItem key={`${p.source}-${p.id}`} value={`custom:${p.id}`}>{p.name} · {p.source === "layout" ? "layout" : p.source === "account" ? "library" : "browser"}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="secondary" onClick={() => setBuilderOpen(true)} disabled={walkActive || !!authorMode}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Custom path
            </Button>
            <Button size="sm" variant="secondary" onClick={walkActive ? stopWalk : startWalk} disabled={!cinematic || !!authorMode}>
              <Film className="mr-1.5 h-3.5 w-3.5" />{walkActive ? "Stop walkthrough" : "Preview Walkthrough Animation"}
            </Button>
            <Button size="sm" variant="secondary" onClick={exportVideo} disabled={!cinematic || exporting}>
              {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="mr-1.5 h-3.5 w-3.5" />}Export for video render
            </Button>
            {(pathSyncStatus.lastSyncAt || pathSyncStatus.pendingRetry.length > 0) && (
              <div className="w-full space-y-1">
                <p role="status" aria-label="Camera path sync status" className="flex w-full items-center justify-end gap-2 text-[11px] text-muted-foreground">
                  {pathSyncStatus.pendingRetry.length > 0 ? (
                    <>
                      <span className="text-amber-600">{pathSyncStatus.pendingRetry.length} path{pathSyncStatus.pendingRetry.length > 1 ? "s" : ""} still need{pathSyncStatus.pendingRetry.length > 1 ? "" : "s"} syncing ({pathSyncStatus.pendingRetry.join(", ")})</span>
                      <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => void loadCustomPaths()}>Retry now</button>
                    </>
                  ) : (
                    <span>Camera paths synced {pathSyncStatus.lastSyncAt ? syncTimeAgo(pathSyncStatus.lastSyncAt) : ""}{pathSyncStatus.lastMoved > 0 ? ` · ${pathSyncStatus.lastMoved} uploaded` : ""}</span>
                  )}
                  {pathSyncHistory.length > 0 && (
                    <button type="button" aria-expanded={syncHistoryOpen} aria-label="Camera path sync history"
                      className="underline underline-offset-2 hover:text-foreground"
                      onClick={() => setSyncHistoryOpen((v) => !v)}>
                      {syncHistoryOpen ? "Hide history" : "History"}
                    </button>
                  )}
                </p>
                {syncHistoryOpen && pathSyncHistory.length > 0 && (
                  <ul aria-label="Recent camera path syncs" className="ml-auto w-fit space-y-0.5 text-right text-[11px] text-muted-foreground">
                    {pathSyncHistory.map((e) => (
                      <li key={e.at}>
                        {syncTimeAgo(e.at)} — {e.failed.length > 0
                          ? <span className="text-amber-600">{e.moved} synced, {e.failed.length} failed ({e.failed.join(", ")})</span>
                          : <span>{e.moved > 0 ? `${e.moved} path${e.moved > 1 ? "s" : ""} synced` : "Up to date"}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        {!scene && !loading && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Set a brief and generate a layout.</div>
        )}
        {scene && (
          <Canvas shadows dpr={[1, 1.5]} onPointerMissed={() => setSelectedId(null)}>
            {authorMode === "draw"
              ? <FloorPlanDrawLayer width={scene.roomDimensions.width} length={scene.roomDimensions.length}
                  onPick={(x, z) => setAuthorNodes((n) => [...n, { position: [x, drawHeight, z], target: clusterCentre(scene) }])} />
              : <PerspectiveCamera makeDefault fov={45} near={0.05} position={[scene.roomDimensions.width * 1.3, scene.roomDimensions.height * 2.2, scene.roomDimensions.length * 1.6]} />}
            <OrbitControls makeDefault enabled={!dragging && !walkActive} enableRotate={authorMode !== "draw"} maxPolarAngle={Math.PI / 2.05} target={[0, 0.5, 0]} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1.1} castShadow />
            <Suspense fallback={null}><Environment preset="apartment" /></Suspense>
            <ContactShadows position={[0, 0.002, 0]} scale={20} opacity={0.3} blur={1.2} far={8} />
            <AICuratedEnvironment schema={scene} selectedId={selectedId} onSelect={setSelectedId}
              onAssetTransform={onAssetTransform} onDragStateChange={setDragging} isEditable={!walkActive && !authorMode} />
            <CinematicCameraRig path={cinematic} enabled={walkActive} playing={walking} speed={walkSpeed}
              seek={walkSeek} onTimeChange={setWalkTime} onDone={finishWalk} />
            <CameraSamplerBridge samplerRef={samplerRef} />
            {authorMode && <PathNodesGuide nodes={authorNodes} />}
          </Canvas>
        )}
        {authorMode && scene && (
          <div role="group" aria-label="Custom path builder" className="absolute bottom-3 left-3 z-10 w-[300px] space-y-3 border border-border bg-background/95 p-3 text-xs shadow-sm">
            <p className={micro}>{authorMode === "draw" ? "Draw on floor plan" : "Capture viewpoints"}</p>
            <p className="text-muted-foreground">{authorMode === "draw" ? "Click the floor to drop points. Each new point uses the height below." : "Frame the view, then add it. The camera glides through points in order."}</p>
            <Input aria-label="Path name" value={pathName} maxLength={120} onChange={(e) => setPathName(e.target.value)} className="h-8 text-xs" />
            {authorMode === "draw" && (
              <Label className="flex items-center gap-2">Height (m)
                <Input type="number" step={0.1} min={0.5} max={scene.roomDimensions.height - 0.2} value={drawHeight} className="h-8 w-20 text-xs"
                  onChange={(e) => setDrawHeight(Math.max(0.5, Math.min(scene.roomDimensions.height - 0.2, Number(e.target.value) || 1.8)))} />
              </Label>
            )}
            {authorMode === "capture" && <Button size="sm" className="w-full" onClick={addViewpoint}><Camera className="mr-1.5 h-3.5 w-3.5" />Add Viewpoint</Button>}
            <ol className="max-h-40 space-y-1 overflow-auto">
              {authorNodes.map((n, i) => (
                <li key={i} className="flex items-center gap-1">
                  <span className="w-5 tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 tabular-nums">{n.position.map((v) => v.toFixed(1)).join(", ")}</span>
                  {authorMode === "draw" && <Input aria-label={`Point ${i + 1} height`} type="number" step={0.1} value={n.position[1]} className="h-6 w-14 px-1 text-xs"
                    onChange={(e) => { const y = Math.max(0.5, Math.min(scene.roomDimensions.height - 0.2, Number(e.target.value) || 1.8)); setAuthorNodes((all) => all.map((m, j) => j === i ? { ...m, position: [m.position[0], y, m.position[2]] } : m)); }} />}
                  <Button size="icon" variant="ghost" className="h-6 w-6" aria-label={`Move point ${i + 1} up`} onClick={() => moveNode(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" aria-label={`Move point ${i + 1} down`} onClick={() => moveNode(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" aria-label={`Delete point ${i + 1}`} onClick={() => setAuthorNodes((all) => all.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                </li>
              ))}
            </ol>
            <p className="text-muted-foreground">{authorNodes.length < 2 ? "Add at least 2 points." : authorPreview ? `${authorNodes.length} points · ${Math.round(authorPreview.durationSec)}s` : "Points too close together."}</p>
            {authorPreview && (authorConflicts.length ? <>
              <ClearanceWarning conflicts={authorConflicts} />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                  const r = autoRaiseFlaggedNodes(scene, authorNodes);
                  setAuthorNodes(r.nodes);
                  if (r.conflicts.length) toast.warning(`Raised to the ceiling limit — ${r.conflicts.length} spot${r.conflicts.length > 1 ? "s" : ""} still flagged; try shifting them sideways`);
                  else toast.success("Flagged viewpoints raised — path is now clear");
                }}>Raise flagged viewpoints</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                  const r = autoShiftFlaggedNodes(scene, authorNodes);
                  setAuthorNodes(r.nodes);
                  if (r.conflicts.length) toast.warning(`Shifted as far as the room allows — ${r.conflicts.length} spot${r.conflicts.length > 1 ? "s" : ""} still flagged; move those points by hand`);
                  else toast.success("Flagged viewpoints shifted sideways — path is now clear");
                }}>Shift sideways</Button>
              </div>
            </> : <p className="text-muted-foreground">✓ Clear of furniture and room openings</p>)}
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setAuthorMode(null); setAuthorNodes([]); }}>Cancel</Button>
              <Button size="sm" className="ml-auto" disabled={!authorPreview} onClick={() => setStorageOpen(true)}><Save className="mr-1.5 h-3.5 w-3.5" />Save path</Button>
            </div>
          </div>
        )}
        <CustomPathBuilderModal open={builderOpen} onOpenChange={setBuilderOpen} onPathModeSelect={onPathModeSelect} />
        <PathStoragePreferencesModal open={storageOpen} onOpenChange={setStorageOpen} layoutSaved={!!current?.id}
          onBack={() => setStorageOpen(false)} onStoragePreferenceSubmit={(m, t) => void onStoragePreferenceSubmit(m, t)} />
        {walkActive && cinematic && (
          <div role="group" aria-label="Walkthrough playback controls" className="absolute inset-x-3 bottom-3 z-10 space-y-3 border border-border bg-background/95 p-3 shadow-sm">
            {activeCustom && activeConflicts.length > 0 && <ClearanceWarning conflicts={activeConflicts} />}
            <Slider thumbLabel="Walkthrough timeline" min={0} max={walkDuration} step={0.1} value={[walkTime]}
              onValueChange={([time]) => { if (time !== undefined) { setWalking(false); seekWalk(time); } }} />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="icon" variant="ghost" aria-label={walking ? "Pause walkthrough" : "Resume walkthrough"}
                aria-keyshortcuts="Space" title={walking ? "Pause walkthrough (Space)" : "Resume walkthrough (Space)"}
                onClick={toggleWalk}>
                {walking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" aria-label="Restart walkthrough" aria-keyshortcuts="R" title="Restart walkthrough (R)" onClick={restartWalk}><RotateCcw className="h-4 w-4" /></Button>
              <Button size="icon" variant={walkLoop ? "secondary" : "ghost"} aria-label="Loop walkthrough" aria-pressed={walkLoop} title="Continuous replay" onClick={() => setWalkLoop((loop) => !loop)}><Repeat className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Stop walkthrough" title="Stop walkthrough" onClick={stopWalk}><Square className="h-3.5 w-3.5" /></Button>
              <output aria-label="Walkthrough time" className="text-xs tabular-nums text-muted-foreground">{playbackTimeLabel(walkTime)} / {playbackTimeLabel(walkDuration)}</output>
              <Select value={String(walkSpeed)} onValueChange={(value) => setWalkSpeed(Number(value))}>
                <SelectTrigger aria-label="Playback speed" title="Playback speed (− / + or [ / ])" className="ml-auto h-8 w-[88px]"><SelectValue /></SelectTrigger>
                <SelectContent>{WALKTHROUGH_SPEEDS.map((speed) => <SelectItem key={speed} value={String(speed)}>{speed}×</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-5 border border-border bg-card p-6" aria-label="Curation Breakdown">
        <div>
          <p className={micro}>Curation matrix</p>
          <h2 className="mt-1 font-serif text-xl">Curation Breakdown</h2>
        </div>
        <div className="space-y-2">
          <Textarea value={briefText} onChange={(e) => setBriefText(e.target.value)} rows={3} maxLength={2000}
            className="resize-none text-xs" placeholder="e.g. Warm minimalism, neutral tones, budget €50,000" />
          <Button className="w-full" variant="outline" onClick={runCuration} disabled={catLoading || !!catError || !briefText.trim()}>
            <Sparkles className="mr-2 h-4 w-4" /> Curate from brief
          </Button>
        </div>
        {curation && (() => {
          const util = curation.utilisation * 100;
          return (
            <>
              <div className="flex flex-wrap gap-1">
                {(curation.parsed.styleTokens.length ? curation.parsed.styleTokens : ["No style detected"]).map((t) => (
                  <span key={t} className="border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{t}</span>
                ))}
              </div>
              <ul className="divide-y divide-border text-xs">
                {curation.selected.map((r, i) => (
                  <li key={`${r.item.componentId}-${i}`} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.item.name}</p>
                      <p className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{r.item.sku} · {r.role} · {Math.round(r.score * 100)}% match</p>
                    </div>
                    <span className="shrink-0 tabular-nums">{eur(r.item.price ?? 0)}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-baseline justify-between">
                  <span className={micro}>Allocation</span>
                  <span className="font-serif text-lg tabular-nums">{eur(curation.total)}</span>
                </div>
                <Progress value={Math.min(100, util)} />
                <p className="text-xs text-muted-foreground">
                  {util.toFixed(1)}% of the {eur(curation.budget)} threshold · {eur(curation.budget - curation.total)} remaining
                </p>
                {curation.unmet.length > 0 && <p className="text-xs text-destructive">No eligible piece for: {curation.unmet.join(", ")}</p>}
                {curation.parsed.budget == null && <p className="text-xs text-muted-foreground">No budget in brief — using the panel budget.</p>}
              </div>
            </>
          );
        })()}
      </aside>
    </div>
  );
};

export default TradeAILayoutStudio;
