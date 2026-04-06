import { Helmet } from "react-helmet-async";
import { normalizeSubcategory } from "@/lib/productTaxonomy";
import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, Plus, Image as ImageIcon, Search, ChevronRight } from "lucide-react";
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

export default function TradeAnnotations() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Database image picker
  const [browseOpen, setBrowseOpen] = useState(false);
  const [dbImages, setDbImages] = useState<DbImage[]>([]);
  const [dbSearch, setDbSearch] = useState("");

  const searchDbImages = useCallback(async (q: string) => {
    const seen = new Set<string>(); // dedupe by normalised "brand|name"
    const results: DbImage[] = [];

    const dedupeKey = (brand: string, name: string) =>
      `${brand.toLowerCase().trim()}|${name.toLowerCase().trim()}`;

    const addUnique = (item: DbImage) => {
      if (!item.image_url) return;
      const key = dedupeKey(item.brand, item.name);
      if (seen.has(key)) return;
      seen.add(key);
      results.push(item);
    };

    // Curator picks first – use parent brand (founder) when available
    let pickQuery = supabase
      .from("designer_curator_picks")
      .select("id, title, image_url, category, subcategory, designers!inner(name, founder)")
      .neq("image_url", "");
    if (q.trim()) {
      pickQuery = pickQuery.or(`title.ilike.%${q}%,designers.name.ilike.%${q}%`);
    }
    const { data: picks } = await pickQuery.order("title").limit(500);
    if (picks) {
      picks.forEach((p: any) => {
        const designer = p.designers;
        // Use the parent brand (founder) if it exists, otherwise the designer name
        const brandName = designer?.founder?.trim() || designer?.name?.trim() || "";
        addUnique({
          id: p.id, name: p.title, brand: brandName,
          image_url: p.image_url, source: "pick",
          category: p.category || "Uncategorized",
          subcategory: normalizeSubcategory(p.subcategory) || p.category || "Other",
        });
      });
    }

    // Trade products (supplement)
    let prodQuery = supabase
      .from("trade_products")
      .select("id, product_name, brand_name, image_url, category, subcategory")
      .eq("is_active", true)
      .not("image_url", "is", null);
    if (q.trim()) {
      prodQuery = prodQuery.or(`product_name.ilike.%${q}%,brand_name.ilike.%${q}%`);
    }
    const { data: prods } = await prodQuery.order("product_name").limit(500);
    if (prods) {
      prods.forEach((p: any) => {
        if (p.image_url) {
          addUnique({
            id: p.id, name: p.product_name, brand: p.brand_name,
            image_url: p.image_url, source: "product",
            category: p.category || "Uncategorized",
            subcategory: normalizeSubcategory(p.subcategory) || p.category || "Other",
          });
        }
      });
    }

    setDbImages(results);
  }, []);

  useEffect(() => {
    if (browseOpen) searchDbImages(dbSearch);
  }, [browseOpen, dbSearch, searchDbImages]);

  const selectDbImage = (url: string) => {
    setImageUrl(url);
    setPins([]);
    setBrowseOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPins([]);
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
              <Button variant="outline" size="sm" onClick={() => setIsPlacing(!isPlacing)} className={isPlacing ? "border-primary text-primary" : ""}>
                <Plus className="h-4 w-4 mr-2" />
                {isPlacing ? "Click image to place pin" : "Add Pin"}
              </Button>
            )}
          </div>
        </div>

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
                <Button variant="ghost" size="sm" onClick={() => { setImageUrl(null); setPins([]); }} className="text-xs text-muted-foreground">
                  ← Change image
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
                const grouped: Record<string, DbImage[]> = {};
                dbImages.forEach(img => {
                  const key = img.subcategory || "Other";
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(img);
                });
                const sortedKeys = Object.keys(grouped).sort();
                return sortedKeys.map(sub => (
                  <div key={sub} className="mb-3">
                    <p className="font-display text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1.5 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border/50">
                      {sub} <span className="text-muted-foreground/50 ml-1">({grouped[sub].length})</span>
                    </p>
                    <div className="space-y-0.5">
                      {grouped[sub].map(img => (
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
                            <p className="font-body text-xs text-muted-foreground truncate">{img.brand}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}