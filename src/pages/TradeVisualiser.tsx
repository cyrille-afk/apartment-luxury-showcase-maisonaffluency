import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { ImageUp, Layers3, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import { dimensionBadgeLabel, resolveDimensions } from "@/lib/productDimensions";
import { toast } from "sonner";

type CatalogueProduct = {
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  category: string;
  dimensions: string | null;
};

type CanvasObject = CatalogueProduct & {
  instanceId: string;
  x: number;
  y: number;
  scale: number;
  z: number;
  tiltX: number;
  tiltY: number;
  skewX: number;
  brightness: number;
  contrast: number;
  warmth: number;
  shadowDirection: number;
};

type PersistedSandbox = {
  backdrop: string | null;
  backdropDataUrl: string | null;
  objects: CanvasObject[];
};

const STORAGE_KEY = "trade-visualiser-sandbox-v2";
const MIN_OBJECT_SCALE = 0.4;
const MAX_OBJECT_SCALE = 2.5;
// Master-fidelity cutouts: near-lossless quality, Retina DPR, capped only by a 3000px ceiling (never upscaled).
const CUTOUT_TRANSFORMS = "f_png,q_100,w_3000,dpr_auto,c_limit,e_make_transparent:10";
const CUTOUT_IMAGE_STYLE: CSSProperties = {
  imageRendering: "-webkit-optimize-contrast" as CSSProperties["imageRendering"],
  transform: "translateZ(0)",
  willChange: "transform, filter",
};

type CanvasGesture =
  | { mode: "move"; id: string; offsetX: number; offsetY: number }
  | { mode: "resize"; id: string; startDistance: number; startScale: number }
  | {
      mode: "perspective";
      id: string;
      cornerX: -1 | 1;
      cornerY: -1 | 1;
      startX: number;
      startY: number;
      startTiltX: number;
      startTiltY: number;
      startSkewX: number;
      startShadowDirection: number;
    };

const withRenderingDefaults = (object: Partial<CanvasObject> & CatalogueProduct): CanvasObject => ({
  ...object,
  instanceId: object.instanceId ?? `${object.id}-${Date.now()}`,
  x: object.x ?? 50,
  y: object.y ?? 50,
  scale: object.scale ?? 1,
  z: object.z ?? 1,
  tiltX: object.tiltX ?? 0,
  tiltY: object.tiltY ?? 0,
  skewX: object.skewX ?? 0,
  brightness: object.brightness ?? 100,
  contrast: object.contrast ?? 100,
  warmth: object.warmth ?? 0,
  shadowDirection: object.shadowDirection ?? 10,
});

const scaledDimensionLabel = (object: CanvasObject) => {
  const dimensions = resolveDimensions(object);
  const scale = `${Math.round(object.scale * 100)}% [1:${Math.max(1, Math.round(10 / object.scale))} PERSPECTIVE]`;
  if (!dimensions) return `${dimensionBadgeLabel(object)} // SCALE ${scale}`;
  const scaled = {
    w: Math.round(dimensions.w * object.scale),
    d: Math.round(dimensions.d * object.scale),
    h: Math.round(dimensions.h * object.scale),
  };
  return `${scaled.w} × ${scaled.d} × ${scaled.h} MM // ${scale}`;
};

const loadSandbox = (): PersistedSandbox => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}") as Partial<PersistedSandbox>;
    return {
      backdrop: parsed.backdrop?.startsWith("blob:") ? parsed.backdropDataUrl ?? null : parsed.backdrop ?? null,
      backdropDataUrl: parsed.backdropDataUrl ?? null,
      objects: Array.isArray(parsed.objects)
        ? parsed.objects.map((object) => withRenderingDefaults(object))
        : [],
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
  const [resetOpen, setResetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<CanvasGesture | null>(null);

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
        .select("id, product_name, brand_name, image_url, category, dimensions")
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
    if (objects.length >= 15) {
      toast.error("This composition can hold up to 15 objects.");
      return;
    }
    const count = objects.length;
    const next: CanvasObject = {
      ...product,
      instanceId: `${product.id}-${Date.now()}`,
      x: 38 + ((count * 11) % 28),
      y: 35 + ((count * 8) % 25),
      scale: 1,
      z: Math.max(0, ...objects.map((object) => object.z)) + 1,
      tiltX: 0,
      tiltY: 0,
      skewX: 0,
      brightness: 100,
      contrast: 100,
      warmth: 0,
      shadowDirection: 10,
    };
    setObjects((current) => [...current, next]);
    setSelectedId(next.instanceId);
  };

  const alternateLayer = () => {
    if (!selectedId) return;
    setObjects((current) => {
      const selectedObject = current.find((object) => object.instanceId === selectedId);
      if (!selectedObject) return current;
      const otherObjects = current.filter((object) => object.instanceId !== selectedId);
      const highest = Math.max(0, ...otherObjects.map((object) => object.z));
      const lowest = Math.min(0, ...otherObjects.map((object) => object.z));
      const nextZ = selectedObject.z >= highest ? lowest - 1 : highest + 1;
      return current.map((object) => object.instanceId === selectedId ? { ...object, z: nextZ } : object);
    });
  };

  const removeObject = (instanceId: string) => {
    setObjects((current) => current.filter((item) => item.instanceId !== instanceId));
    setSelectedId((current) => current === instanceId ? null : current);
  };

  const onPointerDown = (event: React.PointerEvent, object: CanvasObject) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    gestureRef.current = {
      mode: "move",
      id: object.instanceId,
      offsetX: event.clientX - rect.left - (object.x / 100) * rect.width,
      offsetY: event.clientY - rect.top - (object.y / 100) * rect.height,
    };
    setSelectedId(object.instanceId);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onResizePointerDown = (event: React.PointerEvent, object: CanvasObject) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const centerX = canvasRect.left + (object.x / 100) * canvasRect.width;
    const centerY = canvasRect.top + (object.y / 100) * canvasRect.height;
    gestureRef.current = {
      mode: "resize",
      id: object.instanceId,
      startDistance: Math.max(1, Math.hypot(event.clientX - centerX, event.clientY - centerY)),
      startScale: object.scale,
    };
    setSelectedId(object.instanceId);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  };

  const onPerspectivePointerDown = (
    event: React.PointerEvent,
    object: CanvasObject,
    cornerX: -1 | 1,
    cornerY: -1 | 1,
  ) => {
    gestureRef.current = {
      mode: "perspective",
      id: object.instanceId,
      cornerX,
      cornerY,
      startX: event.clientX,
      startY: event.clientY,
      startTiltX: object.tiltX,
      startTiltY: object.tiltY,
      startSkewX: object.skewX,
      startShadowDirection: object.shadowDirection,
    };
    setSelectedId(object.instanceId);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  };

  const updateObjectRendering = (
    instanceId: string,
    field: "brightness" | "contrast" | "warmth",
    value: number,
  ) => {
    setObjects((current) => current.map((object) =>
      object.instanceId === instanceId ? { ...object, [field]: value } : object,
    ));
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const canvas = canvasRef.current;
    const gesture = gestureRef.current;
    if (!canvas || !gesture) return;
    const rect = canvas.getBoundingClientRect();
    if (gesture.mode === "perspective") {
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;
      setObjects((current) => current.map((object) => {
        if (object.instanceId !== gesture.id) return object;
        return {
          ...object,
          tiltX: Math.min(24, Math.max(-24, gesture.startTiltX - deltaY * gesture.cornerY * 0.12)),
          tiltY: Math.min(28, Math.max(-28, gesture.startTiltY + deltaX * gesture.cornerX * 0.12)),
          skewX: Math.min(22, Math.max(-22, gesture.startSkewX + deltaX * gesture.cornerY * 0.08)),
          shadowDirection: Math.min(34, Math.max(-34, gesture.startShadowDirection + deltaX * 0.08)),
        };
      }));
      return;
    }
    if (gesture.mode === "resize") {
      setObjects((current) => current.map((object) => {
        if (object.instanceId !== gesture.id) return object;
        const centerX = rect.left + (object.x / 100) * rect.width;
        const centerY = rect.top + (object.y / 100) * rect.height;
        const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
        const scale = gesture.startScale * (distance / gesture.startDistance);
        return { ...object, scale: Math.min(MAX_OBJECT_SCALE, Math.max(MIN_OBJECT_SCALE, scale)) };
      }));
      return;
    }
    const x = ((event.clientX - rect.left - gesture.offsetX) / rect.width) * 100;
    const y = ((event.clientY - rect.top - gesture.offsetY) / rect.height) * 100;
    setObjects((current) => current.map((object) =>
      object.instanceId === gesture.id
        ? { ...object, x: Math.min(96, Math.max(4, x)), y: Math.min(94, Math.max(6, y)) }
        : object,
    ));
  };

  const stopDragging = useCallback(() => { gestureRef.current = null; }, []);

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
          <img src={backdrop} alt="Client room canvas backdrop" className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-cover object-center" />
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
          const perspectiveTransform = `perspective(900px) rotateX(${object.tiltX}deg) rotateY(${object.tiltY}deg) skewX(${object.skewX}deg)`;
          const imageFilter = `brightness(${object.brightness}%) contrast(${object.contrast}%) saturate(${Math.max(72, 100 - object.warmth * 0.22)}%) sepia(${object.warmth}%)`;
          return (
            <div
              key={object.instanceId}
              role="button"
              tabIndex={0}
              aria-label={`Move ${object.product_name}`}
              onPointerDown={(event) => onPointerDown(event, object)}
              onKeyDown={(event) => {
                if (event.key === "Delete" || event.key === "Backspace") {
                  removeObject(object.instanceId);
                }
              }}
              className={cn(
                "group absolute w-[180px] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none outline-none md:w-[240px]",
                isSelected && "cursor-grabbing",
              )}
              style={{ left: `${object.x}%`, top: `${object.y}%`, zIndex: object.z + 10, transform: `translate(-50%, -50%) scale(${object.scale})` }}
            >
              <div className={cn("relative transition-opacity duration-300", !isSelected && "group-hover:opacity-95")}>
                <div
                  className="relative h-40 w-full md:h-52"
                  style={{ transform: `${perspectiveTransform} translateZ(0)`, transformStyle: "preserve-3d", willChange: "transform, filter" }}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-[9%] left-[23%] right-[23%] h-px bg-foreground/65 blur-[1px]"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-[5%] left-[12%] right-[12%] h-5 origin-center rounded-[50%] bg-gradient-to-r from-transparent via-foreground/20 to-transparent blur-lg"
                    style={{ transform: `translateX(${object.shadowDirection}px) skewX(${object.shadowDirection * 0.7}deg) scaleX(1.18)` }}
                  />
                  <img
                    src={optimizeImageUrl(object.image_url || "", CUTOUT_TRANSFORMS)}
                    alt={object.product_name}
                    draggable={false}
                    className="relative h-full w-full object-contain mix-blend-multiply [image-rendering:crisp-edges]"
                    style={{ ...CUTOUT_IMAGE_STYLE, filter: imageFilter }}
                  />
                </div>
                {isSelected && (
                  <div className="pointer-events-none absolute inset-0 border border-foreground/30">
                    {(["-left-2 -top-2", "-right-2 -top-2", "-bottom-2 -left-2", "-bottom-2 -right-2"] as const).map((position) => (
                      <span
                        key={position}
                        role="slider"
                        tabIndex={0}
                        aria-label={`Resize ${object.product_name}`}
                        aria-valuemin={40}
                        aria-valuemax={250}
                        aria-valuenow={Math.round(object.scale * 100)}
                        onPointerDown={(event) => onResizePointerDown(event, object)}
                        className={cn("pointer-events-auto absolute h-3 w-3 touch-none cursor-nwse-resize border border-foreground/50 bg-card", position)}
                      />
                    ))}
                    {([
                      { position: "left-3 top-3", x: -1 as const, y: -1 as const },
                      { position: "right-3 top-3", x: 1 as const, y: -1 as const },
                      { position: "bottom-3 left-3", x: -1 as const, y: 1 as const },
                      { position: "bottom-3 right-3", x: 1 as const, y: 1 as const },
                    ]).map((handle) => (
                      <span
                        key={handle.position}
                        role="slider"
                        tabIndex={0}
                        aria-label={`Warp ${object.product_name} ${handle.x < 0 ? "left" : "right"} ${handle.y < 0 ? "top" : "bottom"} corner`}
                        aria-valuemin={-28}
                        aria-valuemax={28}
                        aria-valuenow={Math.round(object.tiltY)}
                        onPointerDown={(event) => onPerspectivePointerDown(event, object, handle.x, handle.y)}
                        className={cn("pointer-events-auto absolute h-2 w-2 touch-none rotate-45 cursor-crosshair border border-foreground/70 bg-visualiser-canvas", handle.position)}
                      />
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${object.product_name}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => { event.stopPropagation(); removeObject(object.instanceId); }}
                      className="pointer-events-auto absolute -right-3 -top-3 h-6 w-6 rounded-full border border-border bg-card p-0 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <span aria-live="polite" className="absolute -bottom-7 right-0 max-w-[360px] whitespace-nowrap bg-visualiser-canvas/90 px-1.5 py-1 font-body text-[8px] uppercase tracking-[0.15em] text-foreground/70 backdrop-blur-sm">
                      {object.product_name} // {scaledDimensionLabel(object)}
                    </span>
                    <div
                      className="pointer-events-auto absolute left-0 top-full mt-8 w-48 bg-card/95 px-3 py-2.5 backdrop-blur-sm"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <p className="mb-2 font-body text-[8px] uppercase tracking-[0.15em] text-foreground/70">Ambient Match</p>
                      {([
                        { field: "warmth" as const, label: "Warmth", min: 0, max: 70 },
                        { field: "brightness" as const, label: "Brightness", min: 65, max: 130 },
                        { field: "contrast" as const, label: "Contrast", min: 70, max: 145 },
                      ]).map((control) => (
                        <label key={control.field} className="mt-1.5 grid grid-cols-[56px_1fr_28px] items-center gap-2 font-body text-[7px] uppercase tracking-[0.12em] text-muted-foreground">
                          <span>{control.label}</span>
                          <input
                            type="range"
                            min={control.min}
                            max={control.max}
                            value={object[control.field]}
                            onChange={(event) => updateObjectRendering(object.instanceId, control.field, Number(event.target.value))}
                            className="h-px w-full cursor-ew-resize accent-foreground"
                          />
                          <span className="text-right tabular-nums">{object[control.field]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
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
                 <p className="mt-1 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Select up to 15 objects · {objects.length} placed</p>
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
                  <img src={optimizeImageUrl(product.image_url || "", CUTOUT_TRANSFORMS)} alt="" loading="lazy" style={CUTOUT_IMAGE_STYLE} className="min-h-0 w-full flex-1 object-contain mix-blend-multiply [image-rendering:crisp-edges] transition-transform duration-500 group-hover:-translate-y-1" />
                  <span className="mt-3 line-clamp-2 min-h-8 whitespace-normal text-center font-body text-[9px] uppercase leading-relaxed tracking-[0.15em] text-foreground/70">{product.product_name}</span>
                  <span className="mt-1 max-w-full truncate font-body text-[8px] uppercase tracking-[0.15em] text-muted-foreground">{product.brand_name}</span>
                </Button>
              ))}
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
          <Button variant="ghost" onClick={() => { setSourceOpen((open) => !open); setResetOpen(false); }} className="h-10 rounded-none px-2 font-body text-[8px] uppercase tracking-[0.12em] text-foreground hover:bg-muted/50 md:rounded-full md:px-4 md:text-[9px] md:tracking-[0.15em]"><Plus /> Add Object</Button>
          <span className="hidden h-5 w-px shrink-0 bg-border md:block" />
          <Button variant="ghost" onClick={() => fileRef.current?.click()} className="h-10 rounded-none px-2 font-body text-[8px] uppercase tracking-[0.12em] text-foreground hover:bg-muted/50 md:rounded-full md:px-4 md:text-[9px] md:tracking-[0.15em]"><ImageUp />{backdrop ? "Change Backdrop" : <><span className="md:hidden">Upload Backdrop</span><span className="hidden md:inline">Upload Canvas Backdrop</span></>}</Button>
          <span className="hidden h-5 w-px shrink-0 bg-border md:block" />
          <Button variant="ghost" disabled={!selected} onClick={() => { alternateLayer(); setSourceOpen(false); setResetOpen(false); }} title={selected ? "Alternate selected object between front and back" : "Select an object first"} className="h-10 rounded-none px-2 font-body text-[8px] uppercase tracking-[0.12em] text-foreground hover:bg-muted/50 md:rounded-full md:px-4 md:text-[9px] md:tracking-[0.15em]"><Layers3 /> Layer Order</Button>
          <span className="hidden h-5 w-px shrink-0 bg-border md:block" />
          <Button variant="ghost" onClick={() => { setResetOpen(true); setSourceOpen(false); }} className="h-10 rounded-none px-2 font-body text-[8px] uppercase tracking-[0.12em] text-foreground hover:bg-muted/50 md:rounded-full md:px-4 md:text-[9px] md:tracking-[0.15em]"><X /> Reset Sandbox</Button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => uploadBackdrop(event.target.files?.[0] ?? null)} />
      </section>
    </>
  );
};

export default TradeVisualiser;