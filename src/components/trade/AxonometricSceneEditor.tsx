import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import { CATEGORY_ORDER, SUBCATEGORY_MAP } from "@/lib/productTaxonomy";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  X, Eraser, Move, RotateCcw, Search, Wand2, Loader2,
  ZoomIn, ZoomOut, Trash2, RotateCw, Maximize2, Minimize2,
} from "lucide-react";

interface PlacedProduct {
  id: string;
  image_url: string;
  product_name: string;
  brand_name: string;
  x: number; // percent
  y: number; // percent
  width: number; // percent of canvas
  rotation: number; // degrees
  opacity: number;
}

interface Props {
  imageUrl: string;
  style: string;
  onClose: () => void;
  onResult: (result: { imageUrl: string; storedUrl: string | null; text: string }) => void;
}

type Tool = "select" | "erase";

const AxonometricSceneEditor = ({ imageUrl, style, onClose, onResult }: Props) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [placedProducts, setPlacedProducts] = useState<PlacedProduct[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [sceneCategory, setSceneCategory] = useState("");
  const [sceneSubcategory, setSceneSubcategory] = useState("");
  const [generating, setGenerating] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [hasMask, setHasMask] = useState(false);

  // Load image to get dimensions
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      // Init canvas
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Product picker data
  const products = useMemo(() => {
    let all = getAllTradeProducts().filter((p) => p.image_url);
    if (sceneCategory) all = all.filter((p) => p.category === sceneCategory);
    if (sceneSubcategory) all = all.filter((p) => p.subcategory === sceneSubcategory);
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      all = all.filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          p.brand_name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.subcategory && p.subcategory.toLowerCase().includes(q)) ||
          (p.materials && p.materials.toLowerCase().includes(q)) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return all.slice(0, 30);
  }, [productSearch, sceneCategory, sceneSubcategory]);

  // Drawing (eraser)
  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const draw = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || tool !== "erase") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const { x, y } = getCanvasCoords(e);
    const scaledBrush = brushSize * (canvas.width / (canvas.getBoundingClientRect().width || 1));
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.arc(x, y, scaledBrush / 2, 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  }, [isDrawing, tool, brushSize, getCanvasCoords]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === "erase") {
      setIsDrawing(true);
      draw(e);
    }
  }, [tool, draw]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // Drag product overlays
  const handleProductMouseDown = useCallback((e: React.MouseEvent, item: PlacedProduct) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelectedItemId(item.id);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setDragging({
      id: item.id,
      offsetX: e.clientX - (rect.left + (item.x / 100) * rect.width),
      offsetY: e.clientY - (rect.top + (item.y / 100) * rect.height),
    });
  }, [tool]);

  const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newX = ((e.clientX - dragging.offsetX - rect.left) / rect.width) * 100;
      const newY = ((e.clientY - dragging.offsetY - rect.top) / rect.height) * 100;
      setPlacedProducts((prev) =>
        prev.map((p) =>
          p.id === dragging.id ? { ...p, x: Math.max(0, Math.min(95, newX)), y: Math.max(0, Math.min(95, newY)) } : p
        )
      );
    }
    if (tool === "erase" && isDrawing) {
      draw(e);
    }
  }, [dragging, tool, isDrawing, draw]);

  const handleContainerMouseUp = useCallback(() => {
    setDragging(null);
    setIsDrawing(false);
  }, []);

  // Add product to scene
  const addProduct = useCallback((product: { product_name: string; brand_name: string; image_url: string }) => {
    const newItem: PlacedProduct = {
      id: `pp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      image_url: product.image_url,
      product_name: product.product_name,
      brand_name: product.brand_name,
      x: 30 + Math.random() * 20,
      y: 30 + Math.random() * 20,
      width: 15,
      rotation: 0,
      opacity: 1,
    };
    setPlacedProducts((prev) => [...prev, newItem]);
    setSelectedItemId(newItem.id);
    setTool("select");
  }, []);

  const removeProduct = useCallback((id: string) => {
    setPlacedProducts((prev) => prev.filter((p) => p.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  }, [selectedItemId]);

  const updateProduct = useCallback((id: string, updates: Partial<PlacedProduct>) => {
    setPlacedProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const clearMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasMask(false);
    }
  }, []);

  const selectedItem = placedProducts.find((p) => p.id === selectedItemId);

  // Generate with AI
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Get mask as data URL
      const canvas = canvasRef.current;
      let maskDataUrl: string | null = null;
      if (canvas && hasMask) {
        maskDataUrl = canvas.toDataURL("image/png");
      }

      // Build placement descriptions
      const placements = placedProducts.map((p) => ({
        product_name: p.product_name,
        brand_name: p.brand_name,
        image_url: p.image_url,
        position: { x_percent: Math.round(p.x), y_percent: Math.round(p.y) },
        size_percent: Math.round(p.width),
        rotation_degrees: Math.round(p.rotation),
      }));

      const { data, error } = await supabase.functions.invoke("axonometric-generate", {
        body: {
          imageUrl,
          mode: "scene_edit",
          style,
          maskDataUrl,
          placements,
          overlayImages: placedProducts.map((p) => p.image_url),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onResult({
        imageUrl: data.imageUrl,
        storedUrl: data.storedUrl,
        text: data.text || "",
      });

      toast({ title: "Scene rendered successfully" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Rendering failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-sm text-foreground">Scene Editor</h2>
          <div className="h-4 w-px bg-border" />
          {/* Tool buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTool("select")}
              className={`p-1.5 rounded transition-colors ${tool === "select" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              title="Select & Move"
            >
              <Move className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool("erase")}
              className={`p-1.5 rounded transition-colors ${tool === "erase" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              title="Eraser — mark furniture to remove"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>

          {tool === "erase" && (
            <div className="flex items-center gap-2 ml-2">
              <span className="font-body text-[10px] text-muted-foreground">Brush</span>
              <Slider
                value={[brushSize]}
                onValueChange={([v]) => setBrushSize(v)}
                min={10}
                max={80}
                step={1}
                className="w-24"
              />
              <span className="font-body text-[10px] text-muted-foreground w-6">{brushSize}</span>
              <button onClick={clearMask} className="font-body text-[10px] text-muted-foreground hover:text-foreground ml-1" title="Clear mask">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="h-4 w-px bg-border ml-2" />
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} className="p-1 text-muted-foreground hover:text-foreground">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-body text-[10px] text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="p-1 text-muted-foreground hover:text-foreground">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating || (!hasMask && placedProducts.length === 0)}
          >
            {generating ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Rendering…</>
            ) : (
              <><Wand2 className="w-3.5 h-3.5 mr-1.5" />AI Render</>
            )}
          </Button>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-4">
          <div
            ref={containerRef}
            className="relative"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onMouseLeave={handleContainerMouseUp}
          >
            {/* Base image */}
            <img
              src={imageUrl}
              alt="Scene"
              className="block max-w-none select-none"
              style={{ width: imgSize.w ? `${imgSize.w}px` : "auto", height: imgSize.h ? `${imgSize.h}px` : "auto", maxWidth: "none" }}
              draggable={false}
            />

            {/* Mask canvas overlay */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{
                cursor: tool === "erase" ? "crosshair" : "default",
                pointerEvents: tool === "erase" ? "auto" : "none",
                mixBlendMode: "multiply",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={draw}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            {/* Placed product overlays */}
            {placedProducts.map((item) => (
              <div
                key={item.id}
                className={`absolute select-none ${tool === "select" ? "cursor-move" : "pointer-events-none"}`}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.width}%`,
                  transform: `rotate(${item.rotation}deg)`,
                  opacity: item.opacity,
                  outline: selectedItemId === item.id ? "2px solid hsl(var(--foreground))" : "1px dashed hsl(var(--border))",
                  outlineOffset: "2px",
                  zIndex: selectedItemId === item.id ? 20 : 10,
                }}
                onMouseDown={(e) => handleProductMouseDown(e, item)}
                onClick={(e) => { e.stopPropagation(); setSelectedItemId(item.id); }}
              >
                <img
                  src={item.image_url}
                  alt={item.product_name}
                  className="w-full h-auto pointer-events-none"
                  draggable={false}
                />
                {selectedItemId === item.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeProduct(item.id); }}
                    className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-72 border-l border-border flex flex-col shrink-0 bg-background">
          {/* Selected Item Properties */}
          {selectedItem && (
            <div className="border-b border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-display text-xs text-foreground truncate">{selectedItem.product_name}</p>
                <button onClick={() => removeProduct(selectedItem.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="font-body text-[10px] text-muted-foreground">{selectedItem.brand_name}</p>

              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-body text-[10px] text-muted-foreground">Size</span>
                    <span className="font-body text-[10px] text-muted-foreground">{selectedItem.width}%</span>
                  </div>
                  <Slider
                    value={[selectedItem.width]}
                    onValueChange={([v]) => updateProduct(selectedItem.id, { width: v })}
                    min={3}
                    max={60}
                    step={1}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-body text-[10px] text-muted-foreground">Rotation</span>
                    <span className="font-body text-[10px] text-muted-foreground">{selectedItem.rotation}°</span>
                  </div>
                  <Slider
                    value={[selectedItem.rotation]}
                    onValueChange={([v]) => updateProduct(selectedItem.id, { rotation: v })}
                    min={-180}
                    max={180}
                    step={1}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-body text-[10px] text-muted-foreground">Opacity</span>
                    <span className="font-body text-[10px] text-muted-foreground">{Math.round(selectedItem.opacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[selectedItem.opacity * 100]}
                    onValueChange={([v]) => updateProduct(selectedItem.id, { opacity: v / 100 })}
                    min={20}
                    max={100}
                    step={1}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Product Picker */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border space-y-2">
              <p className="font-display text-xs text-foreground">Add Products</p>
              <div className="flex gap-1.5">
                <select
                  value={sceneCategory}
                  onChange={(e) => { setSceneCategory(e.target.value); setSceneSubcategory(""); }}
                  className="flex-1 border border-border rounded-md px-2 py-1.5 font-body text-[10px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                >
                  <option value="">All Categories</option>
                  {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {sceneCategory && (SUBCATEGORY_MAP[sceneCategory] || []).length > 0 && (
                  <select
                    value={sceneSubcategory}
                    onChange={(e) => setSceneSubcategory(e.target.value)}
                    className="flex-1 border border-border rounded-md px-2 py-1.5 font-body text-[10px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                  >
                    <option value="">All {sceneCategory}</option>
                    {(SUBCATEGORY_MAP[sceneCategory] || []).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full pl-8 pr-3 py-1.5 border border-border rounded-md font-body text-xs bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-3 gap-1.5">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      p.image_url &&
                      addProduct({
                        product_name: p.product_name,
                        brand_name: p.brand_name,
                        image_url: p.image_url!,
                      })
                    }
                    className="rounded border border-border overflow-hidden text-left hover:border-foreground/30 transition-colors"
                    title={`${p.product_name} — ${p.brand_name}`}
                  >
                    <img src={p.image_url!} alt={p.product_name} className="w-full aspect-square object-cover" />
                    <div className="px-1 py-0.5">
                      <p className="font-body text-[8px] text-foreground truncate">{p.product_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="border-t border-border p-3">
            <div className="bg-muted/50 rounded-md p-2.5 space-y-1">
              <p className="font-display text-[10px] text-foreground">How to use</p>
              <ul className="font-body text-[9px] text-muted-foreground space-y-0.5 list-disc pl-3">
                <li><strong>Eraser</strong> — paint over furniture to remove</li>
                <li><strong>Products</strong> — click to place, drag to position</li>
                <li><strong>Size/Rotate</strong> — adjust in the properties panel</li>
                <li><strong>AI Render</strong> — generates the final composition</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AxonometricSceneEditor;
