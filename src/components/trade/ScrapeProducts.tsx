import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronRight, Globe, Package, Plus, Trash2, Save, Play, Clock, RefreshCw, Search, MapPin } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BrandEntry {
  id: string;
  brand_name: string;
  category: string;
  urls_text: string;
}

interface SavedConfig {
  id: string;
  brand_name: string;
  category: string;
  urls: string[];
  is_active: boolean;
  schedule_cron: string | null;
  last_run_at: string | null;
  last_run_result: any;
}

const SCHEDULE_OPTIONS = [
  { label: "Manual only", value: "" },
  { label: "Daily", value: "0 3 * * *" },
  { label: "Weekly (Mon)", value: "0 3 * * 1" },
  { label: "Monthly (1st)", value: "0 3 1 * *" },
];

const ScrapeProducts = () => {
  const { toast } = useToast();
  const [brands, setBrands] = useState<BrandEntry[]>([
    { id: crypto.randomUUID(), brand_name: "", category: "Rugs", urls_text: "" },
  ]);
  const [scraping, setScaping] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [saveConfigs, setSaveConfigs] = useState(true);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [runningConfigId, setRunningConfigId] = useState<string | null>(null);
  const [mappingBrandId, setMappingBrandId] = useState<string | null>(null);
  const [mapUrl, setMapUrl] = useState<Record<string, string>>({});
  const [mapSearch, setMapSearch] = useState<Record<string, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string[]>>({});
  const [selectedPreviewUrls, setSelectedPreviewUrls] = useState<Record<string, Set<string>>>({});
  const [previewFilter, setPreviewFilter] = useState<Record<string, string>>({});

  // Discover All state
  const [discoverSiteUrl, setDiscoverSiteUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoveredBrands, setDiscoveredBrands] = useState<{ slug: string; label: string; urls: string[] }[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [slugFilter, setSlugFilter] = useState("");

  const fetchConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    const { data } = await supabase.from("scrape_configs").select("*").order("brand_name") as { data: SavedConfig[] | null };
    setSavedConfigs(data || []);
    setLoadingConfigs(false);
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const addBrand = () => {
    setBrands((prev) => [
      ...prev,
      { id: crypto.randomUUID(), brand_name: "", category: "Uncategorized", urls_text: "" },
    ]);
  };

  const removeBrand = (id: string) => {
    if (brands.length <= 1) return;
    setBrands((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBrand = (id: string, field: keyof BrandEntry, value: string) => {
    setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const handleScrape = async () => {
    const brandsPayload = brands
      .filter((b) => b.brand_name.trim() && b.urls_text.trim())
      .map((b) => ({
        brand_name: b.brand_name.trim(),
        category: b.category.trim() || "Uncategorized",
        urls: b.urls_text
          .split(/[\n,]+/)
          .map((u) => u.trim())
          .filter((u) => u.startsWith("http")),
      }))
      .filter((b) => b.urls.length > 0);

    if (!brandsPayload.length) {
      toast({ title: "Add at least one brand with valid URLs", variant: "destructive" });
      return;
    }

    const totalUrls = brandsPayload.reduce((s, b) => s + b.urls.length, 0);
    setScaping(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-products", {
        body: {
          brands: brandsPayload,
          save_configs: saveConfigs,
        },
      });
      if (error) throw error;
      setResults(data);
      fetchConfigs();
      toast({
        title: `Scrape complete — ${brandsPayload.length} brand(s)`,
        description: `${data.summary.total_inserted} inserted, ${data.summary.total_updated} updated`,
      });
    } catch (err: any) {
      toast({ title: "Scrape failed", description: err.message, variant: "destructive" });
      setResults({ error: err.message });
    } finally {
      setScaping(false);
    }
  };

  const runSavedConfig = async (configId: string) => {
    setRunningConfigId(configId);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-products", {
        body: { config_id: configId },
      });
      if (error) throw error;
      toast({
        title: "Re-scrape complete",
        description: `${data.inserted} inserted, ${data.updated} updated`,
      });
      fetchConfigs();
    } catch (err: any) {
      toast({ title: "Re-scrape failed", description: err.message, variant: "destructive" });
    } finally {
      setRunningConfigId(null);
    }
  };

  const toggleConfigActive = async (config: SavedConfig) => {
    await supabase.from("scrape_configs").update({ is_active: !config.is_active }).eq("id", config.id);
    fetchConfigs();
  };

  const updateSchedule = async (configId: string, cron: string) => {
    await supabase.from("scrape_configs").update({
      schedule_cron: cron || null,
      updated_at: new Date().toISOString(),
    }).eq("id", configId);
    fetchConfigs();
    toast({ title: "Schedule updated" });
  };

  const deleteConfig = async (configId: string) => {
    await supabase.from("scrape_configs").delete().eq("id", configId);
    fetchConfigs();
    toast({ title: "Config deleted" });
  };

  const totalUrls = brands.reduce(
    (s, b) => s + b.urls_text.split(/[\n,]+/).filter((u) => u.trim().startsWith("http")).length,
    0
  );

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 group cursor-pointer">
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <h2 className="font-display text-lg text-foreground">Scrape Products</h2>
      </CollapsibleTrigger>
      <p className="font-body text-xs text-muted-foreground ml-6">
        Scrape product pages via Firecrawl. Supports multiple brands and saved configurations.
      </p>
      <CollapsibleContent className="mt-3 ml-6 space-y-6">
        {/* Saved Configs */}
        {savedConfigs.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-display text-sm text-foreground flex items-center gap-2">
              <Save className="h-3.5 w-3.5" /> Saved Configurations
            </h3>
            <div className="space-y-2">
              {savedConfigs.map((config) => (
                <div
                  key={config.id}
                  className="border border-border rounded-md p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm text-foreground">{config.brand_name}</span>
                      <span className="font-body text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                        {config.category}
                      </span>
                      <span className="font-body text-[10px] text-muted-foreground">
                        {config.urls.length} URLs
                      </span>
                      {!config.is_active && (
                        <span className="font-body text-[10px] text-destructive/70 px-1.5 py-0.5 rounded bg-destructive/10">
                          paused
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 font-body text-[10px] text-muted-foreground/60">
                      {config.last_run_at && (
                        <span>Last run: {new Date(config.last_run_at).toLocaleDateString()}</span>
                      )}
                      {config.last_run_result && !config.last_run_result.error && (
                        <span>
                          {config.last_run_result.inserted}i / {config.last_run_result.updated}u / {config.last_run_result.skipped}s
                        </span>
                      )}
                    </div>
                  </div>

                  <select
                    value={config.schedule_cron || ""}
                    onChange={(e) => updateSchedule(config.id, e.target.value)}
                    className="px-2 py-1 rounded border border-border bg-background font-body text-[10px] text-foreground"
                  >
                    {SCHEDULE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => toggleConfigActive(config)}
                    className={`px-2 py-1 rounded border text-[10px] font-body transition-colors ${
                      config.is_active
                        ? "border-success/30 text-success hover:bg-success/10"
                        : "border-muted text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {config.is_active ? "Active" : "Paused"}
                  </button>

                  <button
                    onClick={() => runSavedConfig(config.id)}
                    disabled={runningConfigId === config.id}
                    className="p-1.5 rounded border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                    title="Run now"
                  >
                    {runningConfigId === config.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => deleteConfig(config.id)}
                    className="p-1.5 rounded border border-destructive/20 text-destructive/60 hover:bg-destructive/10 transition-colors"
                    title="Delete config"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Discover All — site-wide URL discovery */}
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
              onClick={async () => {
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
              }}
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
                    const visible = discoveredBrands
                      .filter((b) => !slugFilter || b.label.toLowerCase().includes(slugFilter.toLowerCase()) || b.slug.toLowerCase().includes(slugFilter.toLowerCase()));
                    const allSelected = visible.every((b) => selectedSlugs.has(b.slug));
                    const next = new Set(selectedSlugs);
                    visible.forEach((b) => allSelected ? next.delete(b.slug) : next.add(b.slug));
                    setSelectedSlugs(next);
                  }}
                  className="px-3 py-1.5 rounded-md border border-border font-body text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors whitespace-nowrap"
                >
                  {slugFilter
                    ? `Toggle filtered (${discoveredBrands.filter((b) => b.label.toLowerCase().includes(slugFilter.toLowerCase()) || b.slug.toLowerCase().includes(slugFilter.toLowerCase())).length})`
                    : `Toggle all (${discoveredBrands.length})`}
                </button>
                <span className="font-body text-[10px] text-muted-foreground">
                  {selectedSlugs.size} selected
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-0.5 border border-border rounded-md p-2 bg-background">
                {discoveredBrands
                  .filter((b) => !slugFilter || b.label.toLowerCase().includes(slugFilter.toLowerCase()) || b.slug.toLowerCase().includes(slugFilter.toLowerCase()))
                  .map((b) => (
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
                onClick={() => {
                  const selected = discoveredBrands.filter((b) => selectedSlugs.has(b.slug));
                  if (!selected.length) {
                    toast({ title: "Select at least one brand", variant: "destructive" });
                    return;
                  }
                  setBrands(
                    selected.map((b) => ({
                      id: crypto.randomUUID(),
                      brand_name: b.label,
                      category: "Uncategorized",
                      urls_text: b.urls.join("\n"),
                    }))
                  );
                  toast({ title: `${selected.length} brand(s) loaded into scrape form` });
                  setDiscoveredBrands([]);
                  setSelectedSlugs(new Set());
                }}
                disabled={selectedSlugs.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-foreground text-background font-body text-xs uppercase tracking-[0.08em] hover:bg-foreground/90 disabled:opacity-40 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Load {selectedSlugs.size} brand(s) into scrape form
              </button>
            </div>
          )}
        </div>

        {/* New scrape form */}
        <div className="space-y-4">
          <h3 className="font-display text-sm text-foreground">New Scrape</h3>

          {brands.map((brand, idx) => (
            <div key={brand.id} className="border border-border rounded-md p-4 space-y-3 relative">
              {brands.length > 1 && (
                <button
                  onClick={() => removeBrand(brand.id)}
                  className="absolute top-3 right-3 p-1 text-destructive/50 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}

              <div className="flex items-center gap-2 mb-2">
                <span className="font-body text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                  Brand {idx + 1}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1">Brand Name *</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <input
                      value={brand.brand_name}
                      onChange={(e) => updateBrand(brand.id, "brand_name", e.target.value)}
                      placeholder="e.g. Atelier Février"
                      className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1">Category</label>
                  <input
                    value={brand.category}
                    onChange={(e) => updateBrand(brand.id, "category", e.target.value)}
                    placeholder="e.g. Rugs, Lighting"
                    className="w-full px-3 py-2 rounded-md border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* URL Discovery */}
              <div className="space-y-2">
                <label className="font-body text-xs text-muted-foreground block">
                  Discover Product URLs
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <input
                      value={mapUrl[brand.id] || ""}
                      onChange={(e) => setMapUrl((prev) => ({ ...prev, [brand.id]: e.target.value }))}
                      placeholder="Brand page URL, e.g. https://example.com/designer/brand-name/"
                      className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="relative w-40">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <input
                      value={mapSearch[brand.id] || ""}
                      onChange={(e) => setMapSearch((prev) => ({ ...prev, [brand.id]: e.target.value }))}
                      placeholder="Filter (optional)"
                      className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      const siteUrl = mapUrl[brand.id]?.trim();
                      if (!siteUrl) {
                        toast({ title: "Enter a brand page URL first", variant: "destructive" });
                        return;
                      }
                      setMappingBrandId(brand.id);
                      try {
                        const { data, error } = await supabase.functions.invoke("firecrawl-map", {
                          body: {
                            url: siteUrl,
                            search: mapSearch[brand.id]?.trim() || undefined,
                            limit: 300,
                          },
                        });
                        if (error) throw error;
                        const urls: string[] = (data.urls || data.links || []).filter((u: string) => u.startsWith("http"));
                        if (urls.length) {
                          const existing = new Set(brand.urls_text.split(/[\n,]+/).map((u: string) => u.trim()).filter(Boolean));
                          const newUrls = urls.filter((u: string) => !existing.has(u));
                          setPreviewUrls((prev) => ({ ...prev, [brand.id]: newUrls }));
                          setSelectedPreviewUrls((prev) => ({ ...prev, [brand.id]: new Set(newUrls) }));
                          setPreviewFilter((prev) => ({ ...prev, [brand.id]: "" }));
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
                        setMappingBrandId(null);
                      }
                    }}
                    disabled={mappingBrandId === brand.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-primary/20 text-primary font-body text-xs hover:bg-primary/5 transition-colors disabled:opacity-40 whitespace-nowrap"
                  >
                    {mappingBrandId === brand.id ? (
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
                {previewUrls[brand.id]?.length > 0 && (
                  <div className="space-y-2 border border-primary/15 rounded-md p-3 bg-primary/[0.02]">
                    <div className="flex items-center justify-between">
                      <span className="font-body text-xs text-foreground font-medium">
                        {previewUrls[brand.id].length} new URLs discovered
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const urls = previewUrls[brand.id];
                            const filter = previewFilter[brand.id] || "";
                            const visible = filter ? urls.filter((u) => u.toLowerCase().includes(filter.toLowerCase())) : urls;
                            const sel = selectedPreviewUrls[brand.id] || new Set<string>();
                            const allSelected = visible.every((u) => sel.has(u));
                            const next = new Set<string>(sel);
                            visible.forEach((u) => allSelected ? next.delete(u) : next.add(u));
                            setSelectedPreviewUrls((prev) => ({ ...prev, [brand.id]: next }));
                          }}
                          className="font-body text-[10px] text-primary hover:underline"
                        >
                          {(() => {
                            const urls = previewUrls[brand.id];
                            const filter = previewFilter[brand.id] || "";
                            const visible = filter ? urls.filter((u) => u.toLowerCase().includes(filter.toLowerCase())) : urls;
                            const sel = selectedPreviewUrls[brand.id] || new Set<string>();
                            const allSelected = visible.length > 0 && visible.every((u) => sel.has(u));
                            return allSelected ? "Deselect all on page" : "Select all on page";
                          })()}
                        </button>
                        <span className="font-body text-[10px] text-muted-foreground">
                          {selectedPreviewUrls[brand.id]?.size || 0} selected
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                      <input
                        value={previewFilter[brand.id] || ""}
                        onChange={(e) => setPreviewFilter((prev) => ({ ...prev, [brand.id]: e.target.value }))}
                        placeholder="Filter URLs…"
                        className="w-full pl-8 pr-3 py-1.5 rounded border border-border bg-background font-body text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-0.5 border border-border rounded bg-background p-1.5">
                      {previewUrls[brand.id]
                        .filter((u) => {
                          const f = previewFilter[brand.id] || "";
                          return !f || u.toLowerCase().includes(f.toLowerCase());
                        })
                         .map((url) => {
                          const slug = url.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
                          const lastSegment = slug.split("/").filter(Boolean).pop() || slug;
                          const productName = lastSegment
                            .replace(/[-_]/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase())
                            .trim();
                          return (
                            <label
                              key={url}
                              className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPreviewUrls[brand.id]?.has(url) || false}
                                onChange={() => {
                                  const next = new Set<string>(selectedPreviewUrls[brand.id] || new Set<string>());
                                  next.has(url) ? next.delete(url) : next.add(url);
                                  setSelectedPreviewUrls((prev) => ({ ...prev, [brand.id]: next }));
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

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const selected = Array.from(selectedPreviewUrls[brand.id] || new Set<string>()) as string[];
                          if (!selected.length) {
                            toast({ title: "Select at least one URL", variant: "destructive" });
                            return;
                          }
                          const existing = brand.urls_text.split(/[\n,]+/).map((u: string) => u.trim()).filter(Boolean);
                          const combined = [...existing, ...selected].filter((u) => u.startsWith("http"));
                          updateBrand(brand.id, "urls_text", combined.join("\n"));
                          setPreviewUrls((prev) => { const n = { ...prev }; delete n[brand.id]; return n; });
                          setSelectedPreviewUrls((prev) => { const n = { ...prev }; delete n[brand.id]; return n; });
                          toast({ title: `${selected.length} URL(s) added` });
                        }}
                        disabled={(selectedPreviewUrls[brand.id]?.size || 0) === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background font-body text-[10px] uppercase tracking-[0.08em] hover:bg-foreground/90 disabled:opacity-40 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        Add {selectedPreviewUrls[brand.id]?.size || 0} URL(s)
                      </button>
                      <button
                        onClick={() => {
                          setPreviewUrls((prev) => { const n = { ...prev }; delete n[brand.id]; return n; });
                          setSelectedPreviewUrls((prev) => { const n = { ...prev }; delete n[brand.id]; return n; });
                        }}
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
                  onChange={(e) => updateBrand(brand.id, "urls_text", e.target.value)}
                  rows={5}
                  placeholder={"https://example.com/product/item-1/\nhttps://example.com/product/item-2/"}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 font-mono leading-relaxed resize-y"
                />
                <p className="font-body text-[10px] text-muted-foreground/50 mt-0.5">
                  {brand.urls_text.split(/[\n,]+/).filter((u) => u.trim().startsWith("http")).length} URL(s)
                </p>
              </div>
            </div>
          ))}

          <button
            onClick={addBrand}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-border text-muted-foreground font-body text-xs hover:border-foreground/30 hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add another brand
          </button>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 font-body text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={saveConfigs}
              onChange={(e) => setSaveConfigs(e.target.checked)}
              className="rounded border-border"
            />
            Save configuration for re-scraping
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleScrape}
            disabled={scraping || !brands.some((b) => b.brand_name.trim() && b.urls_text.trim())}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {scraping ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Scraping {brands.filter((b) => b.brand_name.trim()).length} brand(s)…
              </>
            ) : (
              <>
                <Globe className="h-3.5 w-3.5" />
                Scrape &amp; Import ({totalUrls} URLs)
              </>
            )}
          </button>
          {scraping && (
            <span className="font-body text-xs text-muted-foreground animate-pulse">
              This may take several minutes for large batches…
            </span>
          )}
        </div>

        {/* Results */}
        {results && (
          <div className="rounded-md border border-border p-4 bg-muted/30 space-y-3">
            <h4 className="font-display text-sm text-foreground">
              {results.error ? "Error" : "Results"}
            </h4>
            {results.error ? (
              <p className="font-body text-xs text-destructive">{results.error}</p>
            ) : results.results ? (
              <>
                <div className="grid grid-cols-4 gap-3 font-body text-xs text-center">
                  <div>
                    <div className="text-lg font-display text-foreground">{results.summary.brands}</div>
                    <div className="text-muted-foreground">Brands</div>
                  </div>
                  <div>
                    <div className="text-lg font-display text-success">{results.summary.total_inserted}</div>
                    <div className="text-muted-foreground">Inserted</div>
                  </div>
                  <div>
                    <div className="text-lg font-display text-warning">{results.summary.total_updated}</div>
                    <div className="text-muted-foreground">Updated</div>
                  </div>
                  <div>
                    <div className="text-lg font-display text-muted-foreground">{results.summary.total_skipped}</div>
                    <div className="text-muted-foreground">Skipped</div>
                  </div>
                </div>
                {results.results.map((r: any, i: number) => (
                  <div key={i} className="border-t border-border pt-2 font-body text-xs">
                    <span className="font-medium text-foreground">{r.brand_name}</span>
                    <span className="text-muted-foreground ml-2">
                      {r.total_scraped} scraped · {r.inserted}i / {r.updated}u / {r.skipped}s
                    </span>
                    {r.errors?.length > 0 && (
                      <span className="text-destructive/70 ml-2">({r.errors.length} errors)</span>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div className="grid grid-cols-4 gap-3 font-body text-xs text-center">
                <div>
                  <div className="text-lg font-display text-foreground">{results.total_scraped}</div>
                  <div className="text-muted-foreground">Scraped</div>
                </div>
                <div>
                  <div className="text-lg font-display text-success">{results.inserted}</div>
                  <div className="text-muted-foreground">Inserted</div>
                </div>
                <div>
                  <div className="text-lg font-display text-warning">{results.updated}</div>
                  <div className="text-muted-foreground">Updated</div>
                </div>
                <div>
                  <div className="text-lg font-display text-muted-foreground">{results.skipped}</div>
                  <div className="text-muted-foreground">Skipped</div>
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ScrapeProducts;
