import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FolderOpen, Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BrandEntry {
  name: string;
  /** Cover image, first PDF cover, or null */
  thumbnailUrl: string | null;
  docCount: number;
}

interface BrandCarouselProps {
  brands: BrandEntry[];
  selectedBrand: string;
  onSelect: (brand: string) => void;
  /** Enable thumbnail upload on each brand (admin mode) */
  editable?: boolean;
  /** Called after a thumbnail is uploaded so parent can refetch */
  onThumbnailUpdated?: () => void;
}

const BrandCarousel = ({ brands, selectedBrand, onSelect, editable = false, onThumbnailUpdated }: BrandCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [uploadingBrand, setUploadingBrand] = useState<string | null>(null);

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

      // Update all documents for this brand with the new cover image
      const { error: updateError } = await supabase
        .from("trade_documents")
        .update({ cover_image_url: publicUrl })
        .eq("brand_name", brandName);

      if (updateError) throw updateError;

      toast({ title: `Thumbnail set for ${brandName}` });
      onThumbnailUpdated?.();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingBrand(null);
    }
  };

  if (brands.length === 0) return null;

  return (
    <div className="relative mb-6">
      {/* Section label */}
      <p className="font-body text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-2">
        Browse by brand · {brands.length} brands A–Z
      </p>

      <div className="relative group">
        {/* Scroll arrows */}
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

        {/* Carousel */}
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
            <div className="w-12 h-12 rounded-md bg-muted/30 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
            </div>
            <span className="font-body text-[10px] text-foreground whitespace-nowrap">All</span>
          </button>

          {brands.map((brand) => {
            const isUploading = uploadingBrand === brand.name;
            return (
              <div key={brand.name} className="shrink-0 relative group/brand">
                <button
                  onClick={() => onSelect(brand.name === selectedBrand ? "all" : brand.name)}
                  className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg border transition-all ${
                    selectedBrand === brand.name
                      ? "border-foreground bg-foreground/5"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <div className="w-12 h-12 rounded-md bg-muted/20 overflow-hidden relative">
                    {isUploading ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                      </div>
                    ) : brand.thumbnailUrl ? (
                      <img
                        src={brand.thumbnailUrl}
                        alt={brand.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-display text-sm text-muted-foreground/40">
                          {brand.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="font-body text-[10px] text-foreground whitespace-nowrap max-w-[72px] truncate">
                    {brand.name}
                  </span>
                </button>

                {/* Admin upload overlay */}
                {editable && !isUploading && (
                  <label className="absolute top-1.5 right-1 p-1 rounded-full bg-background/80 border border-border shadow-sm cursor-pointer hover:bg-muted z-10"
                    title={`Upload thumbnail for ${brand.name}`}
                  >
                    <Camera className="w-3 h-3 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleThumbnailUpload(brand.name, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BrandCarousel;
