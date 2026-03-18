import { useState, useRef, useMemo, useCallback } from "react";
import { getAllTradeProducts, getAllBrands } from "@/lib/tradeProducts";
import { CATEGORY_ORDER, SUBCATEGORY_MAP } from "@/lib/productTaxonomy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Wand2, Search, X, GripVertical, ExternalLink, Download, ArrowLeft,
} from "lucide-react";

const toAbsoluteUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
};

interface PinnedProduct {
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string;
  dimensions?: string;
  materials?: string;
  x_percent: number;
  y_percent: number;
}

interface ProposalBuilderProps {
  furnishedImageUrl: string;
  emptyRoomUrl: string | null;
  emptyRoomGenerating: boolean;
  style: string;
  onClose: () => void;
  onResult?: (result: { imageUrl: string; storedUrl: string | null; text: string; pinnedProducts: PinnedProduct[] }) => void;
}

let _pinId = 0;
const nextPinId = () => `pin-${++_pinId}-${Date.now()}`;

export default function ProposalBuilder({
  furnishedImageUrl,
  emptyRoomUrl,
  emptyRoomGenerating,
  style,
  onClose,
  onResult,
}: ProposalBuilderProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [pins, setPins] = useState<PinnedProduct[]>([]);
  const [generating, setGenerating] = useState(false);
  const [proposalResult, setProposalResult] = useState<string | null>(null);

  // Product picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [brand, setBrand] = useState("");

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const products = useMemo(() => {
    let all = getAllTradeProducts().filter((p) => p.image_url);
    if (category) all = all.filter((p) => p.category === category);
    if (subcategory) all = all.filter((p) => p.subcategory === subcategory);
    if (brand) all = all.filter((p) => p.brand_name === brand);
    if (search.trim()) {
      const q = search.toLowerCase();
      all = all.filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          p.brand_name.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return all.slice(0, 24);
  }, [search, category, subcategory, brand]);

  const brands = useMemo(() => getAllBrands(getAllTradeProducts()), []);
  const subcategories = category ? (SUBCATEGORY_MAP[category] || []) : [];

  const addPin = useCallback((product: { product_name: string; brand_name: string; image_url: string; dimensions?: string; materials?: string }) => {
    if (pins.length >= 5) {
      toast({ title: "Maximum 5 products per proposal", variant: "destructive" });
      return;
    }
    setPins((prev) => [
      ...prev,
      {
        id: nextPinId(),
        product_name: product.product_name,
        brand_name: product.brand_name,
        image_url: product.image_url,
        dimensions: product.dimensions,
        materials: product.materials,
        x_percent: 30 + Math.random() * 40,
        y_percent: 30 + Math.random() * 40,
      },
    ]);
  }, [pins.length, toast]);

  const removePin = useCallback((id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, pinId: string) => {
    e.preventDefault();
    setDraggingId(pinId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pin = pins.find((p) => p.id === pinId);
    if (!pin) return;
    const pinX = (pin.x_percent / 100) * rect.width;
    const pinY = (pin.y_percent / 100) * rect.height;
    dragOffset.current = { x: e.clientX - rect.left - pinX, y: e.clientY - rect.top - pinY };
  }, [pins]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left - dragOffset.current.x) / rect.width) * 100;
    const y = ((e.clientY - rect.top - dragOffset.current.y) / rect.height) * 100;
    setPins((prev) =>
      prev.map((p) =>
        p.id === draggingId
          ? { ...p, x_percent: Math.max(2, Math.min(98, x)), y_percent: Math.max(2, Math.min(98, y)) }
          : p
      )
    );
  }, [draggingId]);

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
  }, []);

  const generateProposal = async () => {
    if (!emptyRoomUrl || pins.length === 0) return;
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please sign in again.");

      const placements = pins.map((p) => ({
        product_name: p.product_name,
        brand_name: p.brand_name,
        image_url: toAbsoluteUrl(p.image_url),
        x_percent: Math.round(p.x_percent),
        y_percent: Math.round(p.y_percent),
      }));

      const { data, error } = await supabase.functions.invoke("axonometric-generate", {
        body: {
          imageUrl: toAbsoluteUrl(emptyRoomUrl),
          mode: "proposal_render",
          style,
          placements,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const resultUrl = data.storedUrl || data.imageUrl;
      setProposalResult(resultUrl);
      onResult?.({ imageUrl: data.imageUrl, storedUrl: data.storedUrl, text: data.text, pinnedProducts: pins });
      toast({ title: "Proposal generated successfully" });
    } catch (e: any) {
      toast({ title: "Proposal generation failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const downloadProposal = () => {
    if (!proposalResult) return;
    const a = document.createElement("a");
    a.href = proposalResult;
    a.download = `proposal-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-sm text-foreground">Proposal Builder</h2>
            <p className="font-body text-[11px] text-muted-foreground">
              Drag products onto the empty room to compose a furniture proposal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={generateProposal}
            disabled={generating || !emptyRoomUrl || pins.length === 0}
          >
            {generating ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
            ) : (
              <><Wand2 className="w-3.5 h-3.5 mr-1.5" />Generate Proposal ({pins.length})</>
            )}
          </Button>
          {proposalResult && (
            <Button variant="outline" size="sm" onClick={downloadProposal}>
              <Download className="w-3.5 h-3.5 mr-1.5" />Download
            </Button>
          )}
        </div>
      </div>

      {/* Side-by-side view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Original furnished */}
        <div className="space-y-2">
          <h3 className="font-display text-xs text-muted-foreground uppercase tracking-wider">
            Client's Original Layout
          </h3>
          <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
            <img
              src={furnishedImageUrl}
              alt="Original furnished layout"
              className="w-full object-contain"
            />
          </div>
        </div>

        {/* Right: Empty room with pins */}
        <div className="space-y-2">
          <h3 className="font-display text-xs text-muted-foreground uppercase tracking-wider">
            {proposalResult ? "Generated Proposal" : "Your Proposal — Drag to Position"}
          </h3>

          {proposalResult ? (
            <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
              <img src={proposalResult} alt="Generated proposal" className="w-full object-contain" />
            </div>
          ) : emptyRoomUrl ? (
            <div
              ref={canvasRef}
              className="border border-border rounded-lg overflow-hidden bg-muted/10 relative select-none"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: draggingId ? "grabbing" : "default" }}
            >
              <img
                src={emptyRoomUrl}
                alt="Empty room template"
                className="w-full object-contain pointer-events-none"
                draggable={false}
              />

              {/* Draggable pins */}
              {pins.map((pin) => (
                <div
                  key={pin.id}
                  className="absolute group"
                  style={{
                    left: `${pin.x_percent}%`,
                    top: `${pin.y_percent}%`,
                    transform: "translate(-50%, -50%)",
                    zIndex: draggingId === pin.id ? 50 : 10,
                  }}
                >
                  <div
                    className={`flex flex-col items-center ${draggingId === pin.id ? "scale-110" : ""} transition-transform`}
                    onMouseDown={(e) => handleMouseDown(e, pin.id)}
                    style={{ cursor: draggingId === pin.id ? "grabbing" : "grab" }}
                  >
                    {/* Product thumbnail */}
                    <div className="w-14 h-14 rounded-md border-2 border-foreground bg-background shadow-lg overflow-hidden">
                      <img src={pin.image_url} alt={pin.product_name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                    </div>
                    {/* Label */}
                    <div className="mt-1 bg-foreground text-background px-2 py-0.5 rounded text-center max-w-[120px] shadow-md">
                      <p className="font-display text-[9px] truncate">{pin.product_name}</p>
                      <p className="font-body text-[8px] opacity-70 truncate">{pin.brand_name}</p>
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removePin(pin.id); }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : emptyRoomGenerating ? (
            <div className="border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <p className="font-body text-xs text-muted-foreground">Generating empty room…</p>
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-lg flex items-center justify-center min-h-[300px]">
              <p className="font-body text-xs text-muted-foreground">Empty room will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Pinned products summary */}
      {pins.length > 0 && (
        <div className="border border-border rounded-lg p-4">
          <h3 className="font-display text-xs text-foreground mb-3">Pinned Products ({pins.length}/5)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {pins.map((pin) => (
              <div key={pin.id} className="flex items-center gap-2 bg-muted/30 rounded-md px-2.5 py-2 group">
                <img src={pin.image_url} alt="" className="w-9 h-9 rounded border border-border object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[10px] text-foreground truncate">{pin.product_name}</p>
                  <p className="font-body text-[9px] text-muted-foreground truncate">{pin.brand_name}</p>
                  {pin.dimensions && <p className="font-body text-[8px] text-muted-foreground/70 truncate">{pin.dimensions}</p>}
                </div>
                <button
                  onClick={() => removePin(pin.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Picker */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs text-foreground">
            Add Products to Proposal {pins.length >= 5 && <span className="text-muted-foreground">(max reached)</span>}
          </h3>
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className="font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {pickerOpen ? "Collapse" : "Expand"}
          </button>
        </div>

        {pickerOpen && pins.length < 5 && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-9 font-body text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}
                className="flex-1 min-w-[100px] border border-border rounded-md px-2 py-1.5 font-body text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
              >
                <option value="">All Categories</option>
                {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {subcategories.length > 0 && (
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="flex-1 min-w-[100px] border border-border rounded-md px-2 py-1.5 font-body text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                >
                  <option value="">All {category}</option>
                  {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="flex-1 min-w-[100px] border border-border rounded-md px-2 py-1.5 font-body text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
              >
                <option value="">All Brands</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    p.image_url &&
                    addPin({
                      product_name: p.product_name,
                      brand_name: p.brand_name,
                      image_url: p.image_url!,
                      dimensions: p.dimensions,
                      materials: p.materials,
                    })
                  }
                  className="rounded border border-border overflow-hidden text-left transition-all hover:border-foreground/30"
                  title={`${p.product_name} — ${p.brand_name}`}
                >
                  <img src={p.image_url!} alt={p.product_name} className="w-full aspect-square object-cover" />
                  <div className="px-1 py-0.5">
                    <p className="font-body text-[9px] text-foreground truncate">{p.product_name}</p>
                    <p className="font-body text-[8px] text-muted-foreground truncate">{p.brand_name}</p>
                  </div>
                </button>
              ))}
              {products.length === 0 && (
                <p className="col-span-6 font-body text-xs text-muted-foreground py-4 text-center">No products found</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
