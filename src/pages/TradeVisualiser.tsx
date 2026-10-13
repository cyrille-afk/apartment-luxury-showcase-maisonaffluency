import { parseDimensionString } from "@/lib/productDimensions";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { finishTargetsFromParts, getPartMaterial, hasAnyFinish, materialFitsTarget, targetLabel, withPartMaterial, type FinishPart, type FinishTarget } from "@/lib/visualiserFinishTargets";
import { findProductSchema, schemaFits, schemaLabels, schemaTargets } from "@/lib/visualiserProductSchema";
import PartMappingControl from "@/components/trade/visualiser/PartMappingControl";
import { usePartGroupLabels } from "@/lib/visualiserPartMapping";
import {
  pickFootprintSlot,
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
import { downloadDataUrl, mockupFilename, nextPaintedFrame } from "@/lib/visualiserExport";
import { Button } from "@/components/ui/button";
import { visualiserDimensions } from "@/lib/visualiserProductMetadata";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import { VisualiserSelectionProvider } from "@/components/trade/visualiser/VisualiserSelectionContext";
import VisualiserInspector from "@/components/trade/visualiser/VisualiserInspector";
import CatalogDrawer from "@/components/trade/visualiser/CatalogDrawer";
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

type PersistedSandbox = {
  backdropDataUrl: string | null;
  backdrop: string | null;
  objects: PlacedObject[];
  projectId?: string | null;
  spacing?: number;
  snapToGrid?: boolean;
  showGrid?: boolean;
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
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        backdrop: backdrop?.startsWith("blob:") ? null : backdrop,
        backdropDataUrl,
        objects,
        projectId,
        spacing,
        snapToGrid,
        showGrid,
      }));
    } catch {
      /* quota exceeded — composition stays in memory */
    }
  }, [backdrop, backdropDataUrl, objects, projectId, spacing, snapToGrid, showGrid]);

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
    const reader = new FileReader();
    reader.onload = () => setBackdropDataUrl(typeof reader.result === "string" ? reader.result : null);
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
  const handleExportMockup = async () => {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas || exporting) return;
    setExporting(true);
    const hadGrid = showGrid;
    if (hadGrid) setShowGrid(false);
    await nextPaintedFrame();
    await nextPaintedFrame();
    try {
      downloadDataUrl(canvas.toDataURL("image/png"), mockupFilename());
      toast.success("Mockup exported.");
    } catch {
      toast.error("Could not export the mockup.");
    }
    if (hadGrid) setShowGrid(true);
    setExporting(false);
  };

  const toolbarButton = cn(
    "font-mono text-[10px] uppercase tracking-[0.15em]",
    "flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-foreground/80 transition-colors duration-200 hover:text-foreground hover:bg-foreground/[0.04] disabled:opacity-40",
  );

  return (
    <VisualiserSelectionProvider objects={objects} selectedId={selectedId} setSelectedId={setSelectedId}>
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#F9F8F6]">
      <Helmet>
        <title>Visualiser Sandbox | Maison Affluency Trade</title>
        <meta name="description" content="Compose interiors in a live 3D sandbox with collectible design assets." />
        <meta name="robots" content="noindex" />
      </Helmet>

      {backdropSrc && (
        <img
          src={backdropSrc}
          alt=""
          aria-hidden
          className="absolute inset-0 z-0 h-full w-full object-cover object-center"
        />
      )}

      <div ref={canvasWrapRef} className="absolute inset-0 z-10">
        <Suspense fallback={<CanvasLoader />}>
          <VisualiserCanvas
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
          />
        </Suspense>
      </div>


      {/* Header */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between px-8 pt-6">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Visualiser Sandbox</h1>
          <p className={cn(microLabel, "mt-2 text-muted-foreground")}>
            {projectName ? `${projectName} // ` : ""}3D Spatial Composition // {objects.length} / {MAX_OBJECTS} Objects
            {loadingProject ? " // Loading specification…" : ""}
          </p>
        </div>
        <p className={cn(microLabel, "text-muted-foreground")}>Drag to orbit // Scroll to zoom</p>
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
            <div role="tablist" aria-label="Finish part" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              {availableTargets.map((value) => (
                <Button variant="ghost" size="sm"
                  key={value}
                  role="tab"
                  aria-selected={effectiveTarget === value}
                  onClick={() => setFinishTarget(value)}
                  className={cn(microLabel, "h-auto whitespace-normal px-0 py-1 text-left", effectiveTarget === value ? "text-foreground underline underline-offset-4" : "text-muted-foreground hover:text-foreground")}
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
                  <span className="mt-1 block truncate font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground">{material.name}</span>
                </Button>
              ))}
            </div>
            <p data-testid="active-finish" aria-live="polite" className={cn(microLabel, "mt-1 truncate text-foreground")}>{targetMaterial?.name ?? (effectiveTarget !== "all" && effectiveTarget !== "upholstery" ? selected.material?.name : null) ?? "No finish applied"}</p>
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

      {/* Floating executive console */}
      <div className="absolute bottom-10 left-1/2 z-[60] -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-[#FFFFFF] px-4 py-2 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.15)]">
          <button className={toolbarButton} onClick={() => setTrayOpen((value) => !value)}>[ + Add 3D Object ]</button>
          <span className="h-5 w-px bg-[#E5E5E5]" />
          <button className={toolbarButton} onClick={cycleDepth} disabled={!selected}>[ &#9099; Depth Stack ]</button>
          <span className="h-5 w-px bg-[#E5E5E5]" />
          <div className="flex items-center gap-1" aria-label="Object spacing">
            <button
              className={toolbarButton}
              aria-label="Decrease spacing"
              disabled={spacing <= MIN_SLOT_SPACING}
              onClick={() => adjustSpacing(-SLOT_SPACING_STEP)}
            >
              [ &#8722;
            </button>
            <span className={cn(microLabel, "min-w-14 text-center text-muted-foreground")} title="Distance between pieces">
              {spacing.toFixed(1)} m
            </span>
            <button
              className={toolbarButton}
              aria-label="Increase spacing"
              disabled={spacing >= MAX_SLOT_SPACING}
              onClick={() => adjustSpacing(SLOT_SPACING_STEP)}
            >
              + ]
            </button>
            <button className={toolbarButton} onClick={applySpacingToScene} disabled={objects.length < 2}>
              [ &#8596; Respace ]
            </button>
            <button
              className={cn(toolbarButton, snapToGrid && "border-primary text-primary")}
              onClick={() => setSnapToGrid((value) => !value)}
              aria-pressed={snapToGrid}
              title="Snap dragged pieces to a 0.25 m grid"
            >
              [ &#8862; Snap Grid: {snapToGrid ? "On" : "Off"} ]
            </button>
            <button
              className={cn(toolbarButton, showGrid ? "border-primary text-primary" : "opacity-60")}
              onClick={() => setShowGrid((value) => !value)}
              aria-pressed={showGrid}
              title="Show or hide the faint floor grid — hide it when using a room photo backdrop"
            >
              [ &#127760; Show Grid: {showGrid ? "On" : "Off"} ]
            </button>
          </div>
          <span className="h-5 w-px bg-[#E5E5E5]" />
          <button className={toolbarButton} onClick={() => fileRef.current?.click()}>
            [ &#8593; {backdropSrc ? "Change Canvas Backdrop" : "Upload Canvas Backdrop"} ]
          </button>
          <span className="h-5 w-px bg-[#E5E5E5]" />
          <button
            className={toolbarButton}
            onClick={handleExportMockup}
            disabled={exporting}
            title="Download a clean PNG of the canvas — the floor grid is hidden during capture"
          >
            [ &#128248; {exporting ? "Exporting…" : "Export Mockup"} ]
          </button>
          <span className="h-5 w-px bg-[#E5E5E5]" />
          <button className={toolbarButton} onClick={resetSandbox}>[ &#10005; Reset Canvas ]</button>
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
