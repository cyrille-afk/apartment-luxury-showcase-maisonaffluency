import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet-async";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { ArrowDown, ArrowUp, Camera, Clapperboard, Copy, Film, Fullscreen, Link2, Loader2, Maximize2, Minimize2, Pause, Play, Plus, RefreshCw, Repeat, RotateCcw, Save, Sparkles, Square, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { CINEMATIC_PRESETS, useCinematicPath, type CinematicPreset } from "@/hooks/useCinematicPath";
import CinematicCameraRig from "@/components/trade/visualiser/CinematicCameraRig";
import { CustomPathBuilderModal, PathStoragePreferencesModal } from "@/components/trade/visualiser/CustomPathModals";
import { CameraSamplerBridge, FloorPlanDrawLayer, PathNodesGuide, type CameraSampler } from "@/components/trade/visualiser/PathAuthoringTools";
import { buildCustomCinematicPath, checkPathClearance, type ClearanceConflict, clusterCentre, listAccountPaths, listLayoutPaths, nodesFromDescription, persistCustomPath, readLocalPaths, readPathSyncStatus, readPathSyncHistory, type PathSyncHistoryEntry, type CustomCameraPath, type CustomPathNode, type PathMode, type PathSyncStatus, type StorageMode, syncLocalPathsToAccount, autoRaiseFlaggedNodes, autoShiftFlaggedNodes, type ShiftDirection } from "@/lib/customCameraPaths";
import { CINEMATIC_ENTRY_SECONDS, playbackTimeLabel, readCustomPathPreference, readWalkthroughPreferences, saveCustomPathPreference, saveWalkthroughPreferences, steppedPlaybackSpeed, WALKTHROUGH_SPEEDS, walkthroughShortcut } from "@/lib/cinematicPlayback";
import { fetchRemoteWalkthroughPreferences, pushRemoteWalkthroughPreferences } from "@/lib/walkthroughPreferenceSync";
import { Slider } from "@/components/ui/slider";
import { buildSceneVideoPayload } from "@/lib/sceneVideoExport";
import VideoUnlockModal from "@/components/trade/visualiser/VideoUnlockModal";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { deleteLayout, listLayouts, saveLayout, setShared, shareUrl, snapshotProducts, type SavedLayout } from "@/lib/aiLayoutStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AICuratedEnvironment from "@/components/trade/visualiser/AICuratedEnvironment";
import { fetchLiveCatalogue, repriceScene, summarise, toAsset, type LayoutBrief, type LiveCatalogueItem } from "@/lib/mockAiLayoutService";
import type { AICuratedSceneSchema, Vec3 } from "@/types/aiCuratedScene";
import { Textarea } from "@/components/ui/textarea";
import { curate, sceneFromCuration, type CurationResult } from "@/lib/curationEngine";
import { cn } from "@/lib/utils";
import { generateRoomLayoutMatrix } from "@/lib/roomLayoutMatrix";
import { useAiLayoutForm } from "@/hooks/useAiLayoutForm";
import { anchorsForPrompt, buildArchitectCatalog, validateArchitectLayout, type ArchitectOutput } from "@/lib/aiArchitectLayout";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { supabase } from "@/integrations/supabase/client";
import RoomOverviewCamera from "@/components/trade/visualiser/RoomOverviewCamera";
import RoomCameraPresets from "@/components/trade/visualiser/RoomCameraPresets";
import SelectedPieceDetails from "@/components/trade/visualiser/SelectedPieceDetails";
import LayoutPieceCompare from "@/components/trade/visualiser/LayoutPieceCompare";
import { buildFurnishingSchedulePdf, downloadBlob } from "@/lib/furnishingSchedulePdf";
import ClientSchedulePreview from "@/components/trade/visualiser/ClientSchedulePreview";

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
  const { brief, setBrief, setDimension } = useAiLayoutForm();
  const [scene, setScene] = useState<AICuratedSceneSchema | null>(null);
  const [overviewRevision, setOverviewRevision] = useState(0);
  const [cameraView, setCameraView] = useState("overview");
  useEffect(() => { setCameraView("overview"); }, [overviewRevision]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [clientPreviewRows, setClientPreviewRows] = useState<import("@/lib/furnishingSchedulePdf").ScheduleRow[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [catalogue, setCatalogue] = useState<LiveCatalogueItem[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const { discountPct } = useTradePriceMode();
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
    setCompareIds([]);
    setCompareOpen(false);
    setSkipped([]);
    setScene(catalogue.length ? repriceScene(l.scene, catalogue) : l.scene);
    setOverviewRevision((r) => r + 1);
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
  const selectedAsset = scene?.curatedAssets.find((a, i) => `ai-${i}-${a.sku}` === selectedId);
  const selectedPiece = selectedAsset ? byId.get(selectedAsset.componentId) : undefined;

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
    setCompareIds([]);
    setCompareOpen(false);
    setCurrent(null);
    try {
      const live = (await loadCatalogue()) ?? catalogue;
      const { scene: next, skipped: miss } = generateRoomLayoutMatrix(brief, live);
      setScene(next);
      setOverviewRevision((r) => r + 1);
      setSkipped(miss);
    } finally {
      setLoading(false);
    }
  };

  // AI architect: the model proposes, validateArchitectLayout decides. Any rule break → deterministic layout.
  const generateWithAI = async () => {
    setAiLoading(true);
    setSelectedId(null); setCompareIds([]); setCompareOpen(false); setCurrent(null);
    try {
      const live = (await loadCatalogue()) ?? catalogue;
      const fallback = generateRoomLayoutMatrix(brief, live);
      const anchors = fallback.scene.architecturalAnchors;
      const { width: W, length: L, height: H } = brief.roomDimensions;
      const rows = buildArchitectCatalog(live, discountPct);
      const { data, error } = await supabase.functions.invoke("ai-architect-layout", {
        body: {
          room_dimensions: { width_m: W, length_m: L, height_m: H },
          architectural_anchors: anchorsForPrompt(anchors, W, L),
          client_brief: { room_type: brief.roomType, design_aesthetic: brief.style, budget_eur: brief.totalBudget },
          // POR / unavailable pieces never reach the model; validation still uses the full rows.
          available_catalog: rows.filter((r) => typeof r.trade_cost === "number" && r.trade_cost > 0),
        },
      });
      const out = (data as { layout?: ArchitectOutput } | null)?.layout;
      const result = out ? validateArchitectLayout(out, brief, live, rows, anchors) : null;
      if (result?.ok && result.scene) {
        setScene(result.scene);
        setSkipped([`AI layout · trade spend €${result.tradeSpend.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of €${brief.totalBudget.toLocaleString("en-GB")}`]);
        toast.success("AI layout placed and checked");
      } else {
        setScene(fallback.scene);
        setSkipped(result ? result.errors.map((e) => `AI rejected: ${e}`) : [error?.message ?? "AI unavailable"]);
        toast.warning("AI layout broke a room rule — showing the standard layout instead");
      }
      setOverviewRevision((r) => r + 1);
    } finally {
      setAiLoading(false);
    }
  };

  const runCuration = () => {
    const result = curate(briefText, catalogue, brief.totalBudget);
    setCuration(result);
    setSelectedId(null);
    setCompareIds([]);
    setCompareOpen(false);
    setCurrent(null);
    setSkipped(result.matrix.filter((r) => !r.eligible).map((r) => `${r.item.name} (${r.reason})`));
    if (result.parsed.budget) setBrief((b) => ({ ...b, totalBudget: result.budget }));
    setScene(sceneFromCuration(result, brief));
    setOverviewRevision((r) => r + 1);
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
    // Instance ids are index-based, so removing a piece invalidates the compare selection.
    setCompareIds([]);
    setCompareOpen(false);
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
  const [syncHistoryFilter, setSyncHistoryFilter] = useState<"all" | "failed" | "ok">("all");
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
  type VideoStatus = { tier: string; isAdmin: boolean; balance: number; goldIncludedLeft: number; unlimited: boolean; allowed: boolean };
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const refreshVideoStatus = useCallback(async () => {
    const { data } = await supabase.functions.invoke("video-generate", { body: { mode: "status" } });
    if (data && typeof data.allowed === "boolean") setVideoStatus(data as VideoStatus);
  }, []);
  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get("video_pass");
    (async () => {
      if (sid) {
        const { data } = await supabase.functions.invoke("video-pass-checkout", { body: { mode: "verify", session_id: sid } });
        if (data?.granted) toast.success("Video Pass added — 1 credit ready");
        window.history.replaceState(null, "", window.location.pathname);
      }
      await refreshVideoStatus();
    })();
  }, [refreshVideoStatus]);
  const videoLocked = !!videoStatus && !videoStatus.allowed;
  const [videoJob, setVideoJob] = useState<{ id: string; token?: string; state: string; url?: string; failure?: string } | null>(null);
  const [videoWide, setVideoWide] = useState(false);
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const enterVideoFullscreen = async () => {
    const container = videoContainerRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    try {
      if (container?.requestFullscreen && document.fullscreenEnabled) {
        await container.requestFullscreen();
      } else if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      } else {
        toast.error("Fullscreen is unavailable in this browser. Open the page in a separate tab to try again.");
      }
    } catch {
      toast.error("Fullscreen was blocked. Open the page in a separate tab to try again.");
    }
  };
  const exitVideoFullscreen = async () => {
    if (document.fullscreenElement !== videoContainerRef.current) return;
    try { await document.exitFullscreen(); }
    catch { toast.error("Could not exit fullscreen. Press Escape to return to the page."); }
  };
  useEffect(() => {
    const onFullscreenChange = () => setVideoFullscreen(!!document.fullscreenElement && document.fullscreenElement === videoContainerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);
  const resumeRef = useRef<{ t: number; playing: boolean } | null>(null);
  const swapVideoSize = () => {
    const v = videoRef.current;
    if (v) resumeRef.current = { t: v.currentTime, playing: !v.paused };
    setVideoWide((w) => !w);
  };
  const restoreVideoPosition = (el: HTMLVideoElement) => {
    const r = resumeRef.current;
    if (!r) return;
    resumeRef.current = null;
    el.currentTime = r.t;
    if (r.playing) void el.play().catch(() => { /* autoplay blocked — user can press play */ });
  };
  useEffect(() => {
    if (!videoWide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) swapVideoSize();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videoWide]);
  type VideoHistoryItem = { job_id: string; state: string; video_url: string | null; failure: string | null; created_at: string; quality?: string | null };
  const [videoHistory, setVideoHistory] = useState<VideoHistoryItem[]>([]);
  const [videoCompareIds, setVideoCompareIds] = useState<string[]>([]);
  const toggleVideoCompare = (jobId: string) =>
    setVideoCompareIds((ids) => ids.includes(jobId) ? ids.filter((i) => i !== jobId) : ids.length >= 2 ? [ids[1], jobId] : [...ids, jobId]);
  const compareItems = videoCompareIds.map((id) => videoHistory.find((h) => h.job_id === id)).filter((h): h is VideoHistoryItem => !!h?.video_url);
  // Synchronized side-by-side playback: play/pause/seek/rate on either video mirrors to the other.
  const compareVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const compareWrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const compareSyncing = useRef(false);
  // Per-video mute state for the side-by-side comparison (independent of sync).
  const [compareMuted, setCompareMuted] = useState<boolean[]>([true, true]);
  const toggleCompareMute = (i: number) => {
    const v = compareVideoRefs.current[i];
    const next = !compareMuted[i];
    if (v) v.muted = next;
    setCompareMuted((m) => m.map((x, j) => (j === i ? next : x)));
  };
  const toggleCompareFullscreen = (i: number) => {
    const el = compareWrapRefs.current[i];
    if (!el) return;
    if (document.fullscreenElement === el) void document.exitFullscreen().catch(() => {});
    else void el.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    if (compareItems.length !== 2) return;
    const vids = compareVideoRefs.current.filter((v): v is HTMLVideoElement => !!v);
    if (vids.length !== 2) return;
    const cleanups: (() => void)[] = [];
    vids.forEach((src, i) => {
      const dst = vids[1 - i];
      const mirror = (fn: () => void) => {
        if (compareSyncing.current) return;
        compareSyncing.current = true;
        try { fn(); } finally { compareSyncing.current = false; }
      };
      const onPlay = () => mirror(() => { if (Math.abs(dst.currentTime - src.currentTime) > 0.15) dst.currentTime = src.currentTime; void dst.play().catch(() => {}); });
      const onPause = () => mirror(() => dst.pause());
      const onSeeked = () => mirror(() => { dst.currentTime = src.currentTime; });
      const onRate = () => mirror(() => { dst.playbackRate = src.playbackRate; });
      // Correct drift while both are playing (one may buffer later than the other).
      const onTime = () => mirror(() => {
        if (!src.paused && !dst.paused && Math.abs(dst.currentTime - src.currentTime) > 0.3) dst.currentTime = src.currentTime;
      });
      src.addEventListener("play", onPlay);
      src.addEventListener("pause", onPause);
      src.addEventListener("seeked", onSeeked);
      src.addEventListener("ratechange", onRate);
      src.addEventListener("timeupdate", onTime);
      cleanups.push(() => {
        src.removeEventListener("play", onPlay);
        src.removeEventListener("pause", onPause);
        src.removeEventListener("seeked", onSeeked);
        src.removeEventListener("ratechange", onRate);
        src.removeEventListener("timeupdate", onTime);
      });
    });
    return () => cleanups.forEach((c) => c());
  }, [compareItems.length === 2 ? compareItems.map((h) => h.job_id).join("|") : ""]);
  const [videoQuality, setVideoQuality] = useState<"540p" | "720p" | "1080p">(() => {
    const q = localStorage.getItem("ma_video_quality");
    return q === "540p" || q === "1080p" ? q : "720p";
  });
  // Rough Luma render estimates for a 5s 16:9 walkthrough — shown as guidance only,
  // actual time/cost vary with Luma load and billing.
  const VIDEO_QUALITY_OPTIONS = [
    { value: "540p", label: "Draft · 540p", eta: "~15s", cost: "~$0.35" },
    { value: "720p", label: "HD · 720p", eta: "~25s", cost: "~$0.60" },
    { value: "1080p", label: "Full HD · 1080p", eta: "~45s", cost: "~$1.20" },
  ] as const;
  const refreshVideoHistory = useCallback(async () => {
    const { data } = await supabase.functions.invoke("video-generate", { body: { mode: "history" } });
    if (Array.isArray(data?.jobs)) setVideoHistory(data.jobs as VideoHistoryItem[]);
  }, []);
  useEffect(() => { void refreshVideoHistory(); }, [refreshVideoHistory]);
  useEffect(() => {
    if (!videoJob || videoJob.url || videoJob.failure || videoJob.id.startsWith("mock_")) return;
    let stop = false;
    const tick = async () => {
      const { data } = await supabase.functions.invoke("video-generate", { body: { mode: "poll", job_id: videoJob.id, poll_token: videoJob.token } });
      if (stop || !data) return;
      const url = (data.outputs as (string | null)[] | null)?.find(Boolean) ?? undefined;
      const failure = data.state === "failed" ? (data.failure || "Render failed") : data.error;
      setVideoJob((j) => j && j.id === videoJob.id ? { ...j, state: data.state ?? j.state, url, failure } : j);
      if (url || failure) void refreshVideoHistory();
    };
    const t = setInterval(tick, 5000); void tick();
    return () => { stop = true; clearInterval(t); };
  }, [videoJob?.id, videoJob?.url, videoJob?.failure]);
  const runVideo = async () => {
    if (!scene || !cinematic) return;
    setUnlockOpen(false);
    setExporting(true);
    try {
      const payload = buildSceneVideoPayload(scene, cinematic, briefText);
      const { data, error } = await supabase.functions.invoke("video-generate", { body: { mode: "render", payload, snapshot: captureSnapshot(), quality: videoQuality } });
      if (data?.error === "purchase_required") { await refreshVideoStatus(); setUnlockOpen(true); return; }
      if (error || data?.error) throw new Error(data?.error || error?.message);
      if (data?.mock) toast.success(`Render queued (test service, job ${data.response?.job_id ?? ""})${data.charged ? " — 1 credit used" : ""}`);
      const jid = data?.response?.job_id as string | undefined;
      if (jid) setVideoJob({ id: jid, token: data?.poll_token, state: data?.mock ? "test" : "queued" });
      if (!data?.mock) toast.success(`Render started${data?.response?.job_id ? ` (job ${data.response.job_id})` : ""}${data?.charged ? " — 1 credit used" : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Render request failed");
    } finally { setExporting(false); void refreshVideoStatus(); }
  };
  const captureSnapshot = (): string | undefined => {
    const c = document.querySelector<HTMLCanvasElement>('canvas[data-engine]:not([aria-label])') ?? document.querySelector<HTMLCanvasElement>("canvas");
    try { return c?.toDataURL("image/jpeg", 0.85); } catch { return undefined; }
  };
  const exportVideo = () => { if (videoLocked) setUnlockOpen(true); else void runVideo(); };

  const fin = scene?.financialSummary;
  const pct = fin ? Math.min(100, (fin.allocatedSpend / fin.totalBudget) * 100) : 0;
  const dim = setDimension;

  return (
    <div className="mx-auto grid max-w-[1500px] gap-6 px-6 py-8 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_320px]">
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
            {loading ? "Generating layout..." : "Generate Room Layout"}
          </Button>
          {videoStatus?.isAdmin && (
          <Button variant="outline" className="w-full" onClick={generateWithAI} disabled={aiLoading || loading || catLoading || !!catError}>
            {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {aiLoading ? "AI architect arranging..." : "Generate with AI architect"}
          </Button>
          )}
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
            <div className="flex items-center justify-between">
              <p className={micro}>Curated pieces ({scene.curatedAssets.length})</p>
              <div className="flex items-center gap-3">
                <button type="button" disabled={compareIds.length < 2} className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  onClick={() => setCompareOpen(true)}>Compare selected ({compareIds.length})</button>
                <button type="button" disabled={!scene.curatedAssets.length} className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  onClick={() => {
                    const rows = scene.curatedAssets.map((a) => {
                      const item = byId.get(a.componentId);
                      return { name: item?.name ?? a.sku, manufacturer: item?.manufacturer ?? null, dimensions: item?.dimensions ?? null, priceEur: item?.price != null ? a.priceAtCuration : null, productUrl: item?.productUrl ? `https://www.maisonaffluency.com${item.productUrl}` : null };
                    });
                    downloadBlob(buildFurnishingSchedulePdf(rows, "Curated Room Layout"), "furnishing-schedule.pdf");
                  }}>Export schedule PDF</button>
                <button type="button" disabled={!scene.curatedAssets.length} className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  onClick={() => {
                    const rows = scene.curatedAssets.map((a) => {
                      const item = byId.get(a.componentId);
                      return { name: item?.name ?? a.sku, manufacturer: item?.manufacturer ?? null, dimensions: item?.dimensions ?? null, priceEur: item?.price != null ? a.priceAtCuration : null, productUrl: item?.publicProductUrl ? `https://www.maisonaffluency.com${item.publicProductUrl}` : null };
                    });
                    setClientPreviewRows(rows);
                  }}>Preview client PDF</button>
                <ClientSchedulePreview rows={clientPreviewRows} title="Curated Room Layout" open={!!clientPreviewRows} onOpenChange={(v) => { if (!v) setClientPreviewRows(null); }} />
              </div>
            </div>
            <ul className="divide-y divide-border text-xs">
              {scene.curatedAssets.map((a, i) => {
                const item = byId.get(a.componentId);
                const options = catalogue.filter((c) => c.role === item?.role && c.available && c.price != null);
                return (
                  <li key={`${a.componentId}-${i}`} className="py-2">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" aria-label={`Compare ${item?.name ?? a.sku}`} className="h-3.5 w-3.5 shrink-0 accent-primary"
                        checked={compareIds.includes(`ai-${i}-${a.sku}`)}
                        onChange={(e) => setCompareIds((ids) => e.target.checked ? [...ids, `ai-${i}-${a.sku}`] : ids.filter((id) => id !== `ai-${i}-${a.sku}`))} />
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

      <div className="relative h-[70vh] min-h-[520px] min-w-0 border border-border bg-muted/30">
        {selectedAsset && <SelectedPieceDetails name={selectedPiece?.name ?? selectedAsset.sku} price={selectedPiece?.price ?? null} dimensions={selectedPiece?.dimensions ?? null} manufacturer={selectedPiece?.manufacturer} productUrl={selectedPiece?.productUrl} onClose={() => setSelectedId(null)} />}
        {compareOpen && scene && (
          <LayoutPieceCompare
            pieces={compareIds.flatMap((id) => {
              const idx = scene.curatedAssets.findIndex((a, i) => `ai-${i}-${a.sku}` === id);
              if (idx < 0) return [];
              const a = scene.curatedAssets[idx];
              const item = byId.get(a.componentId);
              return [{ id, name: item?.name ?? a.sku, manufacturer: item?.manufacturer ?? null, dimensions: item?.dimensions ?? null, priceEur: item?.price != null ? a.priceAtCuration : null }];
            })}
            onRemove={(id) => setCompareIds((ids) => ids.filter((x) => x !== id))}
            onClose={() => setCompareOpen(false)}
          />
        )}
        {scene && (
          <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap justify-end gap-2">
            <RoomCameraPresets value={cameraView} onChange={setCameraView} disabled={walkActive || !!authorMode || dragging}
              pieces={scene.curatedAssets.map((a, i) => ({ id: `ai-${i}-${a.sku}`, name: byId.get(a.componentId)?.name ?? a.sku }))} />
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
            <Select value={videoQuality} onValueChange={(v) => { const q = v === "540p" || v === "1080p" ? v : "720p"; setVideoQuality(q); localStorage.setItem("ma_video_quality", q); }}>
              <SelectTrigger aria-label="Video quality" className="h-9 w-[190px] bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VIDEO_QUALITY_OPTIONS.map((q) => (
                  <SelectItem key={q.value} value={q.value}>
                    <span className="flex w-full items-center justify-between gap-3">
                      <span>{q.label}</span>
                      <span className="text-[10px] text-muted-foreground">est. {q.eta} · {q.cost}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="secondary" onClick={exportVideo} disabled={!cinematic || exporting}>
              {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : videoLocked ? <Lock className="mr-1.5 h-3.5 w-3.5" /> : <Clapperboard className="mr-1.5 h-3.5 w-3.5" />}Generate Walkthrough Video
              {videoStatus?.unlimited && <span className="ml-2 border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em]">Cinematic HD Render</span>}
              {videoStatus && !videoStatus.unlimited && videoStatus.allowed && <span className="ml-2 text-[10px] text-muted-foreground">{videoStatus.goldIncludedLeft > 0 ? "1 included this month" : `${videoStatus.balance} credit${videoStatus.balance === 1 ? "" : "s"}`}</span>}
            </Button>
            <VideoUnlockModal open={unlockOpen} onOpenChange={setUnlockOpen} balance={videoStatus?.balance ?? 0} onUseCredit={() => void runVideo()} />
            {videoJob && (() => {
              const wide = videoWide && !!videoJob.url;
              const inner = (
                <>
                  {videoJob.url && (
                    <div className="flex w-full flex-wrap items-center justify-end gap-2">
                      {!videoFullscreen && <Button size="sm" variant="outline" aria-pressed={wide} onClick={swapVideoSize}>
                        {wide ? <Minimize2 className="mr-1.5 h-3.5 w-3.5" /> : <Maximize2 className="mr-1.5 h-3.5 w-3.5" />}
                        {wide ? "Return to panel size" : "Expand to full width"}
                      </Button>}
                      <Button size="sm" variant="outline" aria-pressed={videoFullscreen} onClick={() => void (videoFullscreen ? exitVideoFullscreen() : enterVideoFullscreen())}>
                        {videoFullscreen ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Fullscreen className="mr-1.5 h-3.5 w-3.5" />}
                        {videoFullscreen ? "Return to page" : "Enter fullscreen"}
                      </Button>
                    </div>
                  )}
                  {videoJob.url ? (
                    <>
                      <video ref={videoRef} src={videoJob.url} controls playsInline
                        onLoadedMetadata={(e) => restoreVideoPosition(e.currentTarget)}
                        className={videoFullscreen ? "min-h-0 w-full flex-1 object-contain" : wide ? "h-auto max-h-[80vh] w-full bg-background" : "h-auto w-full"} />
                      <a href={videoJob.url} target="_blank" rel="noreferrer" className="mt-2 inline-block underline">Download video</a>
                    </>
                  ) : videoJob.failure ? (
                    <p className="text-destructive">Render failed: {videoJob.failure}</p>
                  ) : videoJob.state === "test" ? (
                    <p className="text-muted-foreground">Test render queued — no real video is produced by the test service.</p>
                  ) : (
                    <p className="flex items-center text-muted-foreground"><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Rendering walkthrough ({videoJob.state})… usually under a minute.</p>
                  )}
                </>
              );
              return wide
                ? createPortal(
                  <div ref={videoContainerRef} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/95 p-4 [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:bg-background" aria-label="Walkthrough video">
                    {inner}
                  </div>, document.body)
                : <div ref={videoContainerRef} className="w-full basis-full border border-border p-3 text-xs [&:fullscreen]:flex [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:flex-col [&:fullscreen]:gap-3 [&:fullscreen]:border-0 [&:fullscreen]:bg-background" aria-label="Walkthrough video">{inner}</div>;
            })()}
            {videoHistory.length > 0 && (
              <div className="w-full basis-full border border-border p-3 text-xs" aria-label="Walkthrough video history">
                <p className="mb-2 font-medium">Previous walkthrough videos</p>
                <ul className="space-y-1.5">
                  {videoHistory.map((h) => (
                    <li key={h.job_id} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {new Date(h.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        {h.quality ? ` · ${h.quality}` : ""}
                        {" — "}
                        {h.video_url ? "Ready" : h.failure ? `Failed: ${h.failure}` : h.state}
                      </span>
                      {h.video_url && (
                        <span className="flex shrink-0 items-center gap-3">
                          <button
                            type="button"
                            className="underline underline-offset-2 hover:text-foreground"
                            onClick={() => setVideoJob({ id: h.job_id, state: "completed", url: h.video_url ?? undefined })}
                          >
                            Replay
                          </button>
                          <button
                            type="button"
                            aria-pressed={videoCompareIds.includes(h.job_id)}
                            aria-label={`Compare render from ${new Date(h.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
                            className={`underline underline-offset-2 hover:text-foreground ${videoCompareIds.includes(h.job_id) ? "font-medium text-foreground" : ""}`}
                            onClick={() => toggleVideoCompare(h.job_id)}
                          >
                            {videoCompareIds.includes(h.job_id) ? "Selected" : "Compare"}
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {compareItems.length === 2 && (
                  <div className="mt-3 border-t border-border pt-3" aria-label="Walkthrough quality comparison">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium">Side-by-side comparison <span className="font-normal text-muted-foreground">— playback and seeking stay in sync</span></p>
                      <span className="flex items-center gap-3">
                        <button
                          type="button"
                          className="underline underline-offset-2 hover:text-foreground"
                          onClick={() => compareVideoRefs.current.forEach((v) => { if (v) { v.currentTime = 0; void v.play().catch(() => {}); } })}
                        >
                          Restart both
                        </button>
                        <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setVideoCompareIds([])}>
                          Close comparison
                        </button>
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {compareItems.map((h, i) => (
                        <figure key={h.job_id} className="space-y-1">
                          <video ref={(el) => { compareVideoRefs.current[i] = el; }} src={h.video_url ?? undefined} controls playsInline preload="metadata" className="h-auto w-full bg-background" />
                          <figcaption className="text-muted-foreground">
                            {h.quality ?? "720p"} · {new Date(h.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
                {compareItems.length === 1 && (
                  <p className="mt-2 text-muted-foreground">Select one more ready render to compare side by side.</p>
                )}
              </div>
            )}
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
                {syncHistoryOpen && pathSyncHistory.length > 0 && (() => {
                  const failed = pathSyncHistory.filter((e) => e.failed.length > 0);
                  const ok = pathSyncHistory.filter((e) => e.failed.length === 0);
                  const shown = syncHistoryFilter === "failed" ? failed : syncHistoryFilter === "ok" ? ok : pathSyncHistory;
                  const opt = (v: "all" | "failed" | "ok", label: string, count: number) => (
                    <button type="button" aria-pressed={syncHistoryFilter === v}
                      className={cn("underline underline-offset-2", syncHistoryFilter === v ? "text-foreground" : "hover:text-foreground")}
                      onClick={() => setSyncHistoryFilter(v)}>{label} ({count})</button>
                  );
                  return (
                    <div className="ml-auto w-fit space-y-1 text-right">
                      <div role="group" aria-label="Filter sync history" className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
                        {opt("all", "All", pathSyncHistory.length)}
                        {opt("failed", "Failed", failed.length)}
                        {opt("ok", "Successful", ok.length)}
                      </div>
                      {shown.length > 0 ? (
                        <ul aria-label="Recent camera path syncs" className="space-y-0.5 text-[11px] text-muted-foreground">
                          {shown.map((e) => (
                            <li key={e.at}>
                              {syncTimeAgo(e.at)} — {e.failed.length > 0
                                ? <span className="text-amber-600">{e.moved} synced, {e.failed.length} failed ({e.failed.join(", ")})</span>
                                : <span>{e.moved > 0 ? `${e.moved} path${e.moved > 1 ? "s" : ""} synced` : "Up to date"}</span>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">No {syncHistoryFilter === "failed" ? "failed" : "successful"} syncs yet.</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
        {!scene && !loading && (
          <Canvas dpr={[1, 1.5]} aria-label="Empty room grid">
            <PerspectiveCamera makeDefault fov={45} position={[brief.roomDimensions.width * 1.1, Math.max(brief.roomDimensions.width, brief.roomDimensions.length) * 1.1, brief.roomDimensions.length * 1.3]} />
            <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
            <ambientLight intensity={0.8} />
            <gridHelper args={[10, 10]} scale={[brief.roomDimensions.width / 10, 1, brief.roomDimensions.length / 10]} />
          </Canvas>
        )}
        {scene && (
          <Canvas shadows dpr={[1, 1.5]} gl={{ preserveDrawingBuffer: true }} onPointerMissed={() => setSelectedId(null)}>
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
              pieceNames={new Map(catalogue.map((item) => [item.componentId, item.name]))}
              onAssetTransform={onAssetTransform} onDragStateChange={setDragging} isEditable={!walkActive && !authorMode}>
              <RoomOverviewCamera revision={overviewRevision} view={cameraView} enabled={!walkActive && !authorMode && !dragging} />
            </AICuratedEnvironment>
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
                  const r = autoShiftFlaggedNodes(scene, authorNodes, 0.15, 30, shiftDirection);
                  setAuthorNodes(r.nodes);
                  if (r.conflicts.length) toast.warning(`Shifted as far as the room allows — ${r.conflicts.length} spot${r.conflicts.length > 1 ? "s" : ""} still flagged; move those points by hand`);
                  else toast.success("Flagged viewpoints shifted sideways — path is now clear");
                }}>Shift sideways</Button>
              </div>
              <Label className="flex items-center gap-2">Shift direction
                <Select value={shiftDirection} onValueChange={(v) => setShiftDirection(v as ShiftDirection)}>
                  <SelectTrigger aria-label="Shift direction" className="h-8 flex-1 bg-background text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (try both sides)</SelectItem>
                    <SelectItem value="left">Left of path</SelectItem>
                    <SelectItem value="right">Right of path</SelectItem>
                  </SelectContent>
                </Select>
              </Label>
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
