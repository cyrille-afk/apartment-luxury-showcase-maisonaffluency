import { useState, useRef, useCallback, useMemo } from "react";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CloudUpload from "@/components/trade/CloudUpload";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wand2, Paintbrush, Layers, RotateCcw, Download, ImagePlus, Inbox, CheckCircle2, Clock, ArrowRight, Save, Eye, EyeOff, PenTool, Search, FileInput, ArrowLeftRight, ExternalLink, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

type Mode = "elevation_to_axo" | "section_to_axo" | "stylize" | "composite" | "3d_to_cad" | "cad_overlay";

interface SelectedProduct {
  product_name: string;
  brand_name: string;
  image_url: string;
  dimensions?: string;
  materials?: string;
}

interface GenerationResult {
  imageUrl: string;
  storedUrl: string | null;
  text: string;
  sourceProduct?: SelectedProduct | null;
  mode: Mode;
}

const STYLE_PRESETS = [
  { value: "photorealistic architectural rendering with warm natural lighting, high-end interior finishes", label: "Photorealistic" },
  { value: "elegant watercolor architectural illustration with soft washes and fine line work", label: "Watercolor" },
  { value: "clean minimal architectural line drawing with subtle shadows and muted tones", label: "Minimal Line" },
  { value: "luxurious editorial interior photography style with dramatic lighting and rich textures", label: "Editorial Luxury" },
  { value: "contemporary Scandinavian design with light wood, white walls, and soft daylight", label: "Scandinavian" },
];

/** Inline product picker for platform images */
const ProductPicker = ({ search, onSelect, selectedProduct }: { search: string; onSelect: (product: SelectedProduct) => void; selectedProduct: SelectedProduct | null }) => {
  const products = useMemo(() => {
    const all = getAllTradeProducts().filter((p) => p.image_url);
    if (!search.trim()) return all.slice(0, 24);
    const q = search.toLowerCase();
    return all.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        p.brand_name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    ).slice(0, 24);
  }, [search]);

  if (products.length === 0) {
    return <p className="font-body text-xs text-muted-foreground py-4 text-center">No products found</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
      {products.map((p) => (
        <button
          key={p.id}
          onClick={() => p.image_url && onSelect({
            product_name: p.product_name,
            brand_name: p.brand_name,
            image_url: p.image_url!,
            dimensions: p.dimensions,
            materials: p.materials,
          })}
          className={`rounded border overflow-hidden text-left transition-all ${
            selectedProduct?.image_url === p.image_url ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/30"
          }`}
          title={`${p.product_name} — ${p.brand_name}${p.dimensions ? ` — ${p.dimensions}` : ""}`}
        >
          <img src={p.image_url!} alt={p.product_name} className="w-full aspect-square object-cover" />
          <div className="px-1 py-0.5">
            <p className="font-body text-[9px] text-foreground truncate">{p.product_name}</p>
            <p className="font-body text-[8px] text-muted-foreground truncate">{p.brand_name}</p>
          </div>
        </button>
      ))}
    </div>
  );
};

