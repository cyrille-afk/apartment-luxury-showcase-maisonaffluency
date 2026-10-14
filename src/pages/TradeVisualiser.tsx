import { clampPtQuality, loadPtQuality, PT_QUALITY_KEY, type PathTraceQuality } from "@/lib/visualiserPathTracing";
import { CEILING_CONTROLS, clampCeilingHeight, clampCeilingThickness, clampCeilingOpening, type CeilingSettings } from "@/lib/visualiserCeilingSettings";
import { parseDimensionString } from "@/lib/productDimensions";
import { SceneErrorBoundary } from "@/components/trade/visualiser/SceneErrorBoundary";
import { LAST_GOOD_KEY, STABLE_AFTER_MS, recoverScene, takeRecoveryNotice } from "@/lib/visualiserSceneRecovery";
import { LocalExrButton } from "@/components/trade/visualiser/LocalExrButton";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { finishTargetsFromParts, getPartMaterial, hasAnyFinish, materialFitsTarget, targetLabel, withPartMaterial, type FinishPart, type FinishTarget } from "@/lib/visualiserFinishTargets";
import { findProductSchema, schemaFits, schemaLabels, schemaTargets } from "@/lib/visualiserProductSchema";
import PartMappingControl from "@/components/trade/visualiser/PartMappingControl";
import { usePartGroupLabels } from "@/lib/visualiserPartMapping";
import {
  pickFootprintSlot,
  SPAWN_STAGGER_X,
  footprintRadius,
  respaceObjects,
  DEFAULT_SLOT_SPACING,
  MIN_SLOT_SPACING,
  MAX_SLOT_SPACING,
  SLOT_SPACING_STEP,
} from "@/lib/visualiserPlacement";
import FinishPresets from "@/components/trade/visualiser/FinishPresets";
import { Box, ImageUp, Loader2, Lock, Plus, RotateCcw, Search, Unlock, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { captureCanvasPng, downloadDataUrl, mockupFilename, nextPaintedFrame } from "@/lib/visualiserExport";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { BACKDROP_SWATCHES, WALL_COLORS, WALL_FINISHES, WALL_FULL_HEIGHT_M, clampBackdropBrightness, clampFloorGlare, clampWallFinishIntensity, clampWallHeight, RUG_COLORS, RUG_WEAVES, clampRugPile, clampRugSize, clampRugOffset, rugVisible, rugColor as toRugColor, rugBorderColor as toRugBorderColor, clampRugBorderThicknessMm, clampRugBorderTwistMm, clampRugBorderRoughness, rugWeave as toRugWeave, type RugColor, type RugBorderColor, type RugWeave, normalizeHexColor, roomFloorFinish, roomWallColor, roomWallFinish, wallColorHex, type RoomFloorFinish, type RoomWallColor, type RoomWallFinish } from "@/lib/visualiserRoomSurfaces";
import { visualiserDimensions } from "@/lib/visualiserProductMetadata";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import { VisualiserSelectionProvider } from "@/components/trade/visualiser/VisualiserSelectionContext";
import VisualiserInspector from "@/components/trade/visualiser/VisualiserInspector";
import ScenePresets from "@/components/trade/visualiser/ScenePresets";
import CatalogDrawer from "@/components/trade/visualiser/CatalogDrawer";
import "@/components/trade/visualiser/visualiserToolbar.css";
import { lazyImportWithRetry } from "@/lib/lazyWithRetry";

// three.js / @react-three/* live behind this boundary so they are never part
// of the main bundle — they download only when the Visualiser route mounts.
const VisualiserCanvas = lazy(
  lazyImportWithRetry(() => import("@/components/trade/visualiser/VisualiserCanvas")),
);
const ModelOrientationControls = lazy(
  lazyImportWithRetry(() => import("@/components/trade/visualiser/ModelOrientationControls")),
);
const PieceAngleControls = lazy(
  lazyImportWithRetry(() => import("@/components/trade/visualiser/PieceAngleControls")),
);
import { toast } from "sonner";
import { useConciergeSession } from "@/hooks/useConciergeSession";
import { useVisualiserMaterial, type VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import {
  BOND_STREET_BASE_FINISH,
  BOND_STREET_BASE_FINISHES,
  BOND_STREET_UPHOLSTERY_FINISHES,
  isBondStreetStool,
} from "@/lib/visualiserProductFinishes";

type CatalogueProduct = {
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  category: string;
  subcategory?: string | null;
  dimensions: string | null;
  width_mm?: number | null;
  depth_mm?: number | null;
  height_mm?: number | null;
  size_variants?: PlacedObject["size_variants"];
  glb_url: string | null;
  source_pick_id: string | null;
};

type EnvironmentSourcePref = "empty-room-exr" | "studio-hdr";

type PersistedSandbox = CeilingSettings & {
  backdropDataUrl: string | null;
  backdrop: string | null;
  objects: PlacedObject[];
  projectId?: string | null;
  spacing?: number;
  snapToGrid?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  depthOfField?: boolean;
  dofStrength?: number;
  dofFocusSelected?: boolean;
  environmentSource?: EnvironmentSourcePref;
  floorFinish?: RoomFloorFinish;
  showRearWall?: boolean;
  wallHeight?: number;
  floorGlare?: number;
  wallColor?: RoomWallColor;
  wallFinish?: RoomWallFinish;
  wallCustomHex?: string | null;
  wallFinishIntensity?: number;
  rugColor?: string;
  rugBorderColor?: string;
  rugBorderThicknessMm?: number;
  rugBorderTwistMm?: number;
  rugBorderRoughness?: number;
  rugWeave?: string;
  rugPile?: number;
  rugWidth?: number | null;
  rugDepth?: number | null;
  rugOffsetX?: number;
  rugOffsetZ?: number;
  /** Hide the rug while arranging furniture (default shown). */
  showRug?: boolean;
  /** Seamless studio stage colour (hex) when no room photo is loaded. */
  backdropColor?: string | null;
  /** Stage brightness, 0–100 (50 = the colour as chosen). */
  backdropBrightness?: number;
};

const STORAGE_KEY = "trade-visualiser-sandbox-v3";
const MAX_OBJECTS = 15;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const CUTOUT_TRANSFORMS = "f_png,q_100,w_1200,dpr_auto,c_limit,e_make_transparent:10";

const microLabel = "text-[10px] uppercase tracking-[0.15em]";

const readSandbox = (): PersistedSandbox => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { backdrop: null, backdropDataUrl: null, objects: [] };
    const parsed = JSON.parse(raw) as PersistedSandbox;
    return {
      backdrop: parsed.backdrop ?? null,
      backdropDataUrl: parsed.backdropDataUrl ?? null,
      objects: Array.isArray(parsed.objects) ? parsed.objects.map((object) => ({ ...object, positionLocked: object.positionLocked ?? object.finishesLocked ?? false, finishesLocked: false })) : [],
      projectId: parsed.projectId ?? null,
      spacing: typeof parsed.spacing === "number" && Number.isFinite(parsed.spacing) ? parsed.spacing : undefined,
      snapToGrid: parsed.snapToGrid === true,
      showGrid: parsed.showGrid !== false,
      showLabels: parsed.showLabels !== false,
      depthOfField: parsed.depthOfField === true,
      dofStrength: typeof parsed.dofStrength === "number" && Number.isFinite(parsed.dofStrength) ? Math.min(10, Math.max(1, parsed.dofStrength)) : undefined,
      dofFocusSelected: parsed.dofFocusSelected !== false,
      environmentSource: parsed.environmentSource === "studio-hdr" ? "studio-hdr" : "empty-room-exr",
      floorFinish: roomFloorFinish(parsed.floorFinish),
      showRearWall: parsed.showRearWall !== false,
      wallHeight: clampWallHeight(parsed.wallHeight),
      ceilingHeight: clampCeilingHeight(parsed.ceilingHeight),
      ceilingThickness: clampCeilingThickness(parsed.ceilingThickness),
      ceilingOpening: clampCeilingOpening(parsed.ceilingOpening),
      floorGlare: clampFloorGlare(parsed.floorGlare),
      wallColor: roomWallColor(parsed.wallColor),
      wallFinish: roomWallFinish(parsed.wallFinish),
      wallCustomHex: normalizeHexColor(parsed.wallCustomHex) ?? null,
      wallFinishIntensity: clampWallFinishIntensity(parsed.wallFinishIntensity),
      rugColor: toRugColor(parsed.rugColor),
      rugBorderColor: toRugBorderColor(parsed.rugBorderColor),
      rugBorderThicknessMm: clampRugBorderThicknessMm(parsed.rugBorderThicknessMm),
      rugBorderTwistMm: clampRugBorderTwistMm(parsed.rugBorderTwistMm),
      rugBorderRoughness: clampRugBorderRoughness(parsed.rugBorderRoughness),
      rugWeave: toRugWeave(parsed.rugWeave),
      rugPile: clampRugPile(parsed.rugPile),
      rugWidth: clampRugSize(parsed.rugWidth),
      rugDepth: clampRugSize(parsed.rugDepth),
      rugOffsetX: clampRugOffset(parsed.rugOffsetX),
      rugOffsetZ: clampRugOffset(parsed.rugOffsetZ),
      showRug: rugVisible(parsed.showRug),
      backdropColor: normalizeHexColor(parsed.backdropColor) ?? null,
      backdropBrightness: clampBackdropBrightness(parsed.backdropBrightness),
    };
  } catch {
    return { backdrop: null, backdropDataUrl: null, objects: [], projectId: null };
  }
};

