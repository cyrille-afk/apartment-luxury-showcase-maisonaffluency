import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Plus, Trash2, Search, MapPin } from "lucide-react";
import { BrandEntry, COUNTRY_OPTIONS } from "./scrape-types";

interface ScrapeBrandFormProps {
  brand: BrandEntry;
  index: number;
  canRemove: boolean;
  onUpdate: (id: string, field: keyof BrandEntry, value: string) => void;
  onRemove: (id: string) => void;
}

const ScrapeBrandForm = ({ brand, index, canRemove, onUpdate, onRemove }: ScrapeBrandFormProps) => {
  const { toast } = useToast();
  const [mappingBrand, setMappingBrand] = useState(false);
  const [mapUrl, setMapUrl] = useState("");
  const [mapSearch, setMapSearch] = useState("");
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedPreviewUrls, setSelectedPreviewUrls] = useState<Set<string>>(new Set());
  const [previewFilter, setPreviewFilter] = useState("");
  const [previewPage, setPreviewPage] = useState(0);

  const handleDiscover = async () => {
    const siteUrl = mapUrl.trim();
    if (!siteUrl) {
      toast({ title: "Enter a brand page URL first", variant: "destructive" });
      return;
    }
    setMappingBrand(true);
    try {
      const { data, error } = await supabase.functions.invoke("firecrawl-map", {
        body: { url: siteUrl, search: mapSearch.trim() || undefined, limit: 300 },
      });
      if (error) throw error;
      const urls: string[] = (data.urls || data.links || []).filter((u: string) => u.startsWith("http"));
      if (urls.length) {
        const existing = new Set(brand.urls_text.split(/[\n,]+/).map((u: string) => u.trim()).filter(Boolean));
        const newUrls = urls.filter((u: string) => !existing.has(u));
        setPreviewUrls(newUrls);
        setSelectedPreviewUrls(new Set(newUrls));
        setPreviewFilter("");
        setPreviewPage(0);
        toast({
          title: `Found ${newUrls.length} new URLs`,
          description: `${urls.length} total discovered, ${urls.length - newUrls.length} already added`,
        });
      } else {
        toast({
          title: "No product URLs found",
          description: `Scanned ${data.total_links || 0} links. Try a different URL or search term.`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Map failed", description: err.message, variant: "destructive" });
    } finally {
      setMappingBrand(false);
    }
  };

  const PAGE_SIZE = 50;
  const filteredPreview = previewUrls.filter((u) => {
    return !previewFilter || u.toLowerCase().includes(previewFilter.toLowerCase());
  });
  const totalPages = Math.ceil(filteredPreview.length / PAGE_SIZE);
  const page = Math.min(previewPage, Math.max(0, totalPages - 1));
  const pagedPreview = filteredPreview.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="border border-border rounded-md p-4 space-y-3 relative">
      {canRemove && (
        <button
          onClick={() => onRemove(brand.id)}
          className="absolute top-3 right-3 p-1 text-destructive/50 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="flex items-center gap-2 mb-2">
        <span className="font-body text-[10px] text-muted-foreground/50 uppercase tracking-wider">
          Brand {index + 1}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="font-body text-xs text-muted-foreground block mb-1">Brand Name *</label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              value={brand.brand_name}
              onChange={(e) => onUpdate(brand.id, "brand_name", e.target.value)}
              placeholder="e.g. Atelier Février"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>
        <div>
          <label className="font-body text-xs text-muted-foreground block mb-1">Category</label>
          <input
            value={brand.category}
            onChange={(e) => onUpdate(brand.id, "category", e.target.value)}
            placeholder="e.g. Rugs, Lighting"
            className="w-full px-3 py-2 rounded-md border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="font-body text-xs text-muted-foreground block mb-1">Country</label>
          <select
            value={brand.location}
            onChange={(e) => onUpdate(brand.id, "location", e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* URL Discovery */}
      <div className="space-y-2">
        <label className="font-body text-xs text-muted-foreground block">Discover Product URLs</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              placeholder="Brand page URL, e.g. https://example.com/designer/brand-name/"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="relative w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              value={mapSearch}
              onChange={(e) => setMapSearch(e.target.value)}
              placeholder="Filter (optional)"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={handleDiscover}
            disabled={mappingBrand}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-primary/20 text-primary font-body text-xs hover:bg-primary/5 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {mappingBrand ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )}
            Discover
          </button>
        </div>
        <p className="font-body text-[10px] text-muted-foreground/40">
          Scans the site to find all /product/ pages. Use the filter to narrow by brand or keyword.
        </p>

        {/* URL Preview with checkboxes */}
        {previewUrls.length > 0 && (
          <div className="space-y-2 border border-primary/15 rounded-md p-3 bg-primary/[0.02]">
            <div className="flex items-center justify-between">
              <span className="font-body text-xs text-foreground font-medium">
                {previewUrls.length} new URLs discovered
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const allSelected = previewUrls.length > 0 && previewUrls.every((u) => selectedPreviewUrls.has(u));
                    setSelectedPreviewUrls(allSelected ? new Set() : new Set(previewUrls));
                  }}
                  className="font-body text-[10px] text-primary font-medium hover:underline"
                >
                  {previewUrls.every((u) => selectedPreviewUrls.has(u)) ? "Deselect all" : "Select all"}
                </button>
                <span className="text-muted-foreground/30">|</span>
                <button
                  onClick={() => {
                    const allOnPage = pagedPreview.length > 0 && pagedPreview.every((u) => selectedPreviewUrls.has(u));
                    const next = new Set(selectedPreviewUrls);
                    pagedPreview.forEach((u) => allOnPage ? next.delete(u) : next.add(u));
                    setSelectedPreviewUrls(next);
                  }}
                  className="font-body text-[10px] text-primary/70 hover:underline"
                >
                  {pagedPreview.every((u) => selectedPreviewUrls.has(u)) ? "Deselect page" : "Select page"}
                </button>
                <span className="font-body text-[10px] text-muted-foreground">
                  {selectedPreviewUrls.size} / {previewUrls.length} selected
                </span>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
              <input
                value={previewFilter}
                onChange={(e) => { setPreviewFilter(e.target.value); setPreviewPage(0); }}
                placeholder="Filter URLs…"
                className="w-full pl-8 pr-3 py-1.5 rounded border border-border bg-background font-body text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-0.5 border border-border rounded bg-background p-1.5">
              {pagedPreview.map((url) => {
                const slug = url.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
                const lastSegment = slug.split("/").filter(Boolean).pop() || slug;
                const productName = lastSegment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
                return (
                  <label
                    key={url}
                    className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPreviewUrls.has(url)}
                      onChange={() => {
                        const next = new Set(selectedPreviewUrls);
                        next.has(url) ? next.delete(url) : next.add(url);
                        setSelectedPreviewUrls(next);
                      }}
                      className="rounded border-border shrink-0"
                    />
                    <span className="flex flex-col min-w-0">
                      <span className="font-body text-[11px] text-foreground truncate">{productName}</span>
                      <span className="font-mono text-[9px] text-muted-foreground truncate" title={url}>{slug}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <span className="font-body text-[10px] text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredPreview.length)} of {filteredPreview.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewPage(page - 1)}
                    disabled={page === 0}
                    className="px-2 py-0.5 rounded border border-border font-body text-[10px] text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                  >← Prev</button>
                  <span className="font-body text-[10px] text-muted-foreground px-1">{page + 1} / {totalPages}</span>
                  <button
                    onClick={() => setPreviewPage(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-2 py-0.5 rounded border border-border font-body text-[10px] text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                  >Next →</button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const selected = Array.from(selectedPreviewUrls);
                  if (!selected.length) {
                    toast({ title: "Select at least one URL", variant: "destructive" });
                    return;
                  }
                  const existing = brand.urls_text.split(/[\n,]+/).map((u: string) => u.trim()).filter(Boolean);
                  const combined = [...existing, ...selected].filter((u) => u.startsWith("http"));
                  onUpdate(brand.id, "urls_text", combined.join("\n"));
                  setPreviewUrls([]);
                  setSelectedPreviewUrls(new Set());
                  toast({ title: `${selected.length} URL(s) added` });
                }}
                disabled={selectedPreviewUrls.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background font-body text-[10px] uppercase tracking-[0.08em] hover:bg-foreground/90 disabled:opacity-40 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add {selectedPreviewUrls.size} URL(s)
              </button>
              <button
                onClick={() => { setPreviewUrls([]); setSelectedPreviewUrls(new Set()); }}
                className="px-3 py-1.5 rounded-md border border-border font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="font-body text-xs text-muted-foreground block mb-1">
          Product URLs (one per line)
        </label>
        <textarea
          value={brand.urls_text}
          onChange={(e) => onUpdate(brand.id, "urls_text", e.target.value)}
          rows={5}
          placeholder={"https://example.com/product/item-1/\nhttps://example.com/product/item-2/"}
          className="w-full px-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 font-mono leading-relaxed resize-y"
        />
        <p className="font-body text-[10px] text-muted-foreground/50 mt-0.5">
          {brand.urls_text.split(/[\n,]+/).filter((u) => u.trim().startsWith("http")).length} URL(s)
        </p>
      </div>
    </div>
  );
};

export default ScrapeBrandForm;
