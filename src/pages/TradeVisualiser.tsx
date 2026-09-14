import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, PerspectiveCamera, Html } from "@react-three/drei";
import { Box, ImageUp, Loader2, Plus, RotateCcw, Search, X } from "lucide-react";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import { DIMENSIONS_PLACEHOLDER, formatDimensions, resolveDimensions } from "@/lib/productDimensions";
import SceneObject, { type PlacedObject } from "@/components/trade/visualiser/SceneObject";
import { toast } from "sonner";
import { useConciergeSession } from "@/hooks/useConciergeSession";
import { useVisualiserMaterial, type VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import {
  BOND_STREET_BASE_FINISH,
  BOND_STREET_UPHOLSTERY_FINISHES,
  isBondStreetStool,
} from "@/lib/visualiserProductFinishes";

type CatalogueProduct = {
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  category: string;
  dimensions: string | null;
  glb_url: string | null;
};

type PersistedSandbox = {
  backdropDataUrl: string | null;
  backdrop: string | null;
  objects: PlacedObject[];
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
      objects: Array.isArray(parsed.objects) ? parsed.objects : [],
    };
  } catch {
    return { backdrop: null, backdropDataUrl: null, objects: [] };
  }
};

const SceneLoader = () => (
  <Html center>
    <span className={cn(microLabel, "text-muted-foreground")}>Loading asset…</span>
  </Html>
);