async function hydrateCatalogueDimensions(catalogue: CatalogueProduct[]): Promise<CatalogueProduct[]> {
  const pickIds = [...new Set(catalogue.filter(product => !visualiserDimensions(product)).map(product => product.source_pick_id).filter((id): id is string => Boolean(id)))];
  const { data } = pickIds.length
    ? await supabase.from("designer_curator_picks").select("id, dimensions, width_mm, depth_mm, height_mm, size_variants").in("id", pickIds)
    : { data: [] };
  const picks = new Map((data ?? []).map(pick => [pick.id, { ...pick, size_variants: Array.isArray(pick.size_variants) ? pick.size_variants as PlacedObject["size_variants"] : null }]));
  return catalogue.map(product => ({ ...product, dimensions: visualiserDimensions(product, picks.get(product.source_pick_id ?? "")) ?? product.dimensions }));
}

const CanvasLoader = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <span className={cn(microLabel, "text-muted-foreground")}>Preparing 3D workspace…</span>
  </div>
);

const TradeVisualiser = () => {
  const initial = useMemo(readSandbox, []);
  const crashHandledRef = useRef(false);
  const handleSceneCrash = useCallback(() => {
    if (crashHandledRef.current) return;
    crashHandledRef.current = true;
    let outcome: "restored" | "reset" = "reset";
    try { outcome = recoverScene(STORAGE_KEY); } catch { /* keep the scene untouched */ }
    // Reload only when a different, known-good scene was restored. Repeated or
    // scene-independent crashes (no WebGL, failed chunk) must not loop reloads.
    if (outcome === "restored") {
      window.location.reload();
      return;
    }
    try { takeRecoveryNotice(); } catch { /* noop */ }
    toast.error("The 3D view couldn't start in this browser. Your scene is kept — reload the page to try again.");
  }, []);
  useEffect(() => {
    const notice = takeRecoveryNotice();
    if (notice === "restored") toast.warning("A display error occurred — your last working room scene was restored.");
    else if (notice === "reset") toast.warning("A display error occurred again — your scene was kept as is and reloaded.");
  }, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [objects, setObjects] = useState<PlacedObject[]>(initial.objects);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [backdrop, setBackdrop] = useState<string | null>(initial.backdrop);
  const [backdropDataUrl, setBackdropDataUrl] = useState<string | null>(initial.backdropDataUrl);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [spacing, setSpacing] = useState<number>(initial.spacing ?? DEFAULT_SLOT_SPACING);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(initial.snapToGrid ?? false);
  const [showGrid, setShowGrid] = useState<boolean>(initial.showGrid ?? true);
  const [showLabels, setShowLabels] = useState<boolean>(initial.showLabels ?? true);
  const [pathTrace, setPathTrace] = useState(false);
  const [ptSamples, setPtSamples] = useState(0);
  const [ptQuality, setPtQualityState] = useState<PathTraceQuality>(() => loadPtQuality());
  const setPtQuality = (patch: Partial<PathTraceQuality>) => setPtQualityState((q) => {
    const next = clampPtQuality({ ...q, ...patch });
    try { localStorage.setItem(PT_QUALITY_KEY, JSON.stringify(next)); } catch { /* storage full */ }
    return next;
  });
  const [depthOfField, setDepthOfField] = useState<boolean>(initial.depthOfField ?? false);
  const [dofStrength, setDofStrength] = useState<number>(initial.dofStrength ?? 3);
  const [dofFocusSelected, setDofFocusSelected] = useState<boolean>(initial.dofFocusSelected ?? true);
  const [environmentSource, setEnvironmentSource] = useState<EnvironmentSourcePref>(initial.environmentSource ?? "empty-room-exr");
  const [floorFinish, setFloorFinish] = useState<RoomFloorFinish>(roomFloorFinish(initial.floorFinish));
  const [showRearWall, setShowRearWall] = useState(initial.showRearWall !== false);
  const [wallHeight, setWallHeight] = useState<number>(clampWallHeight(initial.wallHeight));
  const [ceilingHeight, setCeilingHeight] = useState(clampCeilingHeight(initial.ceilingHeight));
  const [ceilingThickness, setCeilingThickness] = useState(clampCeilingThickness(initial.ceilingThickness));
  const [ceilingOpening, setCeilingOpening] = useState(clampCeilingOpening(initial.ceilingOpening));
  const [floorGlare, setFloorGlare] = useState<number>(clampFloorGlare(initial.floorGlare));
  const [wallColor, setWallColor] = useState<RoomWallColor>(roomWallColor(initial.wallColor));
  const [wallFinish, setWallFinish] = useState<RoomWallFinish>(roomWallFinish(initial.wallFinish));
  const [wallCustomHex, setWallCustomHex] = useState<string | null>(normalizeHexColor(initial.wallCustomHex) ?? null);
  const [wallFinishIntensity, setWallFinishIntensity] = useState<number>(clampWallFinishIntensity(initial.wallFinishIntensity));
  const [rugColorKey, setRugColorKey] = useState<RugColor>(toRugColor(initial.rugColor));
  const [rugBorderColorKey, setRugBorderColorKey] = useState<RugBorderColor>(toRugBorderColor(initial.rugBorderColor));
  const [rugBorderThicknessMm, setRugBorderThicknessMm] = useState<number>(clampRugBorderThicknessMm(initial.rugBorderThicknessMm));
  const [rugBorderTwistMm, setRugBorderTwistMm] = useState<number>(clampRugBorderTwistMm(initial.rugBorderTwistMm));
  const [rugBorderRoughness, setRugBorderRoughness] = useState<number>(clampRugBorderRoughness(initial.rugBorderRoughness));
  const [rugWeaveKey, setRugWeaveKey] = useState<RugWeave>(toRugWeave(initial.rugWeave));
  const [rugPile, setRugPile] = useState<number>(clampRugPile(initial.rugPile));
  const [rugWidth, setRugWidth] = useState<number | null>(clampRugSize(initial.rugWidth));
  const [rugDepth, setRugDepth] = useState<number | null>(clampRugSize(initial.rugDepth));
  const [rugOffsetX, setRugOffsetX] = useState<number>(clampRugOffset(initial.rugOffsetX));
  const [rugOffsetZ, setRugOffsetZ] = useState<number>(clampRugOffset(initial.rugOffsetZ));
  const [showRug, setShowRug] = useState<boolean>(rugVisible(initial.showRug));
  const [backdropColor, setBackdropColor] = useState<string | null>(normalizeHexColor(initial.backdropColor) ?? null);
  const [backdropBrightness, setBackdropBrightness] = useState<number>(clampBackdropBrightness(initial.backdropBrightness));
  const rugLayout = useMemo(() => ({ width: rugWidth, depth: rugDepth, offsetX: rugOffsetX, offsetZ: rugOffsetZ }), [rugWidth, rugDepth, rugOffsetX, rugOffsetZ]);
  const [customHexDraft, setCustomHexDraft] = useState<string>(normalizeHexColor(initial.wallCustomHex) ?? "#f4efe7");
  const applyCustomHex = (raw: string) => {
    setCustomHexDraft(raw);
    const hex = normalizeHexColor(raw);
    if (hex) {
      setCustomHexDraft(hex);
      setWallCustomHex(hex);
      setWallColor("custom");
    }
  };
  const [projectId, setProjectId] = useState<string | null>(initial.projectId ?? null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const intakeRef = useRef<string | null>(null);
  const [materials, setMaterials] = useState<VisualiserMaterial[]>([]);
  // Finishes linked to the selected product (product_fabrics → fabrics).
  // null = no selection or none linked → show the global library.
  const [linkedMaterials, setLinkedMaterials] = useState<VisualiserMaterial[] | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");
  const [finishTarget, setFinishTarget] = useState<FinishTarget>("all");
  const [textureParts, setTextureParts] = useState<Record<string, FinishPart[]>>({});
  const handleTextureParts = useCallback((instanceId: string, parts: FinishPart[]) => {
    setTextureParts((current) => (current[instanceId]?.join() === parts.join() ? current : { ...current, [instanceId]: parts }));
  }, []);
  const { activeMaterial, setActiveMaterial } = useVisualiserMaterial();
  // Only a finish picked with nothing selected (or from Felix) is "armed" for the next piece;
  // finishes locked onto an existing piece must never leak onto newly added items.
  const armedMaterialRef = useRef(true);
  useEffect(() => { setFinishTarget("all"); }, [selectedId]);
  const { session: conciergeSession } = useConciergeSession();

  useEffect(() => {
    const previousBody = document.body.style.overflow;
    const previousHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBody;
      document.documentElement.style.overflow = previousHtml;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("material_swatches")
      .select("id, name, brand_name, category, material_type, color_family, image_url")
      .eq("is_active", true)
      .not("image_url", "is", null)
      .order("brand_name")
      .order("name")
      .limit(160)
      .then(({ data }) => {
        if (!cancelled) setMaterials((data ?? []) as VisualiserMaterial[]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const finishes = conciergeSession?.finishes;
    const imageUrl = finishes?.fabricImg ?? finishes?.woodImg;
    const name = finishes?.fabric ?? finishes?.wood;
    if (!imageUrl || !name) return;
    armedMaterialRef.current = true;
    setActiveMaterial({
      id: `concierge-${name}`,
      name,
      brand_name: "AI Curatorial Assistant",
      category: finishes?.fabricImg ? "Fabric" : "Wood",
      material_type: finishes?.fabricImg ? "Fabric" : "Wood",
      color_family: null,
      image_url: imageUrl,
    });
  }, [conciergeSession?.finishes.fabric, conciergeSession?.finishes.fabricImg, conciergeSession?.finishes.wood, conciergeSession?.finishes.woodImg, setActiveMaterial]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const columns = "id, product_name, brand_name, image_url, category, subcategory, dimensions, width_mm, depth_mm, height_mm, size_variants, glb_url, source_pick_id";
      const base = () => supabase
        .from("trade_products")
        .select(columns)
        .eq("is_active", true)
        .eq("is_hidden", false);
      const merged = new Map<string, CatalogueProduct>();
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await base().order("id").range(offset, offset + 499);
        if (cancelled) return;
        if (error) {
          toast.error("The collection index could not be loaded.");
          setLoadingProducts(false);
          return;
        }
        const page = (data ?? []) as CatalogueProduct[];
        for (const product of page) merged.set(product.id, product);
        if (page.length < 500) break;
      }
      const hydrated = await hydrateCatalogueDimensions([...merged.values()]);
      if (cancelled) return;
      setProducts(hydrated);
      // Restore missing metadata on existing snapshots without changing their transforms/finishes.
      const byId = new Map(hydrated.map(product => [product.id, product]));
      setObjects(current => current.map(object => {
        const dimensions = visualiserDimensions(object, byId.get(object.id));
        return dimensions && dimensions !== object.dimensions ? { ...object, dimensions } : object;
      }));
      setLoadingProducts(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let sandboxJson: string | null = null;
    try {
      sandboxJson = JSON.stringify({
        backdrop: backdrop?.startsWith("blob:") ? null : backdrop,
        backdropDataUrl,
        objects,
        projectId,
        spacing,
        snapToGrid,
        showGrid,
        showLabels,
        depthOfField,
        dofStrength,
        dofFocusSelected,
        environmentSource,
        floorFinish,
        showRearWall,
        wallHeight, ceilingHeight, ceilingThickness, ceilingOpening,
        floorGlare,
        wallColor,
        wallFinish,
        wallCustomHex,
        wallFinishIntensity,
        rugColor: rugColorKey,
        rugBorderColor: rugBorderColorKey,
        rugBorderThicknessMm,
        rugBorderTwistMm,
        rugBorderRoughness,
        rugWeave: rugWeaveKey,
        rugPile,
        rugWidth, rugDepth, rugOffsetX, rugOffsetZ,
        showRug,
        backdropColor,
        backdropBrightness,
      });
      sessionStorage.setItem(STORAGE_KEY, sandboxJson);
    } catch {
      /* quota exceeded — composition stays in memory */
    }
    // Promote to "last working scene" once it has rendered cleanly for a few seconds.
    const json = sandboxJson;
    if (!json) return;
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem(LAST_GOOD_KEY, json); } catch { /* ignore */ }
    }, STABLE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [backdrop, backdropDataUrl, objects, projectId, spacing, snapToGrid, showGrid, showLabels, depthOfField, dofStrength, dofFocusSelected, environmentSource, floorFinish, showRearWall, wallHeight, ceilingHeight, ceilingThickness, ceilingOpening, floorGlare, wallColor, wallFinish, wallCustomHex, wallFinishIntensity, rugColorKey, rugBorderColorKey, rugBorderThicknessMm, rugBorderTwistMm, rugBorderRoughness, rugWeaveKey, rugPile, rugWidth, rugDepth, rugOffsetX, rugOffsetZ, showRug, backdropColor, backdropBrightness]);

  useEffect(() => {
    const requestId = searchParams.get("fromAxo");
    if (!requestId) return;
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("fromAxo");
      return next;
    }, { replace: true });
    void (async () => {
      const { data } = await supabase
        .from("axonometric_requests")
        .select("result_image_url, project_name")
        .eq("id", requestId)
        .maybeSingle();
      if (!data?.result_image_url) {
        toast.error("That delivered visual is not available yet.");
        return;
      }
      setBackdrop(data.result_image_url);
      setBackdropDataUrl(null);
      toast.success(`${data.project_name || "Delivered visual"} opened as the canvas backdrop.`);
    })();
  }, [searchParams, setSearchParams]);

  /**
   * Project intake: `/trade/visualiser?project=<id>` pre-loads the canvas with the
   * pieces already specified for that project (quote lines + client board items).
   */
  useEffect(() => {
    const incoming = searchParams.get("project");
    if (!incoming || intakeRef.current === incoming) return;
    intakeRef.current = incoming;
    const alreadyComposed = initial.projectId === incoming && initial.objects.length > 0;
    setProjectId(incoming);

    void (async () => {
      const sb = supabase as any;
      const { data: project } = await sb.from("projects").select("name").eq("id", incoming).maybeSingle();
      setProjectName(project?.name ?? null);
      if (alreadyComposed) return;

      setLoadingProject(true);
      const [quotes, boards] = await Promise.all([
        sb.from("trade_quotes").select("id").eq("project_id", incoming),
        sb.from("client_boards").select("id").eq("project_id", incoming),
      ]);
      const quoteIds = (quotes.data ?? []).map((row: { id: string }) => row.id);
      const boardIds = (boards.data ?? []).map((row: { id: string }) => row.id);
      const [quoteItems, boardItems] = await Promise.all([
        quoteIds.length
          ? sb.from("trade_quote_items").select("product_id").in("quote_id", quoteIds)
          : Promise.resolve({ data: [] }),
        boardIds.length
          ? sb.from("client_board_items").select("product_id").in("board_id", boardIds)
          : Promise.resolve({ data: [] }),
      ]);
      const productIds = [...new Set(
        [...(quoteItems.data ?? []), ...(boardItems.data ?? [])]
          .map((row: { product_id: string | null }) => row.product_id)
          .filter(Boolean) as string[],
      )].slice(0, MAX_OBJECTS);

      if (!productIds.length) {
        setLoadingProject(false);
        toast.message("No specified pieces found for this project yet — starting from a blank canvas.");
        return;
      }

      const { data: catalogue } = await sb
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, category, subcategory, dimensions, width_mm, depth_mm, height_mm, size_variants, glb_url, source_pick_id")
        .in("id", productIds);

      const hydratedCatalogue = await hydrateCatalogueDimensions((catalogue ?? []) as CatalogueProduct[]);
      const placed: PlacedObject[] = hydratedCatalogue.map((product, index) => ({
        instanceId: `${product.id}-${incoming}-${index}`,
        id: product.id,
        product_name: product.product_name,
        brand_name: product.brand_name,
        image_url: product.image_url ? optimizeImageUrl(product.image_url, CUTOUT_TRANSFORMS) : null,
        dimensions: product.dimensions,
        glb_url: product.glb_url,
        position: [((index % 4) - 1.5) * 1.4, 0, Math.floor(index / 4) * -1.4],
        rotation: [0, 0, 0],
        scale: 1,
        material: isBondStreetStool(product.id) || !armedMaterialRef.current ? null : activeMaterial,
        baseMaterial: isBondStreetStool(product.id) ? BOND_STREET_BASE_FINISH : null,
        upholsteryMaterial: null,
      }));

      setObjects(placed);
      setSelectedId(null);
      setLoadingProject(false);
      toast.success(`${project?.name || "Project"} specification loaded — ${placed.length} piece${placed.length === 1 ? "" : "s"}.`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);


  const selected = objects.find((object) => object.instanceId === selectedId) ?? null;

  // Load the finishes linked to the selected product so the swatch grid shows
  // that piece's own finishes instead of the global library.
  const selectedProductId = selected?.id ?? null;
  useEffect(() => {
    if (!selectedProductId) {
      setLinkedMaterials(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const product = products.find((p) => p.id === selectedProductId);
      const pickId = product?.source_pick_id ?? selectedProductId;
      const { data: links } = await supabase
        .from("product_fabrics")
        .select("sort_order, fabrics(id, name, supplier, category, image_url, is_active)")
        .eq("pick_id", pickId)
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      const linked = (links ?? [])
        .map((link) => (link as unknown as { fabrics: { id: string; name: string; supplier: string | null; category: string | null; image_url: string | null; is_active: boolean } | null }).fabrics)
        .filter((fabric): fabric is NonNullable<typeof fabric> => Boolean(fabric?.is_active && fabric.image_url))
        .map((fabric) => ({
          id: fabric.id,
          name: fabric.name,
          brand_name: fabric.supplier ?? product?.brand_name ?? "",
          category: fabric.category ?? "Fabric",
          material_type: fabric.category,
          color_family: null,
          image_url: fabric.image_url,
        }));
      setLinkedMaterials(linked.length ? linked : null);
    })();
    return () => { cancelled = true; };
  }, [selectedProductId, products]);
  // Sub-tabs come from the selected model's texture nodes; Bond Street declares its own parts.
  // Declared product schemas (components + allowed finish groups) override model detection.
  const productSchema = useMemo(() => findProductSchema(selected?.product_name), [selected?.product_name]);
  const availableTargets = useMemo<FinishTarget[]>(
    () => productSchema
      ? schemaTargets(productSchema)
      : finishTargetsFromParts(selected ? textureParts[selected.instanceId] ?? [] : []),
    [selected, textureParts, productSchema],
  );
  const effectiveTarget: FinishTarget = availableTargets.includes(finishTarget) ? finishTarget : "all";
  const detectedGroupLabels = usePartGroupLabels(selected?.id);
  const partGroupLabels = useMemo(
    () => (productSchema ? { ...detectedGroupLabels, ...schemaLabels(productSchema) } : detectedGroupLabels),
    [detectedGroupLabels, productSchema],
  );
  const targetMaterial = selected ? getPartMaterial(selected, effectiveTarget) : null;

  const focusRef = useRef<(() => [number, number] | null) | null>(null);
  const spawnStreakRef = useRef<{ at: number; count: number; focus: [number, number] }>({ at: 0, count: 0, focus: [0, 0] });
  const addObject = (product: CatalogueProduct) => {
    if (objects.length >= MAX_OBJECTS) {
      toast.error(`This composition can hold up to ${MAX_OBJECTS} objects.`);
      return;
    }
    const next: PlacedObject = {
      instanceId: `${product.id}-${Date.now()}`,
      id: product.id,
      product_name: product.product_name,
      brand_name: product.brand_name,
      image_url: product.image_url ? optimizeImageUrl(product.image_url, CUTOUT_TRANSFORMS) : null,
      dimensions: product.dimensions,
      glb_url: product.glb_url,
      position: pickFootprintSlot(
        objects.map((o) => ({ position: o.position, radius: footprintRadius(parseDimensionString(o.dimensions), o.scale) })),
        footprintRadius(parseDimensionString(product.dimensions)),
        spacing,
        (() => {
          const focus = focusRef.current?.() ?? [0, 0];
          const streak = spawnStreakRef.current;
          const now = Date.now();
          const same = now - streak.at < 4000 && Math.hypot(focus[0] - streak.focus[0], focus[1] - streak.focus[1]) < 0.05;
          streak.count = same ? streak.count + 1 : 0;
          streak.at = now;
          streak.focus = focus;
          return [focus[0] + streak.count * SPAWN_STAGGER_X, focus[1]] as [number, number];
        })(),
      ),
      rotation: [0, 0, 0],
      scale: 1,
      material: isBondStreetStool(product.id) || !armedMaterialRef.current ? null : activeMaterial,
      baseMaterial: isBondStreetStool(product.id) ? BOND_STREET_BASE_FINISH : null,
      upholsteryMaterial: null,
    };
    setObjects((current) => [...current, next]);
    setSelectedId(next.instanceId);
  };

  const transformObject = useCallback((
    instanceId: string,
    position: [number, number, number],
    rotation: [number, number, number],
  ) => {
    setObjects((current) => current.map((object) => (
      object.instanceId === instanceId ? { ...object, position: object.positionLocked ? object.position : position, rotation } : object
    )));
  }, []);

  const removeObject = (instanceId: string) => {
    setObjects((current) => current.filter((object) => object.instanceId !== instanceId));
    setSelectedId((current) => (current === instanceId ? null : current));
  };

  const scaleObject = (instanceId: string, scale: number) => {
    setObjects((current) => current.map((object) => (
      object.instanceId === instanceId
        ? { ...object, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) }
        : object
    )));
  };


  const adjustSpacing = (delta: number) => {
    setSpacing((current) => {
      const next = Math.round((current + delta) * 10) / 10;
      return Math.min(MAX_SLOT_SPACING, Math.max(MIN_SLOT_SPACING, next));
    });
  };

  const applySpacingToScene = () => {
    if (objects.length < 2) {
      toast.message("Add at least two pieces to respace the scene.");
      return;
    }
    setObjects((current) => respaceObjects(current, spacing));
    toast.success(`Scene respaced at ${spacing.toFixed(1)} m between pieces.`);
  };

  const DEPTH_LEVELS = [0, 0.012, 0.024];

  /** Cycles the selected piece through floor depth layers so rugs can slide beneath seating. */
  const cycleDepth = () => {
    if (!selectedId) {
      toast.error("Select an object first.");
      return;
    }
    setObjects((current) => {
      const target = current.find((object) => object.instanceId === selectedId);
      if (!target) return current;
      const level = DEPTH_LEVELS.indexOf(target.position[1] ?? 0);
      const nextY = DEPTH_LEVELS[(level + 1) % DEPTH_LEVELS.length];
      const updated = current
        .filter((object) => object.instanceId !== selectedId)
        .concat({ ...target, position: [target.position[0], nextY, target.position[2]] });
      return updated;
    });
  };

  /** Applies a swatch to the whole piece or to a single GLB sub-mesh group. */
  const applyMaterial = (material: VisualiserMaterial) => {
    setActiveMaterial(material);
    armedMaterialRef.current = !selectedId;
    if (!selectedId) {
      toast.success(`${material.name} is ready for the next object.`);
      return;
    }
    setObjects((current) => current.map((object) => {
      if (object.instanceId !== selectedId) return object;
      return withPartMaterial(object, effectiveTarget, material);
    }));
  };

  const togglePositionLock = () => {
    if (!selectedId) return;
    setObjects((current) => current.map((object) => (
      object.instanceId === selectedId ? { ...object, positionLocked: !object.positionLocked } : object
    )));
  };

  const clearFinishes = () => {
    if (!selectedId) return;
    setObjects((current) => current.map((object) => (
      object.instanceId === selectedId
        ? { ...object, material: null, topMaterial: null, baseMaterial: null, upholsteryMaterial: null, partMaterials: {} }
        : object
    )));
  };

  const applyBondStreetFinish = (target: "base" | "upholstery", material: VisualiserMaterial | null) => {
    if (!selectedId) return;
    setObjects((current) => current.map((object) => object.instanceId === selectedId
      ? target === "base"
        ? { ...object, baseMaterial: material }
        : { ...object, upholsteryMaterial: material }
      : object));
  };

  const filteredMaterials = useMemo(() => {
    // Normalize away punctuation (e.g. the "·" in "ARSENE · QUINOA") so a
    // plain "arsene quinoa" query still matches.
    const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const query = norm(materialSearch);
    const source = linkedMaterials ?? materials;
    return source.filter((material) => (
      (productSchema ? schemaFits(productSchema, material, effectiveTarget) : materialFitsTarget(material, effectiveTarget))
      && (!query || norm(`${material.name} ${material.brand_name} ${material.category} ${material.material_type ?? ""}`).includes(query))
    ));
  }, [materialSearch, materials, linkedMaterials, effectiveTarget, productSchema]);

  const uploadBackdrop = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    setBackdrop(URL.createObjectURL(file));
    // Downscale to a storage-friendly data URL so the backdrop can persist
    // with the scene and inside scene presets without blowing localStorage quota.
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : null;
      if (!raw) { setBackdropDataUrl(null); return; }
      const img = new Image();
      img.onload = () => {
        const MAX = 1920;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setBackdropDataUrl(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => setBackdropDataUrl(raw);
      img.src = raw;
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const resetSandbox = () => {
    setObjects([]);
    setSelectedId(null);
    setBackdrop(null);
    setBackdropDataUrl(null);
    sessionStorage.removeItem(STORAGE_KEY);
    toast.success("Sandbox reset.");
  };

  const backdropSrc = backdrop ?? backdropDataUrl;

  // Export a clean PNG mockup: hide the floor grid, let one frame render,
  // capture the WebGL canvas, then restore the grid exactly as it was.
  const [exporting, setExporting] = useState(false);
  const downloadPresentationMockup = async () => {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas || exporting) return;
    setExporting(true);
    const hadGrid = showGrid;
    const hadSelection = selectedId;
    if (hadGrid) setShowGrid(false);
    if (hadSelection) setSelectedId(null); // keep the transform gizmo out of client mockups
    await nextPaintedFrame();
    await nextPaintedFrame();
    try {
      downloadDataUrl(captureCanvasPng(canvas), mockupFilename());
      toast.success("Mockup exported.");
    } catch {
      toast.error("Could not export the mockup.");
    }
    if (hadGrid) setShowGrid(true);
    if (hadSelection) setSelectedId(hadSelection);
    setExporting(false);
  };

  const toolbarButton = cn(
    "h-auto min-h-9 rounded-sm font-mono text-[10px] uppercase tracking-normal",
    "flex items-center gap-2 whitespace-nowrap px-3 py-2 text-foreground/80 transition-colors duration-200 hover:text-foreground hover:bg-foreground/[0.04] disabled:opacity-40",
  );

  return (
    <VisualiserSelectionProvider objects={objects} selectedId={selectedId} setSelectedId={setSelectedId}>
    <div className="visualiser-workspace relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-visualiser-canvas">
      <Helmet>
        <title>Visualiser Sandbox | Maison Affluency Trade</title>
        <meta name="description" content="Compose interiors in a live 3D sandbox with collectible design assets." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="relative min-h-0 flex-1 overflow-hidden">
      {backdropSrc && (
        <img
          src={backdropSrc}
          alt=""
          aria-hidden
          className="absolute inset-0 z-0 h-full w-full object-cover object-center"
        />
      )}

      <div ref={canvasWrapRef} className="absolute inset-0 z-10">
        <SceneErrorBoundary onError={handleSceneCrash}>
        <Suspense fallback={<CanvasLoader />}>
          <VisualiserCanvas
            focusRef={focusRef}
            objects={objects}
            selectedId={selectedId}
            orbitEnabled={orbitEnabled}
            hasBackdrop={Boolean(backdropSrc)}
            onSelect={setSelectedId}
            onTransform={transformObject}
            onDragStateChange={(dragging) => setOrbitEnabled(!dragging)}
            onTextureParts={handleTextureParts}
            snapToGrid={snapToGrid}
            showGrid={showGrid}
            showLabels={showLabels}
            depthOfField={depthOfField}
            pathTrace={pathTrace}
            onPathTraceSamples={setPtSamples}
            pathTraceQuality={ptQuality}
            dofStrength={dofStrength}
            dofFocusSelected={dofFocusSelected}
            environmentSource={environmentSource}
            floorFinish={floorFinish}
            showRearWall={showRearWall}
            wallHeight={wallHeight}
            ceilingHeight={ceilingHeight}
            ceilingThickness={ceilingThickness}
            ceilingOpening={ceilingOpening}
            floorGlare={floorGlare}
            wallColor={wallColor}
            wallFinish={wallFinish}
            wallCustomHex={wallCustomHex}
            wallFinishIntensity={wallFinishIntensity}
            rugColor={rugColorKey}
            rugBorderColor={rugBorderColorKey}
            rugBorderThicknessMm={rugBorderThicknessMm}
            rugBorderTwistMm={rugBorderTwistMm}
            rugBorderRoughness={rugBorderRoughness}
            rugWeave={rugWeaveKey}
            rugPile={rugPile}
            rugLayout={rugLayout}
            showRug={showRug}
            backdropColor={backdropColor}
            backdropBrightness={backdropBrightness}
          />
        </Suspense>
        </SceneErrorBoundary>
      </div>


      {/* Header */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between px-4 pt-4 sm:px-8 sm:pt-6">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Visualiser Sandbox</h1>
          <p className={cn(microLabel, "mt-2 text-muted-foreground")}>
            {projectName ? `${projectName} // ` : ""}3D Spatial Composition // {objects.length} / {MAX_OBJECTS} Objects
            {loadingProject ? " // Loading specification…" : ""}
          </p>
        </div>
        <p className={cn(microLabel, "hidden text-muted-foreground lg:block")}>Drag to orbit // Scroll to zoom</p>
      </div>

      {/* Inspector sidebar — reads the shared selection context */}
      <VisualiserInspector onRemove={removeObject} onScale={scaleObject}>
        {selected && (<>
          <Button variant="ghost" size="sm" onClick={togglePositionLock} aria-pressed={Boolean(selected.positionLocked)} aria-label="Lock object position" className="mt-3 h-8 gap-2 px-0 text-[10px] uppercase text-muted-foreground">
            {selected.positionLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {selected.positionLocked ? "Position locked" : "Lock position"}
          </Button>
          <Suspense fallback={null}>
            <PieceAngleControls
              yaw={selected.rotation?.[1] ?? 0}
              onChange={(yaw) => setObjects(current => current.map(object => object.instanceId === selected.instanceId ? { ...object, rotation: [0, yaw, 0] } : object))}
            />
          </Suspense>
          {selected.glb_url && <Suspense fallback={null}>
            <details className="mt-4 border-t border-border pt-3">
              <summary className="cursor-pointer select-none text-[10px] uppercase text-muted-foreground">
                Model orientation — import repair only
              </summary>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                Only touch these if the 3D file itself imports tipped over. To angle a piece, use Piece angle above.
              </p>
              <ModelOrientationControls
                orientation={selected.modelOrientation}
                onChange={(modelOrientation) => setObjects(current => current.map(object => object.instanceId === selected.instanceId ? { ...object, modelOrientation } : object))}
                onReset={() => setObjects(current => current.map(object => object.instanceId === selected.instanceId ? { ...object, modelOrientation: undefined, rotation: [0, 0, 0] } : object))}
              />
            </details>
          </Suspense>}

          {isBondStreetStool(selected.id) ? (
            <div className="mt-5 border-t border-foreground/10 pt-4">
              <p className={cn(microLabel, "text-muted-foreground")}>Base Finish</p>
              <div className="mt-3 flex flex-wrap gap-4">
                {BOND_STREET_BASE_FINISHES.map((material) => (
                  <button
                    key={material.id}
                    onClick={() => applyBondStreetFinish("base", material)}
                    className="w-20 shrink-0 text-left"
                    title={material.name}
                  >
                    <span
                      className={cn(
                        "block h-8 w-8",
                        (selected.baseMaterial?.id ?? BOND_STREET_BASE_FINISH.id) === material.id && "ring-1 ring-foreground ring-offset-2",
                      )}
                      style={{ backgroundColor: material.color }}
                    />
                    <span className="mt-2 block font-mono text-[8px] uppercase leading-3 tracking-[0.15em] text-muted-foreground">{material.name}</span>
                  </button>
                ))}
              </div>
              <p className={cn(microLabel, "mt-3 text-foreground")}>
                {(selected.baseMaterial ?? BOND_STREET_BASE_FINISH).name}
              </p>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className={cn(microLabel, "text-muted-foreground")}>Upholstery</p>
                {selected.upholsteryMaterial && (
                  <button className={cn(microLabel, "text-muted-foreground hover:text-foreground")} onClick={() => applyBondStreetFinish("upholstery", null)}>Clear</button>
                )}
              </div>
              <div className="mt-3 flex gap-4">
                {BOND_STREET_UPHOLSTERY_FINISHES.map((material) => (
                  <button key={material.id} onClick={() => applyBondStreetFinish("upholstery", material)} className="w-20 shrink-0 text-left" title={material.name}>
                    <img src={material.image_url ?? "/placeholder.svg"} alt="" className={cn("h-12 w-12 object-cover", selected.upholsteryMaterial?.id === material.id && "ring-1 ring-foreground ring-offset-2")} />
                    <span className="mt-2 block font-mono text-[8px] uppercase leading-3 tracking-[0.15em] text-muted-foreground">{material.name}</span>
                  </button>
                ))}
              </div>
              <p className={cn(microLabel, "mt-3 text-foreground")}>{selected.upholsteryMaterial?.name ?? "Neutral Matte · No Pattern"}</p>
            </div>
          ) : (
          <div className="mt-5 border-t border-foreground/10 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className={cn(microLabel, "text-muted-foreground")}>Material / Finish</p>
              {hasAnyFinish(selected) && (
                <Button variant="ghost" size="sm" className={cn(microLabel, "h-auto px-0 py-1 text-muted-foreground hover:text-foreground")} onClick={clearFinishes}>Clear</Button>
              )}
            </div>
            <div role="tablist" aria-label="Finish part" className="mt-3 flex flex-row items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none pb-2">
              {availableTargets.map((value) => (
                <Button variant="ghost" size="sm"
                  key={value}
                  role="tab"
                  aria-selected={effectiveTarget === value}
                  onClick={() => setFinishTarget(value)}
                  className={cn(microLabel, "h-auto shrink-0 whitespace-nowrap px-0 py-1 text-left", effectiveTarget === value ? "text-foreground underline underline-offset-4" : "text-muted-foreground hover:text-foreground")}
                >
                  {targetLabel(value, partGroupLabels)}
                </Button>
              ))}
            </div>
            <PartMappingControl productId={selected.id} />
            <input
              value={materialSearch}
              onChange={(event) => setMaterialSearch(event.target.value)}
              placeholder="Search finishes"
              aria-label="Search finishes"
              className="mt-3 w-full border-b border-foreground/10 bg-transparent pb-2 text-xs outline-none placeholder:text-muted-foreground"
            />
            <div className="mt-3 flex max-h-28 gap-3 overflow-x-auto pb-2">
              {filteredMaterials.slice(0, 24).map((material) => (
                <Button variant="ghost" key={material.id} aria-label={`Apply ${material.name} to ${targetLabel(effectiveTarget, partGroupLabels)}`} onClick={() => applyMaterial(material)} className="h-auto w-14 shrink-0 flex-col items-start gap-0 px-0 py-1 text-left" title={`${material.brand_name} — ${material.name}`}>
                  <img src={material.image_url ?? "/placeholder.svg"} alt="" className={cn("h-10 w-10 object-cover", targetMaterial?.id === material.id && "ring-1 ring-foreground ring-offset-2")} />
                  <span className="mt-1 block w-full truncate font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground">{material.name}</span>
                </Button>
              ))}
            </div>
            <p data-testid="active-finish" aria-live="polite" className={cn(microLabel, "mt-1 truncate text-foreground")}>{targetMaterial?.name ?? (effectiveTarget !== "all" && effectiveTarget !== "upholstery" && effectiveTarget !== "backrest" ? selected.material?.name : null) ?? "No finish applied"}</p>
            <FinishPresets
              object={selected}
              onRestore={(preset) => {
                setObjects((current) => current.map((object) => object.instanceId === selected.instanceId
                  ? { ...object, material: preset.material, topMaterial: preset.topMaterial, baseMaterial: preset.baseMaterial, upholsteryMaterial: preset.upholsteryMaterial, partMaterials: preset.partMaterials ?? {} }
                  : object));
              }}
            />
          </div>
          )}
        </>)}
      </VisualiserInspector>

      {/* Sourcing tray */}
      {trayOpen && (
        <CatalogDrawer products={products} loading={loadingProducts} onAdd={addObject} onClose={() => setTrayOpen(false)} />
      )}

      </div>

      {/* Dock reserves its own space: controls never cover the canvas. */}
      <div data-testid="visualiser-toolbar" role="toolbar" aria-label="Visualiser controls" className="relative z-[60] w-full shrink-0 border-t border-border bg-background px-1 pb-[env(safe-area-inset-bottom)] sm:px-3">
        <div className="flex flex-col items-stretch">
        <div className="visualiser-toolbar-row" role="group" aria-label="Scene actions" tabIndex={0}>
          <Button variant="ghost" className={toolbarButton} onClick={() => setTrayOpen((value) => !value)}>[ + Add 3D Object ]</Button>
          <span className="h-5 w-px bg-border" />
          <Button variant="ghost" className={toolbarButton} onClick={cycleDepth} disabled={!selected}>[ &#9099; Depth Stack ]</Button>
          <span className="h-5 w-px bg-border" />
          <div className="flex items-center gap-1" aria-label="Object spacing">
            <Button variant="ghost"
              className={toolbarButton}
              aria-label="Decrease spacing"
              disabled={spacing <= MIN_SLOT_SPACING}
              onClick={() => adjustSpacing(-SLOT_SPACING_STEP)}
            >
              [ &#8722;
            </Button>
            <span className={cn(microLabel, "min-w-14 text-center text-muted-foreground")} title="Distance between pieces">
              {spacing.toFixed(1)} m
            </span>
            <Button variant="ghost"
              className={toolbarButton}
              aria-label="Increase spacing"
              disabled={spacing >= MAX_SLOT_SPACING}
              onClick={() => adjustSpacing(SLOT_SPACING_STEP)}
            >
              + ]
            </Button>
            <Button variant="ghost" className={toolbarButton} onClick={applySpacingToScene} disabled={objects.length < 2}>
              [ &#8596; Respace ]
            </Button>
          </div>
          <span className="h-5 w-px bg-border" />
          <Button variant="ghost" className={toolbarButton} onClick={() => fileRef.current?.click()}>
            [ &#8593; {backdropSrc ? "Change Backdrop" : "Upload Backdrop"} ]
          </Button>
          <span className="h-5 w-px bg-border" />
          <Button variant="ghost"
            className={toolbarButton}
            onClick={downloadPresentationMockup}
            disabled={exporting}
            title="Download a clean PNG of the canvas — the floor grid is hidden during capture"
          >
            [ &#128248; {exporting ? "Exporting…" : "Export Mockup"} ]
          </Button>
          <span className="h-5 w-px bg-border" />
          <ScenePresets
            className={toolbarButton}
            current={() => ({ objects, spacing, snapToGrid, showGrid, showLabels, depthOfField, dofStrength, dofFocusSelected, backdropDataUrl, environmentSource, floorFinish, showRearWall, wallHeight, ceilingHeight, ceilingThickness, ceilingOpening, floorGlare, wallColor, wallFinish, wallCustomHex, wallFinishIntensity, rugColor: rugColorKey, rugBorderColor: rugBorderColorKey, rugBorderThicknessMm, rugBorderTwistMm, rugBorderRoughness, rugWeave: rugWeaveKey, rugPile, rugWidth, rugDepth, rugOffsetX, rugOffsetZ, showRug, backdropColor, backdropBrightness })}
            onLoad={(data) => {
              setSelectedId(null);
              setObjects(data.objects);
              setBackdrop(null);
              setBackdropDataUrl(data.backdropDataUrl ?? null);
              if (typeof data.spacing === "number") setSpacing(data.spacing);
              setSnapToGrid(data.snapToGrid === true);
              setShowGrid(data.showGrid !== false);
              setShowLabels(data.showLabels !== false);
              setDepthOfField(data.depthOfField === true);
              if (typeof data.dofStrength === "number") setDofStrength(Math.min(10, Math.max(1, data.dofStrength)));
              setDofFocusSelected(data.dofFocusSelected !== false);
              setEnvironmentSource(data.environmentSource === "studio-hdr" ? "studio-hdr" : "empty-room-exr");
              setFloorFinish(roomFloorFinish(data.floorFinish));
              setShowRearWall(data.showRearWall !== false);
              setWallHeight(clampWallHeight(data.wallHeight));
              setCeilingHeight(clampCeilingHeight(data.ceilingHeight));
              setCeilingThickness(clampCeilingThickness(data.ceilingThickness));
              setCeilingOpening(clampCeilingOpening(data.ceilingOpening));
              setFloorGlare(clampFloorGlare(data.floorGlare));
              setWallColor(roomWallColor(data.wallColor));
              setWallFinish(roomWallFinish(data.wallFinish));
              const restoredHex = normalizeHexColor(data.wallCustomHex);
              setWallCustomHex(restoredHex ?? null);
              if (restoredHex) setCustomHexDraft(restoredHex);
              setWallFinishIntensity(clampWallFinishIntensity(data.wallFinishIntensity));
              setRugColorKey(toRugColor(data.rugColor));
              setRugBorderColorKey(toRugBorderColor(data.rugBorderColor));
              setRugBorderThicknessMm(clampRugBorderThicknessMm(data.rugBorderThicknessMm));
              setRugBorderTwistMm(clampRugBorderTwistMm(data.rugBorderTwistMm));
              setRugBorderRoughness(clampRugBorderRoughness(data.rugBorderRoughness));
              setRugWeaveKey(toRugWeave(data.rugWeave));
              setRugPile(clampRugPile(data.rugPile));
              setRugWidth(clampRugSize(data.rugWidth));
              setRugDepth(clampRugSize(data.rugDepth));
              setRugOffsetX(clampRugOffset(data.rugOffsetX));
              setRugOffsetZ(clampRugOffset(data.rugOffsetZ));
              setShowRug(rugVisible(data.showRug));
              setBackdropColor(normalizeHexColor(data.backdropColor) ?? null);
              setBackdropBrightness(clampBackdropBrightness(data.backdropBrightness));
            }}
          />
          <span className="h-5 w-px bg-border" />
          <Button variant="ghost" className={toolbarButton} onClick={resetSandbox}>[ &#10005; Reset Canvas ]</Button>
        </div>
        <div className="h-px w-full bg-border" />
          <div className="visualiser-toolbar-row visualiser-toolbar-settings" role="group" aria-label="View settings" tabIndex={0}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={toolbarButton} aria-label="Room surfaces">
                  <Box className="mr-2 h-3.5 w-3.5" /> Room: {floorFinish === "oak-chevron" ? "Oak Chevron" : floorFinish === "micro-cement" ? "Micro-Cement" : "Backdrop"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="max-h-[70vh] overflow-y-auto">
                <DropdownMenuLabel>Studio backdrop</DropdownMenuLabel>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {BACKDROP_SWATCHES.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        aria-label={`Backdrop ${c.label}`}
                        title={c.label}
                        disabled={Boolean(backdropSrc)}
                        onClick={() => setBackdropColor(c.hex)}
                        className={cn("h-5 w-5 rounded-full border", (backdropColor ?? "#ffffff") === c.hex ? "border-primary ring-1 ring-primary" : "border-border", Boolean(backdropSrc) && "opacity-40")}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Custom backdrop colour"
                      title="Custom backdrop colour"
                      disabled={Boolean(backdropSrc)}
                      value={backdropColor ?? "#ffffff"}
                      onChange={(e) => setBackdropColor(normalizeHexColor(e.target.value) ?? backdropColor)}
                      className="h-5 w-5 cursor-pointer rounded-full border border-border bg-transparent p-0"
                    />
                  </div>
                  <div className="mb-1 mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Backdrop Brightness</span>
                    <span>{backdropBrightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={backdropBrightness}
                    disabled={Boolean(backdropSrc)}
                    onChange={(e) => setBackdropBrightness(clampBackdropBrightness(Number(e.target.value)))}
                    aria-label="Backdrop brightness"
                    className="w-full accent-primary"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">50% = the colour as chosen; lower darkens, higher lightens.</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Floor finish</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={floorFinish} onValueChange={(value) => setFloorFinish(roomFloorFinish(value))}>
                  <DropdownMenuRadioItem value="oak-chevron">Light Oak Chevron</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="micro-cement">Premium Micro-Cement</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="none">No Floor / Backdrop</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={showRearWall} onCheckedChange={setShowRearWall}>Plaster Rear Wall</DropdownMenuCheckboxItem>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Wall Height</span>
                    <span>{Math.round((WALL_FULL_HEIGHT_M * wallHeight) / 100 * 10) / 10} m</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={5}
                    value={wallHeight}
                    onChange={(e) => setWallHeight(clampWallHeight(Number(e.target.value)))}
                    aria-label="Wall height"
                    className="w-full accent-primary"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Lower the wall to frame the furniture display; 100% is the full-height cyclorama.</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Recessed ceiling</DropdownMenuLabel>
                <div className="space-y-3 px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      <span>Frame height</span><span>{ceilingHeight === null ? "Auto · " : ""}{(ceilingHeight ?? WALL_FULL_HEIGHT_M * wallHeight / 100 - 0.25).toFixed(2)} m</span>
                    </div>
                    <input type="range" {...CEILING_CONTROLS.height} value={ceilingHeight ?? WALL_FULL_HEIGHT_M * wallHeight / 100 - 0.25} disabled={!showRearWall || Boolean(backdrop || backdropDataUrl)} onChange={(e) => setCeilingHeight(clampCeilingHeight(Number(e.target.value)))} aria-label="Ceiling frame height" className="w-full accent-primary" />
                    <Button variant="ghost" size="sm" disabled={ceilingHeight === null} onClick={() => setCeilingHeight(null)} className="h-6 px-0 text-[10px]"><RotateCcw className="mr-1 h-3 w-3" />Follow wall height</Button>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground"><span>Frame thickness</span><span>{Math.round(ceilingThickness * 100)} cm</span></div>
                    <input type="range" min={CEILING_CONTROLS.thickness.min} max={CEILING_CONTROLS.thickness.max} step={CEILING_CONTROLS.thickness.step} value={ceilingThickness} disabled={!showRearWall || Boolean(backdrop || backdropDataUrl)} onChange={(e) => setCeilingThickness(clampCeilingThickness(Number(e.target.value)))} aria-label="Ceiling frame thickness" className="w-full accent-primary" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground"><span>Opening size</span><span>{ceilingOpening}%</span></div>
                    <input type="range" min={CEILING_CONTROLS.opening.min} max={CEILING_CONTROLS.opening.max} step={CEILING_CONTROLS.opening.step} value={ceilingOpening} disabled={!showRearWall || Boolean(backdrop || backdropDataUrl)} onChange={(e) => setCeilingOpening(clampCeilingOpening(Number(e.target.value)))} aria-label="Ceiling opening size" className="w-full accent-primary" />
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Wall colour</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={wallColor} onValueChange={(value) => setWallColor(roomWallColor(value))}>
                  {WALL_COLORS.map((c) => (
                    <DropdownMenuRadioItem key={c.key} value={c.key}>
                      <span className="mr-2 inline-block h-3 w-3 rounded-full border border-border align-middle" style={{ backgroundColor: c.hex }} />
                      {c.label}
                    </DropdownMenuRadioItem>
                  ))}
                  <DropdownMenuRadioItem value="custom">
                    <span className="mr-2 inline-block h-3 w-3 rounded-full border border-border align-middle" style={{ backgroundColor: wallColorHex("custom", wallCustomHex) }} />
                    Custom colour…
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={wallColorHex("custom", wallCustomHex)}
                      onChange={(e) => applyCustomHex(e.target.value)}
                      aria-label="Pick custom wall colour"
                      className="h-7 w-8 shrink-0 cursor-pointer rounded-sm border border-border bg-transparent p-0.5"
                    />
                    <input
                      type="text"
                      value={customHexDraft}
                      onChange={(e) => applyCustomHex(e.target.value)}
                      placeholder="#f4efe7"
                      aria-label="Custom wall colour hex"
                      className="w-full rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] uppercase"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">Any hex value — picking a colour also selects Custom.</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Wall finish</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={wallFinish} onValueChange={(value) => setWallFinish(roomWallFinish(value))}>
                  {WALL_FINISHES.map((f) => (
                    <DropdownMenuRadioItem key={f.key} value={f.key}>{f.label}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Finish Intensity</span>
                    <span>{wallFinishIntensity}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={wallFinishIntensity}
                    onChange={(e) => setWallFinishIntensity(clampWallFinishIntensity(Number(e.target.value)))}
                    aria-label="Wall finish intensity"
                    className="w-full accent-primary"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">How strongly the plaster catches light — 100% is the finish as designed, lower goes matte.</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={showRug} onCheckedChange={setShowRug} disabled={floorFinish === "none"}>Show Rug</DropdownMenuCheckboxItem>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Rug colour</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={rugColorKey} onValueChange={(v) => setRugColorKey(toRugColor(v))}>
                  {RUG_COLORS.map((c) => (
                    <DropdownMenuRadioItem key={c.key} value={c.key} disabled={floorFinish === "none"}>
                      <span className="mr-2 inline-block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: c.hex }} />
                      {c.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Rug border</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={rugBorderColorKey} onValueChange={(v) => setRugBorderColorKey(toRugBorderColor(v))}>
                  <DropdownMenuRadioItem value="match" disabled={floorFinish === "none"}>Match rug</DropdownMenuRadioItem>
                  {RUG_COLORS.map((c) => (
                    <DropdownMenuRadioItem key={c.key} value={c.key} disabled={floorFinish === "none"}>
                      <span className="mr-2 inline-block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: c.hex }} />
                      {c.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Border thickness</span>
                    <span>{rugBorderThicknessMm} mm</span>
                  </div>
                  <input type="range" min={4} max={20} step={1} value={rugBorderThicknessMm} disabled={floorFinish === "none"} onChange={(e) => setRugBorderThicknessMm(clampRugBorderThicknessMm(Number(e.target.value)))} aria-label="Rug border thickness" className="w-full accent-primary" />
                </div>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Border twist</span>
                    <span>{rugBorderTwistMm} mm</span>
                  </div>
                  <input type="range" min={10} max={60} step={1} value={rugBorderTwistMm} disabled={floorFinish === "none"} onChange={(e) => setRugBorderTwistMm(clampRugBorderTwistMm(Number(e.target.value)))} aria-label="Rug border twist spacing" className="w-full accent-primary" />
                </div>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Border roughness</span>
                    <span>{rugBorderRoughness}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={5} value={rugBorderRoughness} disabled={floorFinish === "none"} onChange={(e) => setRugBorderRoughness(clampRugBorderRoughness(Number(e.target.value)))} aria-label="Rug border roughness" className="w-full accent-primary" />
                  <p className="mt-1 text-[10px] text-muted-foreground">Lower = glossier cord with sharper highlights; higher = matte.</p>
                </div>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Rug weave</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={rugWeaveKey} onValueChange={(v) => setRugWeaveKey(toRugWeave(v))}>
                  {RUG_WEAVES.map((w) => (
                    <DropdownMenuRadioItem key={w.key} value={w.key} disabled={floorFinish === "none"}>{w.label}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Rug Pile</span>
                    <span>{rugPile}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={rugPile}
                    disabled={floorFinish === "none"}
                    onChange={(e) => setRugPile(clampRugPile(Number(e.target.value)))}
                    aria-label="Rug pile depth"
                    className="w-full accent-primary"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">0% is a low flat pile, 100% a deep plush texture. The rug shows when a floor is selected.</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Rug size &amp; position</DropdownMenuLabel>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Rug Width</span>
                    <span>{rugWidth == null ? "Auto" : `${rugWidth.toFixed(1)} m`}</span>
                  </div>
                  <input type="range" min={1} max={8} step={0.1} value={rugWidth ?? 4.5} disabled={floorFinish === "none"} onChange={(e) => setRugWidth(clampRugSize(Number(e.target.value)))} aria-label="Rug width" className="w-full accent-primary" />
                </div>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Rug Depth</span>
                    <span>{rugDepth == null ? "Auto" : `${rugDepth.toFixed(1)} m`}</span>
                  </div>
                  <input type="range" min={1} max={8} step={0.1} value={rugDepth ?? 3.5} disabled={floorFinish === "none"} onChange={(e) => setRugDepth(clampRugSize(Number(e.target.value)))} aria-label="Rug depth" className="w-full accent-primary" />
                </div>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Move Left / Right</span>
                    <span>{`${rugOffsetX > 0 ? "+" : ""}${rugOffsetX.toFixed(1)} m`}</span>
                  </div>
                  <input type="range" min={-4} max={4} step={0.1} value={rugOffsetX} disabled={floorFinish === "none"} onChange={(e) => setRugOffsetX(clampRugOffset(Number(e.target.value)))} aria-label="Rug left right position" className="w-full accent-primary" />
                </div>
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Move Back / Front</span>
                    <span>{`${rugOffsetZ > 0 ? "+" : ""}${rugOffsetZ.toFixed(1)} m`}</span>
                  </div>
                  <input type="range" min={-4} max={4} step={0.1} value={rugOffsetZ} disabled={floorFinish === "none"} onChange={(e) => setRugOffsetZ(clampRugOffset(Number(e.target.value)))} aria-label="Rug back front position" className="w-full accent-primary" />
                </div>
                <div className="px-2 pb-2">
                  <button type="button" disabled={floorFinish === "none"} onClick={() => { setRugWidth(null); setRugDepth(null); setRugOffsetX(0); setRugOffsetZ(0); }} className="w-full border border-border px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground disabled:opacity-40">Auto-fit rug to furniture</button>
                  <p className="mt-1 text-[10px] text-muted-foreground">Auto sizes the rug around every piece and centres it; moves are measured from the layout centre.</p>
                </div>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Floor Glare</span>
                    <span>{floorGlare}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={floorGlare}
                    onChange={(e) => setFloorGlare(clampFloorGlare(Number(e.target.value)))}
                    aria-label="Floor glare intensity"
                    className="w-full accent-primary"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Lower = matte floor, reflections fade; texture stays visible.</p>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost"
              className={cn(toolbarButton, snapToGrid && "border-primary text-primary")}
              onClick={() => setSnapToGrid((value) => !value)}
              aria-pressed={snapToGrid}
              title="Snap dragged pieces to a 0.25 m grid"
            >
              [ &#8862; Snap Grid: {snapToGrid ? "On" : "Off"} ]
            </Button>
            <Button variant="ghost"
              className={cn(toolbarButton, showGrid ? "border-primary text-primary" : "opacity-60")}
              onClick={() => setShowGrid((value) => !value)}
              aria-pressed={showGrid}
              title="Show or hide the faint floor grid — hide it when using a room photo backdrop"
            >
              [ &#127760; Show Grid: {showGrid ? "On" : "Off"} ]
            </Button>
            <Button variant="ghost"
              className={cn(toolbarButton, showLabels ? "border-primary text-primary" : "opacity-60")}
              onClick={() => setShowLabels((value) => !value)}
              aria-pressed={showLabels}
              title="Show or hide the floating name labels and lock badges above pieces"
            >
              [ &#128065;&#65039; Show Labels: {showLabels ? "On" : "Off"} ]
            </Button>
            <Button variant="ghost"
              className={cn(toolbarButton, environmentSource === "empty-room-exr" ? "border-primary text-primary" : "opacity-60")}
              onClick={() => setEnvironmentSource((value) => (value === "empty-room-exr" ? "studio-hdr" : "empty-room-exr"))}
              aria-pressed={environmentSource === "empty-room-exr"}
              title="Switch the environment reflections between the uploaded empty-room EXR and the built-in studio HDRI"
            >
              [ &#9728; Lighting: {environmentSource === "empty-room-exr" ? "Empty Room" : "Studio"} ]
            </Button>
            <LocalExrButton className={toolbarButton} onLoaded={() => setEnvironmentSource("empty-room-exr")} />
            <Button variant="ghost"
              className={cn(toolbarButton, pathTrace ? "border-primary text-primary" : "opacity-60")}
              onClick={() => { setPtSamples(0); setPathTrace((v) => !v); }}
              aria-pressed={pathTrace}
              title="Offline-quality path tracing: real light bounces and reflections, refining while the camera is still"
            >
              [ &#10022; Photoreal Render: {pathTrace ? `On · ${ptSamples}${ptQuality.maxSamples ? `/${ptQuality.maxSamples}` : ""} spp` : "Off"} ]
            </Button>
            {pathTrace && (
              <>
                <label className={cn(toolbarButton, "gap-1")} title="Resolution used while the camera is moving">
                  Preview
                  <select aria-label="Preview quality" className="bg-transparent outline-none" value={ptQuality.previewScale} onChange={(e) => setPtQuality({ previewScale: Number(e.target.value) })}>
                    <option value={0.15}>Draft</option><option value={0.25}>Low</option><option value={0.5}>Medium</option><option value={1}>Full</option>
                  </select>
                </label>
                <label className={cn(toolbarButton, "gap-1")} title="Stop refining after this many samples">
                  Samples
                  <select aria-label="Final sample count" className="bg-transparent outline-none" value={ptQuality.maxSamples} onChange={(e) => { setPtSamples(0); setPtQuality({ maxSamples: Number(e.target.value) }); }}>
                    <option value={64}>64</option><option value={256}>256</option><option value={512}>512</option><option value={1024}>1024</option><option value={2048}>2048</option><option value={0}>Unlimited</option>
                  </select>
                </label>
                <label className={cn(toolbarButton, "gap-1")} title="Final render resolution relative to the screen">
                  Resolution
                  <select aria-label="Render resolution" className="bg-transparent outline-none" value={ptQuality.renderScale} onChange={(e) => { setPtSamples(0); setPtQuality({ renderScale: Number(e.target.value) }); }}>
                    <option value={0.5}>50%</option><option value={0.75}>75%</option><option value={1}>100%</option><option value={1.5}>150%</option><option value={2}>200%</option>
                  </select>
                </label>
                <label className={cn(toolbarButton, "gap-1")} title="HDRI lighting strength in the photoreal render">
                  Light
                  <input
                    type="range"
                    aria-label="Lighting strength"
                    min={0.2}
                    max={3}
                    step={0.1}
                    className="w-20 accent-current"
                    value={ptQuality.lightIntensity}
                    onChange={(e) => setPtQuality({ lightIntensity: Number(e.target.value) })}
                  />
                  <span className="tabular-nums">{Math.round(ptQuality.lightIntensity * 100)}%</span>
                </label>
              </>
            )}
            <Button variant="ghost"
              className={cn(toolbarButton, depthOfField ? "border-primary text-primary" : "opacity-60")}
              onClick={() => setDepthOfField((value) => !value)}
              aria-pressed={depthOfField}
              title="Blur the background — focuses on the selected piece, or the centre of the view"
            >
              [ &#9673; Depth of Field: {depthOfField ? "On" : "Off"} ]
            </Button>
            {depthOfField && (
              <Button variant="ghost"
                className={cn(toolbarButton, dofFocusSelected ? "border-primary text-primary" : "opacity-60")}
                onClick={() => setDofFocusSelected((value) => !value)}
                aria-pressed={dofFocusSelected}
                title="Click a piece to keep it sharp while the background blurs — off keeps focus at the centre of the view"
              >
                [ &#10022; Focus: {dofFocusSelected ? "Clicked Piece" : "Centre"} ]
              </Button>
            )}
            {depthOfField && (
              <label className="visualiser-toolbar-blur flex items-center gap-2" title="How softly the background is blurred">
                <span className={cn(microLabel, "text-muted-foreground")}>Blur</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={dofStrength}
                  onChange={(event) => setDofStrength(Number(event.target.value))}
                  className="h-1 w-24 cursor-pointer accent-primary"
                  aria-label="Background blur strength"
                />
                <span className={cn(microLabel, "w-4 text-muted-foreground")}>{dofStrength}</span>
              </label>
            )}
            <EnvironmentStatusChip />
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => uploadBackdrop(event.target.files?.[0] ?? null)}
      />
    </div>
    </VisualiserSelectionProvider>
  );
};

export default TradeVisualiser;

// Shares the literal with VisualiserCanvas on purpose — importing that module
// here would pull the whole three.js canvas into the main bundle.
const ENV_STATUS_EVENT = "ma-visualiser-env";

type EnvStatus = { source: "empty-room-exr" | "studio-hdr" | "local"; exr?: "missing" | "unreadable" };

/** Confirms which HDRI source the Visualiser is using — the empty-room EXR when valid. */
function EnvironmentStatusChip() {
  const [status, setStatus] = useState<EnvStatus | null>(null);
  useEffect(() => {
    const onStatus = (event: Event) => setStatus((event as CustomEvent<EnvStatus>).detail);
    window.addEventListener(ENV_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(ENV_STATUS_EVENT, onStatus);
  }, []);
  if (!status) return null;
  const label = status.source === "empty-room-exr"
    ? "HDR: Empty Room"
    : status.source === "studio-hdr"
      ? status.exr ? `HDR: Studio · EXR ${status.exr}` : "HDR: Studio"
      : "HDR: Local";
  const title = status.source === "empty-room-exr"
    ? "Environment reflections load from /images/_empty_room_3.exr — present and readable"
    : status.source === "studio-hdr"
      ? status.exr === "missing"
        ? "The empty-room EXR (/images/_empty_room_3.exr) is not present — the built-in studio HDRI is in use"
        : status.exr === "unreadable"
          ? "The empty-room EXR is present but not a readable EXR file — the built-in studio HDRI is in use"
          : "Built-in studio HDRI in use"
      : "No HDRI could be loaded — local studio reflections are in use";
  return (
    <span
      className={cn(
        microLabel,
        "hidden lg:inline-flex items-center rounded-full border border-border px-2.5 py-1",
        status.source === "empty-room-exr" ? "border-primary text-primary" : "text-muted-foreground",
      )}
      title={title}
    >
      {label}
    </span>
  );
}