const TradeAxonometric = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("elevation_to_axo");
  const [style, setStyle] = useState(STYLE_PRESETS[0].value);
  const [overlayImages, setOverlayImages] = useState<string[]>([]);
  const [cadBlocks, setCadBlocks] = useState<string[]>([]);
  const [technicalDrawingUrl, setTechnicalDrawingUrl] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [showQueue, setShowQueue] = useState(true);
  const [galleryTitle, setGalleryTitle] = useState("");
  const [galleryDesc, setGalleryDesc] = useState("");
  const [savingToGallery, setSavingToGallery] = useState(false);

  // CSS filter state
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [warmth, setWarmth] = useState(0);

  // Fetch pending requests
  const { data: pendingRequests } = useQuery({
    queryKey: ["axonometric-requests-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("axonometric_requests")
        .select("*, profiles:user_id(first_name, last_name, company)")
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) return <Navigate to="/trade" replace />;

  const generate = async () => {
    if (!sourceImage) {
      toast({ title: "Upload an image first", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      // Mark request as in_progress if working from queue
      if (activeRequestId) {
        await (supabase as any)
          .from("axonometric_requests")
          .update({ status: "in_progress" })
          .eq("id", activeRequestId);
      }

      const { data, error } = await supabase.functions.invoke("axonometric-generate", {
        body: {
          imageUrl: sourceImage,
          mode,
          style,
          overlayImages: (mode === "composite" || mode === "cad_overlay") ? overlayImages : undefined,
          technicalDrawingUrl: mode === "cad_overlay" ? technicalDrawingUrl : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const gen: GenerationResult = {
        imageUrl: data.imageUrl,
        storedUrl: data.storedUrl,
        text: data.text,
        sourceProduct: selectedProduct,
        mode,
      };
      setResult(gen);
      setHistory((prev) => [gen, ...prev]);
      toast({ title: "Axonometric view generated" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const loadFromQueue = (req: any) => {
    setSourceImage(req.image_url);
    setActiveRequestId(req.id);
    setAdminNotes(req.admin_notes || "");
    setMode(req.request_type === "section" ? "section_to_axo" : "elevation_to_axo");
    setShowQueue(false);
    setResult(null);
  };

  const completeRequest = async () => {
    if (!activeRequestId || !result) return;
    const resultUrl = result.storedUrl || result.imageUrl;
    try {
      await (supabase as any)
        .from("axonometric_requests")
        .update({
          status: "completed",
          result_image_url: resultUrl,
          admin_notes: adminNotes.trim().slice(0, 1000) || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeRequestId);

      toast({ title: "Request completed and result delivered" });
      setActiveRequestId(null);
      setSourceImage(null);
      setResult(null);
      setAdminNotes("");
      setShowQueue(true);
      queryClient.invalidateQueries({ queryKey: ["axonometric-requests-admin"] });
    } catch (e: any) {
      toast({ title: "Failed to update request", description: e.message, variant: "destructive" });
    }
  };

  const saveToGallery = async (publish: boolean) => {
    if (!result) return;
    const imageUrl = result.storedUrl || result.imageUrl;
    setSavingToGallery(true);
    try {
      const { error } = await (supabase as any).from("axonometric_gallery").insert({
        created_by: (await supabase.auth.getUser()).data.user?.id,
        title: galleryTitle.trim().slice(0, 200),
        description: galleryDesc.trim().slice(0, 500) || null,
        image_url: imageUrl,
        style_preset: STYLE_PRESETS.find(s => s.value === style)?.label || null,
        project_name: activeRequestId ? (pendingRequests?.find((r: any) => r.id === activeRequestId)?.project_name || null) : null,
        request_id: activeRequestId || null,
        is_published: publish,
      });
      if (error) throw error;
      toast({ title: publish ? "Saved & published to gallery" : "Saved as draft" });
      setGalleryTitle("");
      setGalleryDesc("");
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingToGallery(false);
    }
  };

  const iterateOnResult = () => {
    if (result?.storedUrl || result?.imageUrl) {
      setSourceImage(result.storedUrl || result.imageUrl);
      setMode("stylize");
    }
  };

  const compositeMode = () => {
    if (result?.storedUrl || result?.imageUrl) {
      setSourceImage(result.storedUrl || result.imageUrl);
      setMode("composite");
    }
  };

  const filterStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${Math.abs(warmth)}%)`,
  };

  const downloadImage = () => {
    const url = result?.storedUrl || result?.imageUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `axonometric-${Date.now()}.png`;
    a.click();
  };

  const resetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setWarmth(0);
  };

  return (
    <>
      <Helmet>
        <title>Axonometric Studio | Trade Portal</title>
      </Helmet>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground">Axonometric Studio</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Transform 2D elevations and sections into stylised 3D axonometric views using AI
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeRequestId && (
              <Button variant="outline" size="sm" onClick={() => { setActiveRequestId(null); setSourceImage(null); setResult(null); setShowQueue(true); }}>
                <Inbox className="w-3.5 h-3.5 mr-1.5" />Back to Queue
              </Button>
            )}
            <Button
              variant={showQueue ? "default" : "outline"}
              size="sm"
              onClick={() => setShowQueue(!showQueue)}
            >
              <Inbox className="w-3.5 h-3.5 mr-1.5" />
              Queue
              {pendingRequests && pendingRequests.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium">
                  {pendingRequests.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Request Queue */}
        {showQueue && pendingRequests && pendingRequests.length > 0 && (
          <div className="border border-border rounded-lg divide-y divide-border">
            <div className="px-5 py-3 bg-muted/30">
              <h2 className="font-display text-sm text-foreground">Pending Requests</h2>
            </div>
            {pendingRequests.map((req: any) => {
              const profile = req.profiles;
              const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Unknown";
              return (
                <div key={req.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition-colors">
                  <img src={req.image_url} alt="" className="w-16 h-16 object-cover rounded border border-border shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm text-foreground">{req.project_name || "Untitled"}</p>
                    <p className="font-body text-xs text-muted-foreground">
                      {userName}{profile?.company ? ` · ${profile.company}` : ""} · {req.request_type} · {format(new Date(req.created_at), "d MMM yyyy")}
                    </p>
                    {req.notes && <p className="font-body text-xs text-muted-foreground/70 line-clamp-1 mt-0.5">{req.notes}</p>}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${req.status === "in_progress" ? "bg-blue-500/10 text-blue-700" : "bg-yellow-500/10 text-yellow-700"}`}>
                    {req.status === "in_progress" ? "In Progress" : "Pending"}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => loadFromQueue(req)}>
                    <ArrowRight className="w-3.5 h-3.5 mr-1" />Process
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {showQueue && (!pendingRequests || pendingRequests.length === 0) && (
          <div className="border border-dashed border-border rounded-lg py-12 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-muted-foreground/40" />
            <p className="font-body text-sm text-muted-foreground">No pending requests — all caught up</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Controls */}
          <div className="space-y-6">
            {/* Source Upload */}
            <div className="border border-border rounded-lg p-5 space-y-4">
              <h2 className="font-display text-sm text-foreground">Source Image</h2>
              <p className="font-body text-xs text-muted-foreground">
                Upload a 2D elevation, section drawing, or a previously generated axonometric view
              </p>

              {sourceImage ? (
                <div className="space-y-2">
                  <div className="relative group">
                    <img
                      src={sourceImage}
                      alt="Source"
                      className="w-full rounded-md border border-border object-contain max-h-64"
                    />
                    <button
                      onClick={() => { setSourceImage(null); setSelectedProduct(null); }}
                      className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {selectedProduct && (
                    <div className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-display text-xs text-foreground truncate">{selectedProduct.product_name}</p>
                        <p className="font-body text-[10px] text-muted-foreground truncate">by {selectedProduct.brand_name}</p>
                        {selectedProduct.dimensions && (
                          <p className="font-body text-[10px] text-muted-foreground">{selectedProduct.dimensions}</p>
                        )}
                      </div>
                      <a
                        href={selectedProduct.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 ml-2 text-muted-foreground hover:text-foreground transition-colors"
                        title="View original 3D image"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <CloudUpload
                  folder="axonometric-sources"
                  accept="image/*"
                  label="Upload elevation or section"
                  onUpload={(urls) => setSourceImage(urls[0])}
                />
              )}
            </div>

            {/* Mode */}
            <div className="border border-border rounded-lg p-5 space-y-4">
              <h2 className="font-display text-sm text-foreground">Generation Mode</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {([
                  { value: "elevation_to_axo", label: "Elevation → 3D", icon: Wand2 },
                  { value: "section_to_axo", label: "Section → 3D", icon: Layers },
                  { value: "stylize", label: "Stylize", icon: Paintbrush },
                  { value: "composite", label: "Add Products", icon: ImagePlus },
                  { value: "3d_to_cad", label: "3D → CAD Block", icon: PenTool },
                  { value: "cad_overlay", label: "CAD Overlay", icon: FileInput },
                ] as const).map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-md border text-xs font-body transition-colors ${
                      mode === m.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <m.icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Style Preset */}
            <div className="border border-border rounded-lg p-5 space-y-4">
              <h2 className="font-display text-sm text-foreground">Style Preset</h2>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="font-body text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_PRESETS.map((s) => (
                    <SelectItem key={s.label} value={s.value} className="font-body text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Overlay (composite mode) */}
            {mode === "composite" && (
              <div className="border border-border rounded-lg p-5 space-y-4">
                <h2 className="font-display text-sm text-foreground">Product Images to Overlay</h2>
                <p className="font-body text-xs text-muted-foreground">
                  Upload up to 5 product images to place into the axonometric view
                </p>
                <div className="flex flex-wrap gap-2">
                  {overlayImages.map((img, i) => (
                    <div key={i} className="relative w-16 h-16 border border-border rounded overflow-hidden group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setOverlayImages((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <RotateCcw className="w-3 h-3 text-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
                {overlayImages.length < 5 && (
                  <CloudUpload
                    folder="axonometric-overlays"
                    accept="image/*"
                    multiple
                    label="Add product images"
                    onUpload={(urls) =>
                      setOverlayImages((prev) => [...prev, ...urls].slice(0, 5))
                    }
                  />
                )}
              </div>
            )}

            {/* 3D → CAD: Product Browser from platform */}
            {mode === "3d_to_cad" && (
              <div className="border border-border rounded-lg p-5 space-y-4">
                <h2 className="font-display text-sm text-foreground">Select Product from Platform</h2>
                <p className="font-body text-xs text-muted-foreground">
                  Choose a 3D product image to convert into a 2D CAD vector block with estimated dimensions
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products…"
                    className="pl-9 font-body text-xs"
                  />
                </div>
                <ProductPicker
                  search={productSearch}
                  onSelect={(product) => {
                    setSelectedProduct(product);
                    setSourceImage(product.image_url);
                  }}
                  selectedProduct={selectedProduct}
                />
              </div>
            )}

            {/* CAD Overlay: Technical drawing + CAD blocks */}
            {mode === "cad_overlay" && (
              <div className="border border-border rounded-lg p-5 space-y-4">
                <h2 className="font-display text-sm text-foreground">Technical Drawing</h2>
                <p className="font-body text-xs text-muted-foreground">
                  Upload the technical drawing to overlay CAD blocks onto
                </p>
                {technicalDrawingUrl ? (
                  <div className="relative group">
                    <img src={technicalDrawingUrl} alt="Technical drawing" className="w-full max-h-40 object-contain rounded border border-border" />
                    <button
                      onClick={() => setTechnicalDrawingUrl(null)}
                      className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RotateCcw className="w-3 h-3 text-foreground" />
                    </button>
                  </div>
                ) : (
                  <CloudUpload
                    folder="axonometric-technical"
                    accept="image/*"
                    label="Upload technical drawing"
                    onUpload={(urls) => setTechnicalDrawingUrl(urls[0])}
                  />
                )}
                <h3 className="font-display text-xs text-foreground pt-2">CAD Blocks to Insert</h3>
                <p className="font-body text-[10px] text-muted-foreground">
                  Use previously generated CAD blocks or upload custom ones
                </p>
                <div className="flex flex-wrap gap-2">
                  {overlayImages.map((img, i) => (
                    <div key={i} className="relative w-16 h-16 border border-border rounded overflow-hidden group">
                      <img src={img} alt="" className="w-full h-full object-contain bg-white" />
                      <button
                        onClick={() => setOverlayImages((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <RotateCcw className="w-3 h-3 text-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
                {overlayImages.length < 5 && (
                  <CloudUpload
                    folder="axonometric-cad-blocks"
                    accept="image/*"
                    multiple
                    label="Add CAD block images"
                    onUpload={(urls) =>
                      setOverlayImages((prev) => [...prev, ...urls].slice(0, 5))
                    }
                  />
                )}
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={generate}
              disabled={generating || !sourceImage}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Axonometric View
                </>
              )}
            </Button>
          </div>

          {/* Right: Result + Filters */}
          <div className="space-y-6">
            {result ? (
              <>
                <div className="border border-border rounded-lg overflow-hidden">
                  <img
                    src={result.storedUrl || result.imageUrl}
                    alt="Generated axonometric view"
                    className="w-full object-contain"
                    style={filterStyle}
                  />
                </div>

                {/* Filter Controls */}
                <div className="border border-border rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-sm text-foreground">Adjust Filters</h2>
                    <button
                      onClick={resetFilters}
                      className="font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Reset
                    </button>
                  </div>

                  {[
                    { label: "Brightness", value: brightness, set: setBrightness, min: 50, max: 150 },
                    { label: "Contrast", value: contrast, set: setContrast, min: 50, max: 150 },
                    { label: "Saturation", value: saturation, set: setSaturation, min: 0, max: 200 },
                    { label: "Warmth", value: warmth, set: setWarmth, min: 0, max: 50 },
                  ].map((f) => (
                    <div key={f.label} className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="font-body text-xs text-muted-foreground">{f.label}</span>
                        <span className="font-body text-xs text-muted-foreground">{f.value}%</span>
                      </div>
                      <Slider
                        value={[f.value]}
                        onValueChange={([v]) => f.set(v)}
                        min={f.min}
                        max={f.max}
                        step={1}
                      />
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={iterateOnResult} className="flex-1">
                    <Paintbrush className="w-3.5 h-3.5 mr-1.5" />
                    Re-stylize
                  </Button>
                  <Button variant="outline" size="sm" onClick={compositeMode} className="flex-1">
                    <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                    Add Products
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadImage}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Save to Gallery */}
                <div className="border border-border rounded-lg p-5 space-y-3">
                  <h2 className="font-display text-sm text-foreground flex items-center gap-2">
                    <Save className="w-3.5 h-3.5" />Save to Gallery
                  </h2>
                  <Input
                    value={galleryTitle}
                    onChange={(e) => setGalleryTitle(e.target.value)}
                    placeholder="Title (e.g. Marina Bay Living Room)"
                    maxLength={200}
                    className="font-body text-xs"
                  />
                  <Textarea
                    value={galleryDesc}
                    onChange={(e) => setGalleryDesc(e.target.value)}
                    placeholder="Description (optional)"
                    maxLength={500}
                    rows={2}
                    className="font-body text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={savingToGallery || !galleryTitle.trim()}
                      onClick={async () => {
                        await saveToGallery(false);
                      }}
                    >
                      <EyeOff className="w-3.5 h-3.5 mr-1.5" />Save Draft
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={savingToGallery || !galleryTitle.trim()}
                      onClick={async () => {
                        await saveToGallery(true);
                      }}
                    >
                      {savingToGallery ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
                      Save & Publish
                    </Button>
                  </div>
                </div>

                {/* Deliver to requester */}
                {activeRequestId && (
                  <div className="border border-foreground/20 rounded-lg p-5 space-y-3 bg-muted/20">
                    <h2 className="font-display text-sm text-foreground">Deliver to Requester</h2>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes for the user (optional)…"
                      maxLength={1000}
                      rows={2}
                      className="font-body text-xs"
                    />
                    <Button onClick={completeRequest} className="w-full" size="sm">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Mark Complete & Deliver Result
                    </Button>
                  </div>
                )}

                {result.text && (
                  <p className="font-body text-xs text-muted-foreground italic">{result.text}</p>
                )}
              </>
            ) : (
              <div className="border border-dashed border-border rounded-lg flex items-center justify-center min-h-[400px]">
                <p className="font-body text-sm text-muted-foreground">
                  Generated axonometric view will appear here
                </p>
              </div>
            )}

            {/* History */}
            {history.length > 1 && (
              <div className="border border-border rounded-lg p-5 space-y-3">
                <h2 className="font-display text-sm text-foreground">Generation History</h2>
                <div className="grid grid-cols-4 gap-2">
                  {history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => setResult(h)}
                      className={`border rounded overflow-hidden transition-all ${
                        result === h ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <img
                        src={h.storedUrl || h.imageUrl}
                        alt=""
                        className="w-full aspect-square object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TradeAxonometric;