const TradeVisualiser = () => {
  const initial = useMemo(readSandbox, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [objects, setObjects] = useState<PlacedObject[]>(initial.objects);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [only3d, setOnly3d] = useState(false);
  const [backdrop, setBackdrop] = useState<string | null>(initial.backdrop);
  const [backdropDataUrl, setBackdropDataUrl] = useState<string | null>(initial.backdropDataUrl);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [materials, setMaterials] = useState<VisualiserMaterial[]>([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const { activeMaterial, setActiveMaterial } = useVisualiserMaterial();
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
      const columns = "id, product_name, brand_name, image_url, category, dimensions, glb_url";
      const base = () => supabase
        .from("trade_products")
        .select(columns)
        .eq("is_active", true)
        .eq("is_hidden", false)
        .not("image_url", "is", null);
      const [recent, models] = await Promise.all([
        base().order("updated_at", { ascending: false }).limit(180),
        base().not("glb_url", "is", null).order("product_name").limit(120),
      ]);
      if (cancelled) return;
      if (recent.error || models.error) toast.error("The collection index could not be loaded.");
      const merged = new Map<string, CatalogueProduct>();
      for (const product of [...(models.data ?? []), ...(recent.data ?? [])] as CatalogueProduct[]) {
        merged.set(product.id, product);
      }
      setProducts([...merged.values()]);
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
      }));
    } catch {
      /* quota exceeded — composition stays in memory */
    }
  }, [backdrop, backdropDataUrl, objects]);

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

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      if (only3d && !product.glb_url) return false;
      if (!query) return true;
      return `${product.product_name} ${product.brand_name} ${product.category}`.toLowerCase().includes(query);
    });
  }, [products, search, only3d]);

  const modelCount = useMemo(() => products.filter((product) => product.glb_url).length, [products]);
  const selected = objects.find((object) => object.instanceId === selectedId) ?? null;

  const addObject = (product: CatalogueProduct) => {
    if (objects.length >= MAX_OBJECTS) {
      toast.error(`This composition can hold up to ${MAX_OBJECTS} objects.`);
      return;
    }
    const index = objects.length;
    const next: PlacedObject = {
      instanceId: `${product.id}-${Date.now()}`,
      id: product.id,
      product_name: product.product_name,
      brand_name: product.brand_name,
      image_url: product.image_url ? optimizeImageUrl(product.image_url, CUTOUT_TRANSFORMS) : null,
      dimensions: product.dimensions,
      glb_url: product.glb_url,
      position: [((index % 4) - 1.5) * 1.4, 0, Math.floor(index / 4) * -1.4],
      rotation: [0, 0, 0],
      scale: 1,
      material: isBondStreetStool(product.id) ? null : activeMaterial,
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
      object.instanceId === instanceId ? { ...object, position, rotation } : object
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

  const spinObject = (instanceId: string, degrees: number) => {
    setObjects((current) => current.map((object) => (
      object.instanceId === instanceId
        ? { ...object, rotation: [object.rotation[0], object.rotation[1] + THREE.MathUtils.degToRad(degrees), object.rotation[2]] }
        : object
    )));
  };

  const applyMaterial = (material: VisualiserMaterial) => {
    setActiveMaterial(material);
    if (!selectedId) {
      toast.success(`${material.name} is ready for the next object.`);
      return;
    }
    setObjects((current) => current.map((object) => (
      object.instanceId === selectedId ? { ...object, material } : object
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
    const query = materialSearch.trim().toLowerCase();
    if (!query) return materials;
    return materials.filter((material) => (
      `${material.name} ${material.brand_name} ${material.category} ${material.material_type ?? ""}`.toLowerCase().includes(query)
    ));
  }, [materialSearch, materials]);

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
  const toolbarButton = cn(
    "font-mono text-[10px] uppercase tracking-[0.15em]",
    "flex items-center gap-2 px-4 py-2.5 text-foreground/80 transition-colors duration-200 hover:text-foreground hover:bg-foreground/[0.04] disabled:opacity-40",
  );

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden bg-[hsl(var(--visualiser-canvas))] md:h-[calc(100dvh-4rem)]">
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

      <div className="absolute inset-0 z-10">
        <Canvas shadows gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} dpr={[1, 2]} onPointerMissed={() => setSelectedId(null)}>
          <PerspectiveCamera makeDefault fov={45} position={[4.5, 3.2, 6]} near={0.1} far={200} />
          <OrbitControls
            makeDefault
            enabled={orbitEnabled}
            enablePan
            enableDamping
            dampingFactor={0.08}
            minDistance={1.5}
            maxDistance={24}
            maxPolarAngle={Math.PI / 2.05}
            target={[0, 0.6, 0]}
          />

          <ambientLight intensity={0.55} />
          <directionalLight
            position={[6, 9, 5]}
            intensity={1.5}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={40}
            shadow-camera-left={-12}
            shadow-camera-right={12}
            shadow-camera-top={12}
            shadow-camera-bottom={-12}
            shadow-bias={-0.0005}
          />
          <hemisphereLight args={["#ffffff", "#d8d3cb", 0.35]} />

          <ContactShadows
            position={[0, 0.002, 0]}
            scale={40}
            opacity={backdropSrc ? 0.5 : 0.32}
            blur={1}
            far={12}
            resolution={1024}
            depthWrite={false}
          />
          {!backdropSrc && (
            <gridHelper args={[40, 40, "#dedad2", "#ebe8e2"]} position={[0, -0.001, 0]} />
          )}

          <Suspense fallback={<SceneLoader />}>
            {objects.map((object) => (
              <SceneObject
                key={object.instanceId}
                object={object}
                selected={object.instanceId === selectedId}
                onSelect={setSelectedId}
                onTransform={transformObject}
                onDragStateChange={(dragging) => setOrbitEnabled(!dragging)}
              />
            ))}
          </Suspense>
        </Canvas>
      </div>

      {/* Header */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between px-8 pt-6">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Visualiser Sandbox</h1>
          <p className={cn(microLabel, "mt-2 text-muted-foreground")}>
            3D Spatial Composition // {objects.length} / {MAX_OBJECTS} Objects
          </p>
        </div>
        <p className={cn(microLabel, "text-muted-foreground")}>Drag to orbit // Scroll to zoom</p>
      </div>

      {/* Selected object panel */}
      {selected && (
        <div className="absolute right-8 top-24 z-[60] w-64 border-t border-foreground/15 bg-white/90 px-5 py-4 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={cn(microLabel, "text-muted-foreground")}>{selected.brand_name}</p>
              <p className="mt-1 font-serif text-base leading-tight text-foreground">{selected.product_name}</p>
            </div>
            <button aria-label="Remove object" onClick={() => removeObject(selected.instanceId)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className={cn(microLabel, "mt-3 text-muted-foreground")}>
            {formatDimensions(resolveDimensions({ dimensions: selected.dimensions })) ?? DIMENSIONS_PLACEHOLDER}
          </p>

          <label className={cn(microLabel, "mt-5 block text-muted-foreground")}>Scale · {Math.round(selected.scale * 100)}%</label>
          <input
            type="range"
            aria-label="Scale object"
            min={MIN_SCALE * 100}
            max={MAX_SCALE * 100}
            value={Math.round(selected.scale * 100)}
            onChange={(event) => scaleObject(selected.instanceId, Number(event.target.value) / 100)}
            className="mt-2 w-full accent-foreground"
          />

          <div className="mt-4 flex items-center gap-4">
            <button className={cn(microLabel, "text-muted-foreground hover:text-foreground")} onClick={() => spinObject(selected.instanceId, -45)}>Spin −45°</button>
            <button className={cn(microLabel, "text-muted-foreground hover:text-foreground")} onClick={() => spinObject(selected.instanceId, 45)}>Spin +45°</button>
          </div>
          <p className={cn(microLabel, "mt-4 text-muted-foreground/70")}>Drag the red · blue arrows to slide on the floor plane, or drag the piece directly. Spin buttons rotate.</p>

          {isBondStreetStool(selected.id) ? (
            <div className="mt-5 border-t border-foreground/10 pt-4">
              <p className={cn(microLabel, "text-muted-foreground")}>Base Finish</p>
              <button
                onClick={() => applyBondStreetFinish("base", BOND_STREET_BASE_FINISH)}
                className="mt-3 flex w-full items-center gap-3 text-left"
              >
                <span className={cn("h-8 w-8 shrink-0 bg-[#655347]", selected.baseMaterial?.id === BOND_STREET_BASE_FINISH.id && "ring-1 ring-foreground ring-offset-2")} />
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-foreground">Powdercoated Bronze Metal Swivel</span>
              </button>

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
              {selected.material && (
                <button className={cn(microLabel, "text-muted-foreground hover:text-foreground")} onClick={() => setObjects((current) => current.map((object) => object.instanceId === selected.instanceId ? { ...object, material: null } : object))}>Clear</button>
              )}
            </div>
            <input
              value={materialSearch}
              onChange={(event) => setMaterialSearch(event.target.value)}
              placeholder="Search finishes"
              aria-label="Search finishes"
              className="mt-3 w-full border-b border-foreground/10 bg-transparent pb-2 text-xs outline-none placeholder:text-muted-foreground"
            />
            <div className="mt-3 flex max-h-28 gap-3 overflow-x-auto pb-2">
              {filteredMaterials.slice(0, 24).map((material) => (
                <button key={material.id} onClick={() => applyMaterial(material)} className="w-14 shrink-0 text-left" title={`${material.brand_name} — ${material.name}`}>
                  <img src={material.image_url ?? "/placeholder.svg"} alt="" className={cn("h-10 w-10 object-cover", selected.material?.id === material.id && "ring-1 ring-foreground ring-offset-2")} />
                  <span className="mt-1 block truncate font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground">{material.name}</span>
                </button>
              ))}
            </div>
            <p className={cn(microLabel, "mt-1 truncate text-foreground")}>{selected.material?.name ?? activeMaterial?.name ?? "No active finish"}</p>
          </div>
          )}
        </div>
      )}

      {/* Sourcing tray */}
      {trayOpen && (
        <div className="absolute bottom-28 left-1/2 z-[60] w-[calc(100%-64px)] max-w-[1040px] -translate-x-1/2 border-t border-foreground/15 bg-white/95 px-6 py-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className={cn(microLabel, "text-muted-foreground")}>Designer Collection Index</p>
            <div className="flex items-center gap-4">
              <button className={cn(microLabel, only3d ? "text-foreground" : "text-muted-foreground hover:text-foreground")} onClick={() => setOnly3d((value) => !value)}>
                3D Models Only ({modelCount})
              </button>
              <button aria-label="Close index" onClick={() => setTrayOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 border-b border-foreground/10 pb-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the collection"
              aria-label="Search the collection"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-5 flex gap-5 overflow-x-auto pb-2">
            {loadingProducts && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!loadingProducts && filteredProducts.length === 0 && (
              <p className={cn(microLabel, "text-muted-foreground")}>No pieces match this search.</p>
            )}
            {filteredProducts.slice(0, 60).map((product) => (
              <button
                key={product.id}
                onClick={() => addObject(product)}
                className="group w-32 shrink-0 text-left"
              >
                <div className="relative h-28 w-32">
                  {product.image_url && (
                    <img
                      src={optimizeImageUrl(product.image_url, CUTOUT_TRANSFORMS)}
                      alt={product.product_name}
                      loading="lazy"
                      className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  {product.glb_url && (
                    <span className={cn(microLabel, "absolute right-0 top-0 flex items-center gap-1 text-foreground")}>
                      <Box className="h-3 w-3" /> 3D
                    </span>
                  )}
                </div>
                <p className={cn(microLabel, "mt-2 truncate text-muted-foreground")}>{product.brand_name}</p>
                <p className="truncate text-xs text-foreground">{product.product_name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating toolbar */}
      <div className="absolute bottom-8 left-1/2 z-[60] -translate-x-1/2">
        <div className="flex items-center gap-1 border border-[#E5E5E5] bg-[#FFFFFF] px-5 py-2 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.15)] backdrop-blur-sm">
          <button className={toolbarButton} onClick={() => setTrayOpen((value) => !value)}>
            <Plus className="h-3.5 w-3.5" /> Add Object
          </button>
          <span className="h-6 w-px bg-[#E5E5E5]" />
          <button className={toolbarButton} onClick={() => fileRef.current?.click()}>
            <ImageUp className="h-3.5 w-3.5" /> {backdropSrc ? "Change Backdrop" : "Upload Canvas Backdrop"}
          </button>
          <span className="h-6 w-px bg-[#E5E5E5]" />
          <button className={toolbarButton} onClick={resetSandbox}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset Sandbox
          </button>
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
  );
};

export default TradeVisualiser;
