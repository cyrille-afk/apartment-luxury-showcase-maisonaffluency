/**
 * Trade Visualiser — UI prototype.
 *
 * Upload a room photo, pick a surface (Walls / Floors / Upholstery / Curtains),
 * tap the photo to mark the surface, then pick a finish from the live
 * trade_products catalogue. The "Render" step is mocked for now (overlay
 * preview + reveal animation) — the AI render engine wires in next phase.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import {
  Upload, Sparkles, X, Loader2, Search, ImageIcon, MousePointerClick, Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ───────── Surfaces ──────────────────────────────────────────────────────────
type Surface = "walls" | "floors" | "upholstery" | "curtains";

const SURFACES: { id: Surface; label: string; hint: string; keywords: RegExp; categories: string[] }[] = [
  {
    id: "walls",
    label: "Walls",
    hint: "Lacquer · plaster · wallcovering",
    keywords: /lacquer|wallcover|wallpaper|plaster|panel|veneer|stone|marble|gesso|straw|parch|shagreen/i,
    categories: ["Décor", "Decorative Objects"],
  },
  {
    id: "floors",
    label: "Floors",
    hint: "Rugs · carpets · stone",
    keywords: /rug|carpet|kilim|dhurrie/i,
    categories: ["Rugs"],
  },
  {
    id: "upholstery",
    label: "Upholstery",
    hint: "Fabrics · leathers",
    keywords: /fabric|textile|velvet|linen|silk|leather|mohair|bouclé|boucle|wool/i,
    categories: ["Décor", "Seating"],
  },
  {
    id: "curtains",
    label: "Curtains",
    hint: "Drapery · sheers",
    keywords: /curtain|drape|sheer|voile|linen|silk/i,
    categories: ["Décor"],
  },
];

interface Swatch {
  id: string;
  product_name: string;
  brand_name: string | null;
  image_url: string | null;
  category: string | null;
  subcategory: string | null;
  materials: string | null;
}

interface Pin {
  id: string;
  surface: Surface;
  x: number; // 0..1
  y: number;
  swatch?: Swatch;
}

// ───────── Page ──────────────────────────────────────────────────────────────
const TradeVisualiser = () => {
  const [photo, setPhoto] = useState<string | null>(null);
  const [surface, setSurface] = useState<Surface>("walls");
  const [pins, setPins] = useState<Pin[]>([]);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [allSwatches, setAllSwatches] = useState<Swatch[]>([]);
  const [loadingSwatches, setLoadingSwatches] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);

  const imgRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ─── Load swatches once from trade_products ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingSwatches(true);
    (async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, category, subtitle")
        .not("image_url", "is", null)
        .order("brand_name", { ascending: true })
        .limit(800);
      if (cancelled) return;
      setAllSwatches((data || []) as Swatch[]);
      setLoadingSwatches(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Filter swatches for the active surface ──────────────────────────────
  const swatches = useMemo(() => {
    const sdef = SURFACES.find((s) => s.id === surface)!;
    const q = search.trim().toLowerCase();
    return allSwatches
      .filter((s) => {
        const hay = `${s.product_name} ${s.subtitle || ""} ${s.category || ""}`;
        const matchesSurface = sdef.keywords.test(hay) ||
          (s.category && sdef.categories.includes(s.category) && sdef.keywords.test(hay));
        if (!matchesSurface) return false;
        if (!q) return true;
        return `${s.product_name} ${s.brand_name || ""}`.toLowerCase().includes(q);
      })
      .slice(0, 60);
  }, [allSwatches, surface, search]);

  // ─── Upload handling ─────────────────────────────────────────────────────
  const onFile = (f: File | null) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPhoto(url);
    setPins([]);
    setActivePinId(null);
    setRendered(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onFile(e.dataTransfer.files?.[0] ?? null);
  };

  // ─── Pin a surface ───────────────────────────────────────────────────────
  const onPhotoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const newPin: Pin = {
      id: `pin-${Date.now()}`,
      surface,
      x,
      y,
    };
    setPins((p) => [...p, newPin]);
    setActivePinId(newPin.id);
    setRendered(false);
  };

  const removePin = (id: string) => {
    setPins((p) => p.filter((x) => x.id !== id));
    if (activePinId === id) setActivePinId(null);
    setRendered(false);
  };

  // ─── Apply a swatch to the active pin ────────────────────────────────────
  const applySwatch = useCallback((sw: Swatch) => {
    if (!activePinId) return;
    setPins((p) => p.map((pin) => (pin.id === activePinId ? { ...pin, swatch: sw } : pin)));
    setRendered(false);
  }, [activePinId]);

  // ─── Render (mocked) ─────────────────────────────────────────────────────
  const canRender = pins.some((p) => p.swatch);
  const onRender = () => {
    if (!canRender) return;
    setRendering(true);
    setRendered(false);
    setTimeout(() => {
      setRendering(false);
      setRendered(true);
    }, 1600);
  };

  return (
    <>
      <Helmet>
        <title>Visualiser — Trade Portal — Maison Affluency</title>
      </Helmet>

      <div className="max-w-7xl">
        {/* ─── Hero ─── */}
        <div className="mb-8 rounded-xl bg-gradient-to-br from-foreground to-foreground/85 px-6 py-8 text-background">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="h-4 w-4 opacity-70" />
                <span className="font-body text-[10px] uppercase tracking-[0.2em] opacity-70">
                  Visualiser · Beta
                </span>
              </div>
              <h1 className="font-display text-3xl md:text-4xl mb-2">Show clients the room before you build it.</h1>
              <p className="font-body text-sm opacity-80 max-w-2xl">
                Upload a room photo, mark walls, floors, upholstery or drapery, and drop in any finish
                from our catalogue — Alexander Lamont lacquers, Pierre Frey wallcoverings, cc-tapis rugs,
                Pouenat textiles. Render and send.
              </p>
            </div>
          </div>
        </div>

        {/* ─── Upload (no photo yet) ─── */}
        {!photo && (
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-xl p-16 text-center cursor-pointer hover:border-foreground/40 transition-colors"
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="font-body text-sm text-foreground mb-1">
              Drop a room photo here, or click to upload
            </p>
            <p className="font-body text-xs text-muted-foreground">
              JPEG or PNG · client-side only, nothing is saved yet
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}

        {/* ─── Workspace ─── */}
        {photo && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Photo + surface tabs */}
            <div>
              {/* Surface tabs */}
              <div className="flex flex-wrap gap-2 mb-3">
                {SURFACES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSurface(s.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-md border text-xs uppercase tracking-[0.12em] font-body transition-colors",
                      surface === s.id
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground",
                    )}
                    title={s.hint}
                  >
                    {s.label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setPhoto(null); setPins([]); setRendered(false); }}>
                    <X className="h-4 w-4 mr-1" /> New photo
                  </Button>
                </div>
              </div>

              {/* Photo */}
              <div
                ref={imgRef}
                onClick={onPhotoClick}
                className="relative w-full rounded-xl overflow-hidden border border-border bg-muted cursor-crosshair select-none"
                style={{ aspectRatio: "16/10" }}
              >
                <img src={photo} alt="Room" className="absolute inset-0 w-full h-full object-cover" />

                {/* Rendering overlay (mocked) */}
                {rendering && (
                  <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-30">
                    <div className="bg-background/95 rounded-lg px-5 py-3 flex items-center gap-3 shadow-lg">
                      <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                      <span className="font-body text-sm">Rendering surfaces…</span>
                    </div>
                  </div>
                )}

                {/* Rendered "after" badge */}
                {rendered && !rendering && (
                  <div className="absolute top-3 left-3 z-20 bg-background/95 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-[0.18em] font-body shadow">
                    Rendered preview
                  </div>
                )}

                {/* Pins */}
                {pins.map((p) => {
                  const sdef = SURFACES.find((s) => s.id === p.surface)!;
                  const isActive = p.id === activePinId;
                  return (
                    <div
                      key={p.id}
                      onClick={(e) => { e.stopPropagation(); setActivePinId(p.id); }}
                      className={cn(
                        "absolute z-20 -translate-x-1/2 -translate-y-1/2 group",
                        "flex flex-col items-center cursor-pointer",
                      )}
                      style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full border-2 border-background shadow-lg flex items-center justify-center text-[10px] font-body uppercase tracking-wider transition-transform",
                          isActive ? "bg-foreground text-background scale-110" : "bg-background/90 text-foreground",
                          p.swatch ? "ring-2 ring-emerald-500" : "",
                        )}
                      >
                        {sdef.label[0]}
                      </div>
                      {p.swatch && (
                        <div className="mt-1 bg-background/95 rounded shadow-md flex items-center gap-1.5 pr-2">
                          {p.swatch.image_url && (
                            <img src={p.swatch.image_url} alt="" className="w-6 h-6 object-cover rounded-l" />
                          )}
                          <span className="font-body text-[10px] text-foreground whitespace-nowrap max-w-[140px] truncate">
                            {p.swatch.product_name}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); removePin(p.id); }}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Remove pin"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty hint */}
                {pins.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-background/90 px-4 py-2.5 rounded-md flex items-center gap-2 shadow">
                      <MousePointerClick className="h-4 w-4 text-foreground" />
                      <span className="font-body text-xs text-foreground">
                        Tap on the <strong>{SURFACES.find((s) => s.id === surface)!.label.toLowerCase()}</strong> to mark a surface
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Render bar */}
              <div className="mt-4 flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-muted/30">
                <div className="font-body text-xs text-muted-foreground">
                  {pins.length === 0 ? "No surfaces marked yet." :
                    `${pins.filter(p => p.swatch).length} of ${pins.length} surface${pins.length > 1 ? "s" : ""} have a finish applied.`}
                </div>
                <Button onClick={onRender} disabled={!canRender || rendering} size="sm">
                  {rendering ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Rendering…</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Render</>
                  )}
                </Button>
              </div>

              <p className="mt-3 font-body text-[11px] text-muted-foreground italic">
                Beta preview — the AI render engine ships next. Today, this builds the surface selection and
                finish library; render output is a mocked overlay.
              </p>
            </div>

            {/* Finish library */}
            <div className="border border-border rounded-xl bg-card flex flex-col h-[600px] sticky top-4">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm uppercase tracking-[0.15em]">Finish library</h3>
                  <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
                    {swatches.length} options
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search ${SURFACES.find((s) => s.id === surface)!.label.toLowerCase()}…`}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                {!activePinId && pins.length > 0 && (
                  <p className="mt-2 font-body text-[11px] text-muted-foreground">
                    Tap a pin on the photo to apply a finish.
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {loadingSwatches ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : swatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center px-6">
                    <ImageIcon className="h-6 w-6 text-muted-foreground mb-2" />
                    <p className="font-body text-xs text-muted-foreground">
                      No finishes match this surface yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {swatches.map((sw) => (
                      <button
                        key={sw.id}
                        onClick={() => applySwatch(sw)}
                        disabled={!activePinId}
                        className={cn(
                          "group text-left rounded-md overflow-hidden border border-border bg-background transition-all",
                          activePinId ? "hover:border-foreground/40 cursor-pointer" : "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <div className="aspect-square bg-muted overflow-hidden">
                          {sw.image_url && (
                            <img
                              src={sw.image_url}
                              alt={sw.product_name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          )}
                        </div>
                        <div className="px-2 py-1.5">
                          <div className="font-body text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                            {sw.brand_name}
                          </div>
                          <div className="font-body text-xs text-foreground truncate">
                            {sw.product_name}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TradeVisualiser;
