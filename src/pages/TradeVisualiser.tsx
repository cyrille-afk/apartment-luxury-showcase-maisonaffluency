import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ImageUp, Layers3, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import { toast } from "sonner";

type CatalogueProduct = {
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  category: string;
};

type CanvasObject = CatalogueProduct & {
  instanceId: string;
  x: number;
  y: number;
  scale: number;
  z: number;
};

type PersistedSandbox = {
  backdrop: string | null;
  backdropDataUrl: string | null;
  objects: CanvasObject[];
};

const STORAGE_KEY = "trade-visualiser-sandbox-v2";

const loadSandbox = (): PersistedSandbox => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}") as Partial<PersistedSandbox>;
    return {
      backdrop: parsed.backdrop?.startsWith("blob:") ? parsed.backdropDataUrl ?? null : parsed.backdrop ?? null,
      backdropDataUrl: parsed.backdropDataUrl ?? null,
      objects: Array.isArray(parsed.objects) ? parsed.objects : [],
    };
  } catch {
    return { backdrop: null, backdropDataUrl: null, objects: [] };
  }
};

const TradeVisualiser = () => {
  const initial = useRef(loadSandbox()).current;
  const [backdrop, setBackdrop] = useState<string | null>(initial.backdrop);
  const [backdropDataUrl, setBackdropDataUrl] = useState<string | null>(initial.backdropDataUrl);
  const [objects, setObjects] = useState<CanvasObject[]>(initial.objects);
  const [selectedId, setSelectedId] = useState<string | null>(initial.objects.at(-1)?.instanceId ?? null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, category")
        .eq("is_active", true)
        .eq("is_hidden", false)
        .not("image_url", "is", null)
        .order("updated_at", { ascending: false })
        .limit(180);
      if (cancelled) return;
      if (error) toast.error("The collection index could not be loaded.");
      setProducts((data ?? []) as CatalogueProduct[]);
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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ backdrop: null, backdropDataUrl: null, objects }));
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
    if (!query) return products;
    return products.filter((product) =>
      `${product.product_name} ${product.brand_name} ${product.category}`.toLowerCase().includes(query),
    );
  }, [products, search]);

  const selected = objects.find((object) => object.instanceId === selectedId) ?? null;

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

  const addObject = (product: CatalogueProduct) => {
    const count = objects.length;
    const next: CanvasObject = {
      ...product,
      instanceId: `${product.id}-${Date.now()}`,
      x: 38 + ((count * 11) % 28),
      y: 35 + ((count * 8) % 25),
      scale: 1,
      z: Math.max(0, ...objects.map((object) => object.z)) + 1,
    };
    setObjects((current) => [...current, next]);
    setSelectedId(next.instanceId);
    setSourceOpen(false);
  };

  const moveLayer = (direction: "up" | "down") => {
    if (!selectedId) return;
    setObjects((current) => current.map((object) =>
      object.instanceId === selectedId
        ? { ...object, z: Math.max(0, object.z + (direction === "up" ? 1 : -1)) }
        : object,
    ));
  };

  const resizeSelected = (amount: number) => {
    if (!selectedId) return;
    setObjects((current) => current.map((object) =>
      object.instanceId === selectedId
        ? { ...object, scale: Math.min(1.8, Math.max(0.55, object.scale + amount)) }
        : object,
    ));
  };

  const onPointerDown = (event: React.PointerEvent, object: CanvasObject) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragRef.current = {
      id: object.instanceId,
      offsetX: event.clientX - rect.left - (object.x / 100) * rect.width,
      offsetY: event.clientY - rect.top - (object.y / 100) * rect.height,
    };
    setSelectedId(object.instanceId);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const canvas = canvasRef.current;
    const drag = dragRef.current;
    if (!canvas || !drag) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left - drag.offsetX) / rect.width) * 100;
    const y = ((event.clientY - rect.top - drag.offsetY) / rect.height) * 100;
    setObjects((current) => current.map((object) =>
      object.instanceId === drag.id
        ? { ...object, x: Math.min(92, Math.max(8, x)), y: Math.min(86, Math.max(12, y)) }
        : object,
    ));
  };

  const stopDragging = useCallback(() => { dragRef.current = null; }, []);

  const resetSandbox = () => {
    setBackdrop(null);
    setBackdropDataUrl(null);
    setObjects([]);
    setSelectedId(null);
    setResetOpen(false);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      <Helmet>
        <title>Mood-Board Visualiser | Maison Affluency Trade</title>
        <meta name="description" content="Compose client interiors with collectible furniture and architectural objects in the Maison Affluency trade visualiser." />
      </Helmet>

      <section
        ref={canvasRef}
        aria-label="Mood-Board Visualiser Sandbox"
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSelectedId(null);
        }}
        className="relative -m-4 h-[calc(100dvh-3.5rem)] overflow-hidden bg-visualiser-canvas md:-m-8 md:h-[calc(100dvh-4rem)] lg:-m-12"
      >
        {backdrop ? (
          <img src={backdrop} alt="Client room canvas backdrop" className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover" />
        ) : objects.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="font-display text-xl text-foreground/45 md:text-2xl">Mood-Board Visualiser Sandbox</p>
              <p className="mt-3 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
                Add an object or introduce a spatial backdrop
              </p>
            </div>
          </div>
        ) : null}

        {objects.map((object) => {
          const isSelected = selectedId === object.instanceId;
          return (
            <div
              key={object.instanceId}
              role="button"
              tabIndex={0}
              aria-label={`Move ${object.product_name}`}
              onPointerDown={(event) => onPointerDown(event, object)}
              onKeyDown={(event) => {
                if (event.key === "Delete" || event.key === "Backspace") {
                  setObjects((current) => current.filter((item) => item.instanceId !== object.instanceId));
                  setSelectedId(null);
                }
              }}
              className={cn(
                "group absolute w-[180px] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none outline-none md:w-[240px]",
                isSelected && "cursor-grabbing",
              )}
              style={{ left: `${object.x}%`, top: `${object.y}%`, zIndex: object.z, transform: `translate(-50%, -50%) scale(${object.scale})` }}
            >
              <div className={cn("relative transition-opacity duration-300", !isSelected && "group-hover:opacity-90")}>
                <img
                  src={optimizeImageUrl(object.image_url || "")}
                  alt={object.product_name}
                  draggable={false}
                  className="h-40 w-full object-contain mix-blend-multiply drop-shadow-[0_14px_14px_hsl(var(--foreground)/0.08)] md:h-52"
                />
                {isSelected && <div className="pointer-events-none absolute inset-2 border border-foreground/30" />}
              </div>
              <div className={cn("mt-2 text-center transition-opacity duration-300", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                <p className="font-body text-[9px] uppercase tracking-[0.15em] text-foreground/70">{object.product_name}</p>
                <p className="mt-1 font-body text-[8px] uppercase tracking-[0.15em] text-muted-foreground">{object.brand_name}</p>
              </div>
            </div>
          );
        })}

        {sourceOpen && (
          <div className="absolute bottom-44 left-1/2 z-[80] w-[min(1080px,calc(100%-32px))] -translate-x-1/2 bg-card px-5 py-5 shadow-elegant md:bottom-32 md:px-7">
            <div className="mb-5 flex items-center gap-5 border-b border-border pb-4">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg text-foreground">Designer Collection Index</p>
                <p className="mt-1 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Select an object to place it on the composition</p>
              </div>
              <div className="relative w-52 md:w-72">
                <Search className="absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search collection"
                  className="h-8 rounded-none border-0 border-b border-border bg-transparent pl-6 font-body text-[10px] uppercase tracking-[0.15em] shadow-none focus-visible:ring-0"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSourceOpen(false)} aria-label="Close collection index" className="h-8 w-8 rounded-none">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex h-48 gap-8 overflow-x-auto pb-3">
              {loadingProducts ? (
                <div className="flex w-full items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex w-full items-center justify-center font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">No matching objects</div>
              ) : filteredProducts.map((product) => (
                <Button
                  key={product.id}
                  variant="ghost"
                  onClick={() => addObject(product)}
                  className="group h-full w-36 shrink-0 flex-col justify-end rounded-none p-0 hover:bg-transparent md:w-44"
                >
                  <img src={optimizeImageUrl(product.image_url || "")} alt="" loading="lazy" className="min-h-0 w-full flex-1 object-contain mix-blend-multiply transition-transform duration-500 group-hover:-translate-y-1" />
                  <span className="mt-3 line-clamp-2 min-h-8 whitespace-normal text-center font-body text-[9px] uppercase leading-relaxed tracking-[0.15em] text-foreground/70">{product.product_name}</span>
                  <span className="mt-1 max-w-full truncate font-body text-[8px] uppercase tracking-[0.15em] text-muted-foreground">{product.brand_name}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {layersOpen && (
          <div className="absolute bottom-44 left-1/2 z-[81] w-[min(440px,calc(100%-32px))] -translate-x-1/2 bg-card px-6 py-5 shadow-elegant md:bottom-32">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="font-display text-base">Layer Order</p>
                <p className="mt-1 max-w-72 truncate font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{selected?.product_name || "Select an object on the canvas"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setLayersOpen(false)} aria-label="Close layer controls" className="h-8 w-8 rounded-none"><X className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2">
              <Button variant="ghost" disabled={!selected} onClick={() => moveLayer("up")} className="justify-start rounded-none px-0 font-body text-[9px] uppercase tracking-[0.15em]"><ArrowUp /> Bring Forward</Button>
              <Button variant="ghost" disabled={!selected} onClick={() => moveLayer("down")} className="justify-start rounded-none px-0 font-body text-[9px] uppercase tracking-[0.15em]"><ArrowDown /> Send Back</Button>
              <Button variant="ghost" disabled={!selected} onClick={() => resizeSelected(0.1)} className="justify-start rounded-none px-0 font-body text-[9px] uppercase tracking-[0.15em]"><Plus /> Increase Scale</Button>
              <Button variant="ghost" disabled={!selected} onClick={() => resizeSelected(-0.1)} className="justify-start rounded-none px-0 font-body text-[9px] uppercase tracking-[0.15em]"><span className="text-base">−</span> Reduce Scale</Button>
            </div>
          </div>
        )}

        {resetOpen && (
          <div className="absolute bottom-44 left-1/2 z-[82] w-[min(420px,calc(100%-32px))] -translate-x-1/2 bg-card px-7 py-6 shadow-elegant md:bottom-32">
            <p className="font-display text-lg">Reset this composition?</p>
            <p className="mt-2 font-body text-[10px] leading-relaxed tracking-[0.08em] text-muted-foreground">The backdrop and every placed object will be removed from this sandbox.</p>
            <div className="mt-5 flex justify-end gap-5">
              <Button variant="ghost" onClick={() => setResetOpen(false)} className="rounded-none px-0 font-body text-[9px] uppercase tracking-[0.15em]">Cancel</Button>
              <Button variant="ghost" onClick={resetSandbox} className="rounded-none px-0 font-body text-[9px] uppercase tracking-[0.15em] text-destructive hover:text-destructive">Reset Sandbox</Button>
            </div>
          </div>
        )}

        <div className="absolute bottom-20 left-1/2 z-[90] grid w-[calc(100%-24px)] -translate-x-1/2 grid-cols-2 items-center border border-border bg-card p-1.5 shadow-elegant md:bottom-8 md:flex md:w-auto md:max-w-[calc(100%-24px)] md:rounded-full md:px-2">
          <Button variant="ghost" onClick={() => { setSourceOpen((open) => !open); setLayersOpen(false); setResetOpen(false); }} className="h-10 rounded-none px-2 font-body text-[8px] uppercase tracking-[0.12em] text-foreground hover:bg-muted/50 md:rounded-full md:px-4 md:text-[9px] md:tracking-[0.15em]"><Plus /> Add Object</Button>
          <span className="hidden h-5 w-px shrink-0 bg-border md:block" />
          <Button variant="ghost" onClick={() => fileRef.current?.click()} className="h-10 rounded-none px-2 font-body text-[8px] uppercase tracking-[0.12em] text-foreground hover:bg-muted/50 md:rounded-full md:px-4 md:text-[9px] md:tracking-[0.15em]"><ImageUp /><span className="md:hidden">Upload Backdrop</span><span className="hidden md:inline">Upload Canvas Backdrop</span></Button>
          <span className="hidden h-5 w-px shrink-0 bg-border md:block" />
          <Button variant="ghost" onClick={() => { setLayersOpen((open) => !open); setSourceOpen(false); setResetOpen(false); }} className="h-10 rounded-none px-2 font-body text-[8px] uppercase tracking-[0.12em] text-foreground hover:bg-muted/50 md:rounded-full md:px-4 md:text-[9px] md:tracking-[0.15em]"><Layers3 /> Layer Order</Button>
          <span className="hidden h-5 w-px shrink-0 bg-border md:block" />
          <Button variant="ghost" onClick={() => { setResetOpen(true); setSourceOpen(false); setLayersOpen(false); }} className="h-10 rounded-none px-2 font-body text-[8px] uppercase tracking-[0.12em] text-foreground hover:bg-muted/50 md:rounded-full md:px-4 md:text-[9px] md:tracking-[0.15em]"><X /> Reset Sandbox</Button>
        </div>

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => uploadBackdrop(event.target.files?.[0] ?? null)} />
      </section>
    </>
  );
};

export default TradeVisualiser;