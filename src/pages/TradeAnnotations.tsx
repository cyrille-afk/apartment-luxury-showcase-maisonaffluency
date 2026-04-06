import { Helmet } from "react-helmet-async";
import { CATEGORY_ORDER, SUBCATEGORY_MAP } from "@/lib/productTaxonomy";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import { Upload, X, Plus, Image as ImageIcon, Search, Save, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Pin {
  id: string;
  x: number;
  y: number;
  text: string;
}

interface DbImage {
  id: string;
  name: string;
  brand: string;
  image_url: string;
  category: string;
  subcategory: string;
  source: "product" | "pick";
}

interface SavedAnnotation {
  id: string;
  title: string;
  image_url: string;
  pins: Pin[];
  updated_at: string;
}

export default function TradeAnnotations() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Persistence
  const [currentAnnotationId, setCurrentAnnotationId] = useState<string | null>(null);
  const [annotationTitle, setAnnotationTitle] = useState("Untitled");
  const [savedAnnotations, setSavedAnnotations] = useState<SavedAnnotation[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // Load saved annotations list
  const loadSavedAnnotations = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingList(false); return; }
    const { data } = await supabase
      .from("markup_annotations")
      .select("id, title, image_url, pins, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) {
      setSavedAnnotations(data.map((d: any) => ({
        ...d,
        pins: (d.pins as Pin[]) || [],
      })));
    }
    setLoadingList(false);
  }, []);

  useEffect(() => { loadSavedAnnotations(); }, [loadSavedAnnotations]);

  // Save current annotation
  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please log in to save annotations"); return; }
    if (!imageUrl) return;
    setSaving(true);
    try {
      if (currentAnnotationId) {
        await supabase
          .from("markup_annotations")
          .update({ title: annotationTitle, image_url: imageUrl, pins: pins as any, updated_at: new Date().toISOString() })
          .eq("id", currentAnnotationId);
        toast.success("Annotation saved");
      } else {
        const { data } = await supabase
          .from("markup_annotations")
          .insert({ user_id: user.id, title: annotationTitle, image_url: imageUrl, pins: pins as any })
          .select("id")
          .single();
        if (data) setCurrentAnnotationId(data.id);
        toast.success("Annotation created");
      }
      loadSavedAnnotations();
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  // Load a saved annotation
  const openAnnotation = (ann: SavedAnnotation) => {
    setCurrentAnnotationId(ann.id);
    setAnnotationTitle(ann.title);
    setImageUrl(ann.image_url);
    setPins(ann.pins);
    setActivePin(null);
    setIsPlacing(false);
  };

  // Delete a saved annotation
  const deleteAnnotation = async (id: string) => {
    await supabase.from("markup_annotations").delete().eq("id", id);
    if (currentAnnotationId === id) {
      setCurrentAnnotationId(null);
      setImageUrl(null);
      setPins([]);
      setAnnotationTitle("Untitled");
    }
    toast.success("Annotation deleted");
    loadSavedAnnotations();
  };

  // Start fresh
  const startNew = () => {
    setCurrentAnnotationId(null);
    setAnnotationTitle("Untitled");
    setImageUrl(null);
    setPins([]);
    setActivePin(null);
    setIsPlacing(false);
  };

  // Database image picker — use same data source as Gallery
  const [browseOpen, setBrowseOpen] = useState(false);
  const [dbSearch, setDbSearch] = useState("");
  const { allProducts } = useTradeProducts();

  // Filter products for the browse dialog (same data as Gallery)
  const dbImages: DbImage[] = useMemo(() => {
    const seen = new Set<string>();
    const results: DbImage[] = [];
    const q = dbSearch.trim().toLowerCase();

    for (const p of allProducts) {
      if (!p.image_url) continue;
      const key = `${p.brand_name.toLowerCase()}|${p.product_name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (q && !p.product_name.toLowerCase().includes(q) && !p.brand_name.toLowerCase().includes(q)) continue;

      results.push({
        id: p.id,
        name: p.product_name,
        brand: p.brand_name,
        image_url: p.image_url,
        category: p.category || "Décor",
        subcategory: p.subcategory || "Decorative Objects",
        source: "pick",
      });
    }
    return results;
  }, [allProducts, dbSearch]);

  const selectDbImage = (url: string) => {
    setImageUrl(url);
    setPins([]);
    setCurrentAnnotationId(null);
    setAnnotationTitle("Untitled");
    setBrowseOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPins([]);
    setCurrentAnnotationId(null);
    setAnnotationTitle("Untitled");
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlacing || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newPin: Pin = { id: crypto.randomUUID(), x, y, text: "" };
    setPins((prev) => [...prev, newPin]);
    setActivePin(newPin.id);
    setIsPlacing(false);
  };

  const updatePinText = (id: string, text: string) => {
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));
  };

  const removePin = (id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
    if (activePin === id) setActivePin(null);
  };

  return (
    <>
      <Helmet><title>Markup & Annotation — Trade Portal</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground">Markup & Annotation</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Pin comments directly on floor plans, renders, or product photos for team and client review.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {imageUrl && (
              <>
                <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsPlacing(!isPlacing)} className={isPlacing ? "border-primary text-primary" : ""}>
                  <Plus className="h-4 w-4 mr-2" />
                  {isPlacing ? "Click image to place pin" : "Add Pin"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Saved annotations list */}
        {!loadingList && savedAnnotations.length > 0 && !imageUrl && (
          <div className="space-y-2">
            <p className="font-display text-xs uppercase tracking-wider text-muted-foreground">
              Your saved annotations
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedAnnotations.map(ann => (
                <div key={ann.id} className="border border-border rounded-lg p-3 hover:border-foreground/30 transition-colors group">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded bg-muted shrink-0 overflow-hidden">
                      <img src={ann.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm text-foreground truncate">{ann.title}</p>
                      <p className="font-body text-xs text-muted-foreground mt-0.5">
                        {ann.pins.length} pin{ann.pins.length !== 1 ? "s" : ""} · {new Date(ann.updated_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openAnnotation(ann)}>
                          <FolderOpen className="h-3 w-3 mr-1" /> Open
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive opacity-0 group-hover:opacity-100" onClick={() => deleteAnnotation(ann.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4 mt-4" />
          </div>
        )}

        {!imageUrl ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-foreground/30 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-body text-sm text-muted-foreground">Upload from your device</p>
              <p className="font-body text-xs text-muted-foreground/60 mt-1">JPG, PNG up to 20MB</p>
              <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </label>
            <button
              onClick={() => setBrowseOpen(true)}
              className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-foreground/30 transition-colors"
            >
              <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-body text-sm text-muted-foreground">Browse product photos</p>
              <p className="font-body text-xs text-muted-foreground/60 mt-1">From your showroom database</p>
            </button>
          </div>
        ) : (
          <div className="flex gap-6 flex-col lg:flex-row">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Input
                  value={annotationTitle}
                  onChange={(e) => setAnnotationTitle(e.target.value)}
                  className="font-display text-sm h-8 w-48"
                  placeholder="Annotation title…"
                />
                <Button variant="ghost" size="sm" onClick={startNew} className="text-xs text-muted-foreground">
                  ← New
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setBrowseOpen(true)} className="text-xs text-muted-foreground">
                  <ImageIcon className="h-3 w-3 mr-1" /> Browse database
                </Button>
              </div>
              <div
                ref={imgRef}
                onClick={handleImageClick}
                className={`relative border border-border rounded-lg overflow-hidden ${isPlacing ? "cursor-crosshair" : ""}`}
              >
                <img src={imageUrl} alt="Annotated" className="w-full h-auto" />
                {pins.map((pin, i) => (
                  <button
                    key={pin.id}
                    onClick={(e) => { e.stopPropagation(); setActivePin(pin.id); }}
                    className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${activePin === pin.id ? "bg-primary text-primary-foreground scale-110 shadow-lg" : "bg-foreground text-background shadow-md hover:scale-105"}`}
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full lg:w-80 space-y-2 shrink-0">
              <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                {pins.length} annotation{pins.length !== 1 ? "s" : ""}
              </p>
              {pins.length === 0 && (
                <p className="font-body text-xs text-muted-foreground/70">Click "Add Pin" then click on the image to place annotations.</p>
              )}
              {pins.map((pin, i) => (
                <div
                  key={pin.id}
                  className={`p-3 rounded-lg border transition-colors ${activePin === pin.id ? "border-primary bg-primary/5" : "border-border"}`}
                  onClick={() => setActivePin(pin.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display text-xs text-foreground">Pin {i + 1}</span>
                    <button onClick={() => removePin(pin.id)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <Textarea
                    value={pin.text}
                    onChange={(e) => updatePinText(pin.id, e.target.value)}
                    placeholder="Add a note..."
                    className="font-body text-xs min-h-[60px] resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Database image picker dialog */}
      <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Browse Product Photos</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={dbSearch}
              onChange={e => setDbSearch(e.target.value)}
              placeholder="Search by product or brand…"
              className="pl-9"
            />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 mt-2">
            {dbImages.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No images found</p>
            ) : (
              (() => {
                const byCat: Record<string, Record<string, DbImage[]>> = {};
                dbImages.forEach(img => {
                  const cat = img.category || "Uncategorized";
                  const sub = img.subcategory || "Other";
                  if (!byCat[cat]) byCat[cat] = {};
                  if (!byCat[cat][sub]) byCat[cat][sub] = [];
                  byCat[cat][sub].push(img);
                });
                const catKeys = Object.keys(byCat).sort((a, b) => {
                  const ai = CATEGORY_ORDER.indexOf(a);
                  const bi = CATEGORY_ORDER.indexOf(b);
                  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                });
                return catKeys.map(cat => {
                  const subs = byCat[cat];
                  const canonicalSubs = SUBCATEGORY_MAP[cat] || [];
                  const subKeys = Object.keys(subs).sort((a, b) => {
                    const ai = canonicalSubs.indexOf(a);
                    const bi = canonicalSubs.indexOf(b);
                    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                  });
                  return (
                    <div key={cat} className="mb-4">
                      <div className="sticky top-0 z-20 bg-foreground px-3 py-2.5 border-b border-border">
                        <p className="font-display text-xs uppercase tracking-[0.2em] text-background font-semibold">
                          {cat}
                        </p>
                      </div>
                      {subKeys.map(sub => (
                        <div key={sub} className="mb-1">
                          <div className="sticky top-[38px] z-10 bg-muted/80 backdrop-blur-sm px-3 py-1.5 border-b border-border/50">
                            <p className="font-display text-[11px] uppercase tracking-wider text-foreground/70 font-medium">
                              {sub} <span className="text-muted-foreground/50 ml-1">({subs[sub].length})</span>
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            {(() => {
                              // Group items by brand within this subcategory
                              const byBrand: Record<string, DbImage[]> = {};
                              subs[sub].forEach(img => {
                                const b = img.brand || "Unknown";
                                if (!byBrand[b]) byBrand[b] = [];
                                byBrand[b].push(img);
                              });
                              const brandKeys = Object.keys(byBrand).sort((a, b) => a.localeCompare(b));
                              return brandKeys.map(brand => (
                                <div key={brand}>
                                  <p className="font-display text-[10px] uppercase tracking-wider text-muted-foreground/60 px-2 pt-2 pb-0.5">{brand}</p>
                                  {byBrand[brand].map(img => (
                                    <button
                                      key={`${img.source}-${img.id}`}
                                      onClick={() => selectDbImage(img.image_url)}
                                      className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                                    >
                                      <div className="w-12 h-12 rounded bg-muted shrink-0 overflow-hidden">
                                        <img src={img.image_url} alt={img.name} className="w-full h-full object-cover" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="font-body text-sm text-foreground truncate">{img.name}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
