import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, FolderOpen, Camera, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BrandEntry {
  name: string;
  /** URL to the first PDF for this brand (used for auto-thumbnail) */
  pdfUrl?: string | null;
  docCount: number;
}

interface BrandCarouselProps {
  brands: BrandEntry[];
  selectedBrand: string;
  onSelect: (brand: string) => void;
  /** Enable thumbnail upload on each brand (admin mode) */
  editable?: boolean;
  /** Custom label line; defaults to "Browse by brand · N brands A–Z" */
  label?: React.ReactNode;
}

/** Simple hash for cache key */
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  return "brand_" + Math.abs(hash).toString(36);
}

/** Tiny PDF-to-dataURL renderer for brand thumbnails */
function usePdfThumbnail(pdfUrl: string | null | undefined) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;
    const cacheKey = hashUrl(pdfUrl);

    // Check cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setDataUrl(cached); return; }
    } catch {}

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        const pdf = await pdfjsLib.getDocument({ url: pdfUrl, disableAutoFetch: true, disableStream: true }).promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        const scale = 96 / vp.width;
        const svp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = svp.width;
        canvas.height = svp.height;
        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) return;
        await page.render({ canvasContext: ctx, viewport: svp }).promise;
        if (cancelled) return;
        const url = canvas.toDataURL("image/jpeg", 0.6);
        setDataUrl(url);
        try { localStorage.setItem(cacheKey, url); } catch {}
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [pdfUrl]);

  return dataUrl;
}

/** Individual brand tile that may auto-render PDF thumbnail */
const BrandTile = ({
  brand,
  selected,
  onSelect,
  editable,
  isUploading,
  thumbnailUrl,
  onUpload,
  onRemove,
}: {
  brand: BrandEntry;
  selected: boolean;
  onSelect: () => void;
  editable: boolean;
  isUploading: boolean;
  thumbnailUrl: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) => {
  const pdfThumb = usePdfThumbnail(!thumbnailUrl ? brand.pdfUrl : null);
  const thumb = thumbnailUrl || pdfThumb;

  return (
    <div className="shrink-0 relative group/brand">
      <button
        onClick={onSelect}
        className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg border transition-all ${
          selected
            ? "border-foreground bg-foreground/5"
            : "border-transparent hover:border-border"
        }`}
      >
        <div className="w-16 h-16 rounded-md bg-muted/20 overflow-hidden relative">
          {isUploading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : thumb ? (
            <img
              src={thumb}
              alt={brand.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-display text-base text-muted-foreground/40">
                {brand.name.charAt(0)}
              </span>
            </div>
          )}
        </div>
        <span className="font-body text-[11px] text-foreground whitespace-nowrap max-w-[80px] truncate">
          {brand.name}
        </span>
      </button>

      {/* Admin upload/remove overlay */}
      {editable && !isUploading && (
        <div className="absolute top-1 right-0.5 flex flex-col gap-0.5 z-10">
          <label
            className="p-1 rounded-full bg-background/80 border border-border shadow-sm cursor-pointer hover:bg-muted"
            title={`Upload thumbnail for ${brand.name}`}
          >
            <Camera className="w-3 h-3 text-muted-foreground" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
          </label>
          {thumbnailUrl && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded-full bg-background/80 border border-border shadow-sm hover:bg-destructive/10 hover:border-destructive/30"
              title={`Remove thumbnail for ${brand.name}`}
            >
              <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const BrandCarousel = ({ brands, selectedBrand, onSelect, editable = false, label }: BrandCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [uploadingBrand, setUploadingBrand] = useState<string | null>(null);
  const [brandThumbnails, setBrandThumbnails] = useState<Record<string, string>>({});

  // Fetch brand thumbnails from dedicated table
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("brand_thumbnails").select("brand_name, thumbnail_url");
      if (data) {
        const map: Record<string, string> = {};
        for (const row of data) map[row.brand_name] = row.thumbnail_url;
        setBrandThumbnails(map);
      }
    })();
  }, []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
  };

  const handleThumbnailUpload = async (brandName: string, file: File) => {
    setUploadingBrand(brandName);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `brand-thumbnails/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("assets").upload(path, file, {
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Upsert into brand_thumbnails table
      const { error: upsertError } = await supabase
        .from("brand_thumbnails")
        .upsert({ brand_name: brandName, thumbnail_url: publicUrl }, { onConflict: "brand_name" });

      if (upsertError) throw upsertError;

      setBrandThumbnails(prev => ({ ...prev, [brandName]: publicUrl }));
      toast({ title: `Thumbnail set for ${brandName}` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingBrand(null);
    }
  };

  const handleThumbnailRemove = async (brandName: string) => {
    setUploadingBrand(brandName);
    try {
      const { error } = await supabase
        .from("brand_thumbnails")
        .delete()
        .eq("brand_name", brandName);
      if (error) throw error;
      setBrandThumbnails(prev => {
        const next = { ...prev };
        delete next[brandName];
        return next;
      });
      toast({ title: `Thumbnail removed for ${brandName}` });
    } catch (err: any) {
      toast({ title: "Remove failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingBrand(null);
    }
  };

  if (brands.length === 0) return null;

  return (
    <div className="relative mb-6">
      {label || (
        <p className="font-body text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-2">
          Browse by brand · {brands.length} brands A–Z
        </p>
      )}

      <div className="relative group">
        <button
          onClick={() => scroll("left")}
          className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-background/90 border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-foreground" />
        </button>
        <button
          onClick={() => scroll("right")}
          className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-background/90 border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-3.5 h-3.5 text-foreground" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* All brands chip */}
          <button
            onClick={() => onSelect("all")}
            className={`shrink-0 flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border transition-all ${
              selectedBrand === "all"
                ? "border-foreground bg-foreground/5"
                : "border-border hover:border-foreground/20"
            }`}
          >
            <div className="w-16 h-16 rounded-md bg-muted/30 flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-muted-foreground" />
            </div>
            <span className="font-body text-[11px] text-foreground whitespace-nowrap">All</span>
          </button>

          {brands.map((brand) => (
            <BrandTile
              key={brand.name}
              brand={brand}
              selected={selectedBrand === brand.name}
              onSelect={() => onSelect(brand.name === selectedBrand ? "all" : brand.name)}
              editable={editable}
              isUploading={uploadingBrand === brand.name}
              thumbnailUrl={brandThumbnails[brand.name] || null}
              onUpload={(file) => handleThumbnailUpload(brand.name, file)}
              onRemove={() => handleThumbnailRemove(brand.name)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default BrandCarousel;
