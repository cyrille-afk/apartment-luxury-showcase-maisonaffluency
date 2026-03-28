import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Globe, Plus, Search, MapPin } from "lucide-react";
import { BrandEntry } from "./scrape-types";

interface ScrapeDiscoverAllProps {
  onLoadBrands: (brands: BrandEntry[]) => void;
}

const ScrapeDiscoverAll = ({ onLoadBrands }: ScrapeDiscoverAllProps) => {
  const { toast } = useToast();
  const [discoverSiteUrl, setDiscoverSiteUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoveredBrands, setDiscoveredBrands] = useState<{ slug: string; label: string; urls: string[] }[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [slugFilter, setSlugFilter] = useState("");

  const handleDiscover = async () => {
    if (!discoverSiteUrl.trim()) {
      toast({ title: "Enter a site URL", variant: "destructive" });
      return;
    }
    setDiscovering(true);
    setDiscoveredBrands([]);
    setSelectedSlugs(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("firecrawl-map", {
        body: { url: discoverSiteUrl.trim(), limit: 500, group_by_brand: true },
      });
      if (error) throw error;
      if (data.brands?.length) {
        setDiscoveredBrands(data.brands);
        toast({
          title: `Found ${data.product_links} products across ${data.brands.length} brands`,
          description: `${data.total_links} total links scanned`,
        });
      } else {
        toast({ title: "No product URLs found on this site", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Discovery failed", description: err.message, variant: "destructive" });
    } finally {
      setDiscovering(false);
    }
  };

  const handleLoad = () => {
    const selected = discoveredBrands.filter((b) => selectedSlugs.has(b.slug));
    if (!selected.length) {
      toast({ title: "Select at least one brand", variant: "destructive" });
      return;
    }
    onLoadBrands(
      selected.map((b) => ({
        id: crypto.randomUUID(),
        brand_name: b.label,
        category: "Uncategorized",
        urls_text: b.urls.join("\n"),
        location: "",
      }))
    );
    toast({ title: `${selected.length} brand(s) loaded into scrape form` });
    setDiscoveredBrands([]);
    setSelectedSlugs(new Set());
  };

  const visibleBrands = discoveredBrands.filter(
    (b) => !slugFilter || b.label.toLowerCase().includes(slugFilter.toLowerCase()) || b.slug.toLowerCase().includes(slugFilter.toLowerCase())
  );

  return (
    <div className="space-y-3 border border-dashed border-primary/20 rounded-md p-4 bg-primary/[0.02]">
      <h3 className="font-display text-sm text-foreground flex items-center gap-2">
        <Globe className="h-3.5 w-3.5 text-primary" /> Discover All Products from a Site
      </h3>
      <p className="font-body text-[10px] text-muted-foreground/60">
        Enter a site URL to map all product pages and group them by brand/designer. Then select which brands to import.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            value={discoverSiteUrl}
            onChange={(e) => setDiscoverSiteUrl(e.target.value)}
            placeholder="e.g. https://theinvisiblecollection.com"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <button
          onClick={handleDiscover}
          disabled={discovering}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground font-body text-xs uppercase tracking-[0.08em] hover:bg-primary/90 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {discovering ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Mapping site…
            </>
          ) : (
            <>
              <Globe className="h-3.5 w-3.5" />
              Discover All
            </>
          )}
        </button>
      </div>

      {discoveredBrands.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                value={slugFilter}
                onChange={(e) => setSlugFilter(e.target.value)}
                placeholder="Filter brands…"
                className="w-full pl-9 pr-3 py-1.5 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={() => {
                const allSelected = visibleBrands.every((b) => selectedSlugs.has(b.slug));
                const next = new Set(selectedSlugs);
                visibleBrands.forEach((b) => allSelected ? next.delete(b.slug) : next.add(b.slug));
                setSelectedSlugs(next);
              }}
              className="px-3 py-1.5 rounded-md border border-border font-body text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors whitespace-nowrap"
            >
              {slugFilter ? `Toggle filtered (${visibleBrands.length})` : `Toggle all (${discoveredBrands.length})`}
            </button>
            <span className="font-body text-[10px] text-muted-foreground">
              {selectedSlugs.size} selected
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-0.5 border border-border rounded-md p-2 bg-background">
            {visibleBrands.map((b) => (
              <label
                key={b.slug}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedSlugs.has(b.slug)}
                  onChange={() => {
                    const next = new Set(selectedSlugs);
                    next.has(b.slug) ? next.delete(b.slug) : next.add(b.slug);
                    setSelectedSlugs(next);
                  }}
                  className="rounded border-border"
                />
                <span className="font-body text-xs text-foreground flex-1">{b.label}</span>
                <span className="font-body text-[10px] text-muted-foreground/50">
                  {b.urls.length} product{b.urls.length !== 1 ? "s" : ""}
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={handleLoad}
            disabled={selectedSlugs.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-foreground text-background font-body text-xs uppercase tracking-[0.08em] hover:bg-foreground/90 disabled:opacity-40 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Load {selectedSlugs.size} brand(s) into scrape form
          </button>
        </div>
      )}
    </div>
  );
};

export default ScrapeDiscoverAll;
