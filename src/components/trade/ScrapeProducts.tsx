import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronRight, Globe, Package, Plus, Trash2, Save, Play, Clock, RefreshCw, Search, MapPin, XCircle, History, CalendarIcon, Download, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

interface BrandEntry {
  id: string;
  brand_name: string;
  category: string;
  urls_text: string;
  location: string;
}

const COUNTRY_OPTIONS = [
  { label: "Auto (default)", value: "" },
  { label: "🇫🇷 France", value: "FR" },
  { label: "🇮🇹 Italy", value: "IT" },
  { label: "🇺🇸 United States", value: "US" },
  { label: "🇬🇧 United Kingdom", value: "GB" },
  { label: "🇩🇪 Germany", value: "DE" },
  { label: "🇪🇸 Spain", value: "ES" },
  { label: "🇵🇹 Portugal", value: "PT" },
  { label: "🇳🇱 Netherlands", value: "NL" },
  { label: "🇧🇪 Belgium", value: "BE" },
  { label: "🇸🇪 Sweden", value: "SE" },
  { label: "🇩🇰 Denmark", value: "DK" },
  { label: "🇯🇵 Japan", value: "JP" },
  { label: "🇸🇬 Singapore", value: "SG" },
  { label: "🇦🇺 Australia", value: "AU" },
  { label: "🇧🇷 Brazil", value: "BR" },
  { label: "🇮🇳 India", value: "IN" },
];

interface SavedConfig {
  id: string;
  brand_name: string;
  category: string;
  urls: string[];
  is_active: boolean;
  schedule_cron: string | null;
  last_run_at: string | null;
  last_run_result: any;
  chunk_size: number;
  chunk_delay: number;
  location: string;
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
    { id: crypto.randomUUID(), brand_name: "", category: "Rugs", urls_text: "", location: "" },
  ]);
  const [scraping, setScaping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<{ done: number; total: number; inserted: number; updated: number; errors: number } | null>(null);
  const scrapeCancelledRef = useRef(false);
  const scrapeStartTimeRef = useRef<number>(0);
  const [remainingChunks, setRemainingChunks] = useState<{ brand_name: string; category: string; urls: string[] }[] | null>(null);
  const [results, setResults] = useState<any>(null);
  const [saveConfigs, setSaveConfigs] = useState(true);
  const [chunkDelay, setChunkDelay] = useState(0);
  const [chunkSize, setChunkSize] = useState(10);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [runningConfigId, setRunningConfigId] = useState<string | null>(null);
  const [editingUrlsConfigId, setEditingUrlsConfigId] = useState<string | null>(null);
  const [editingUrlsText, setEditingUrlsText] = useState("");
  const [mappingBrandId, setMappingBrandId] = useState<string | null>(null);
  const [mapUrl, setMapUrl] = useState<Record<string, string>>({});
  const [mapSearch, setMapSearch] = useState<Record<string, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string[]>>({});
  const [selectedPreviewUrls, setSelectedPreviewUrls] = useState<Record<string, Set<string>>>({});
  const [previewFilter, setPreviewFilter] = useState<Record<string, string>>({});
  const [previewPage, setPreviewPage] = useState<Record<string, number>>({});

  // Discover All state
  const [discoverSiteUrl, setDiscoverSiteUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoveredBrands, setDiscoveredBrands] = useState<{ slug: string; label: string; urls: string[] }[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [slugFilter, setSlugFilter] = useState("");

  // Scrape history
  const [scrapeHistory, setScrapeHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFrom, setHistoryFrom] = useState<Date | undefined>(undefined);
  const [historyTo, setHistoryTo] = useState<Date | undefined>(undefined);
  const [historyBrand, setHistoryBrand] = useState("");

  const historyBrands = useMemo(() => {
    const set = new Set<string>();
    for (const run of scrapeHistory) if (run.brand_name) set.add(run.brand_name);
    return Array.from(set).sort();
  }, [scrapeHistory]);

  const filteredHistory = useMemo(() => {
    if (!historyBrand) return scrapeHistory;
    return scrapeHistory.filter((r) => r.brand_name === historyBrand);
  }, [scrapeHistory, historyBrand]);

  const chartData = useMemo(() => {
    if (!filteredHistory.length) return [];
    const byDay: Record<string, { date: string; inserted: number; updated: number; errors: number }> = {};
    for (const run of filteredHistory) {
      const day = new Date(run.started_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { date: day, inserted: 0, updated: 0, errors: 0 };
      byDay[day].inserted += run.inserted || 0;
      byDay[day].updated += run.updated || 0;
      byDay[day].errors += run.errors || 0;
    }
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredHistory]);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    let query = supabase.from("scrape_runs").select("*").order("started_at", { ascending: false }).limit(100);
    if (historyFrom) {
      query = query.gte("started_at", historyFrom.toISOString());
    }
    if (historyTo) {
      const endOfDay = new Date(historyTo);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("started_at", endOfDay.toISOString());
    }
    const { data } = await query;
    setScrapeHistory(data || []);
    setLoadingHistory(false);
  }, [historyFrom, historyTo]);

  const fetchConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    const { data } = await supabase.from("scrape_configs").select("*").order("brand_name") as { data: SavedConfig[] | null };
    setSavedConfigs(data || []);
    setLoadingConfigs(false);
  }, []);

  useEffect(() => { fetchConfigs(); fetchHistory(); }, [fetchConfigs, fetchHistory]);

  const addBrand = () => {
    setBrands((prev) => [
      ...prev,
      { id: crypto.randomUUID(), brand_name: "", category: "Uncategorized", urls_text: "", location: "" },
    ]);
  };

  const removeBrand = (id: string) => {
    if (brands.length <= 1) return;
    setBrands((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBrand = (id: string, field: keyof BrandEntry, value: string) => {
    setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const runChunks = async (chunks: { brand_name: string; category: string; urls: string[] }[]) => {
    const totalUrls = chunks.reduce((s, c) => s + c.urls.length, 0);
    const brandNames = [...new Set(chunks.map((c) => c.brand_name))].join(", ");
    const categories = [...new Set(chunks.map((c) => c.category))].join(", ");
    const startedAt = new Date().toISOString();
    setScaping(true);
    setResults(null);
    setRemainingChunks(null);
    scrapeCancelledRef.current = false;
    scrapeStartTimeRef.current = Date.now();
    setScrapeProgress({ done: 0, total: totalUrls, inserted: 0, updated: 0, errors: 0 });

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let urlsDone = 0;
    let finalStatus = "completed";
    let errorMsg: string | null = null;
    const allResults: any[] = [];

    try {
      for (let i = 0; i < chunks.length; i++) {
        if (scrapeCancelledRef.current) {
          const left = chunks.slice(i);
          setRemainingChunks(left);
          finalStatus = "cancelled";
          toast({ title: "Scrape cancelled", description: `Stopped after ${urlsDone} of ${totalUrls} URLs. ${left.reduce((s, c) => s + c.urls.length, 0)} remaining.` });
          break;
        }
        const chunk = chunks[i];
        const isLastChunk = i === chunks.length - 1;
        const { data, error } = await supabase.functions.invoke("scrape-products", {
          body: {
            brands: [chunk],
            save_configs: isLastChunk ? saveConfigs : false,
            chunk_size: chunkSize,
            chunk_delay: chunkDelay,
          },
        });
        if (error) throw error;

        // Configurable delay between chunks
        if (i < chunks.length - 1 && chunkDelay > 0) {
          await new Promise((r) => setTimeout(r, chunkDelay * 1000));
        }

        urlsDone += chunk.urls.length;
        totalInserted += data?.summary?.total_inserted || data?.inserted || 0;
        totalUpdated += data?.summary?.total_updated || data?.updated || 0;
        totalErrors += data?.summary?.total_errors || 0;
        allResults.push(data);

        setScrapeProgress({ done: urlsDone, total: totalUrls, inserted: totalInserted, updated: totalUpdated, errors: totalErrors });
      }

      if (!scrapeCancelledRef.current) {
        setResults(allResults.length === 1 ? allResults[0] : { summary: { total_inserted: totalInserted, total_updated: totalUpdated, total_errors: totalErrors }, brands: allResults.flatMap((r) => r.brands || []) });
        fetchConfigs();
        toast({
          title: `Scrape complete`,
          description: `${totalInserted} inserted, ${totalUpdated} updated`,
        });
      }
    } catch (err: any) {
      const left = chunks.slice(Math.max(0, Math.floor(urlsDone / 10)));
      if (left.length > 0) setRemainingChunks(left);
      finalStatus = "failed";
      errorMsg = err.message;
      toast({ title: "Scrape failed", description: err.message, variant: "destructive" });
      setResults({ error: err.message });
    } finally {
      const durationSeconds = Math.round((Date.now() - scrapeStartTimeRef.current) / 1000);
      // Log scrape run
      await supabase.from("scrape_runs").insert({
        brand_name: brandNames,
        category: categories,
        total_urls: totalUrls,
        total_scraped: urlsDone,
        inserted: totalInserted,
        updated: totalUpdated,
        errors: totalErrors,
        duration_seconds: durationSeconds,
        status: finalStatus,
        error_message: errorMsg,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
      fetchHistory();
      setScaping(false);
      setScrapeProgress(null);
    }
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
        location: b.location || undefined,
      }))
      .filter((b) => b.urls.length > 0);

    if (!brandsPayload.length) {
      toast({ title: "Add at least one brand with valid URLs", variant: "destructive" });
      return;
    }

    const chunks: { brand_name: string; category: string; urls: string[]; location?: string }[] = [];
    for (const b of brandsPayload) {
      for (let i = 0; i < b.urls.length; i += chunkSize) {
        chunks.push({ brand_name: b.brand_name, category: b.category, urls: b.urls.slice(i, i + chunkSize), location: b.location });
      }
    }

    await runChunks(chunks);
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

  const updateConfigField = async (configId: string, field: string, value: any) => {
    await supabase.from("scrape_configs").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", configId);
    setSavedConfigs(prev => prev.map(c => c.id === configId ? { ...c, [field]: value } : c));
    toast({ title: "Config updated" });
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
                      <button
                        onClick={() => {
                          if (editingUrlsConfigId === config.id) {
                            setEditingUrlsConfigId(null);
                          } else {
                            setEditingUrlsConfigId(config.id);
                            setEditingUrlsText(config.urls.join("\n"));
                          }
                        }}
                        className="font-body text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        title="Edit URLs"
                      >
                        {config.urls.length} URLs
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      <select
                        value={config.location || ""}
                        onChange={(e) => updateConfigField(config.id, "location", e.target.value)}
                        className="px-1.5 py-0.5 rounded border border-border bg-background font-body text-[10px] text-foreground"
                        title="Country"
                      >
                        {COUNTRY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.value ? `📍 ${o.value}` : "🌐 Auto"}</option>
                        ))}
                      </select>
                      <select
                        value={config.chunk_size || 10}
                        onChange={(e) => updateConfigField(config.id, "chunk_size", Number(e.target.value))}
                        className="px-1.5 py-0.5 rounded border border-border bg-background font-body text-[10px] text-foreground w-14"
                        title="Chunk size"
                      >
                        {[3, 5, 10, 15, 20].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <select
                        value={config.chunk_delay || 0}
                        onChange={(e) => updateConfigField(config.id, "chunk_delay", Number(e.target.value))}
                        className="px-1.5 py-0.5 rounded border border-border bg-background font-body text-[10px] text-foreground w-14"
                        title="Delay (s)"
                      >
                        {[0, 2, 5, 10, 15, 30].map(n => (
                          <option key={n} value={n}>{n}s</option>
                        ))}
                      </select>
                      {!config.is_active && (
                        <span className="font-body text-[10px] text-destructive/70 px-1.5 py-0.5 rounded bg-destructive/10">
                          paused
                        </span>
                      )}
                    </div>
                    {editingUrlsConfigId === config.id && (
                      <div className="mt-2 space-y-1.5">
                        <textarea
                          value={editingUrlsText}
                          onChange={(e) => setEditingUrlsText(e.target.value)}
                          rows={6}
                          className="w-full px-2 py-1.5 rounded border border-border bg-background font-body text-[10px] text-foreground resize-y"
                          placeholder="One URL per line"
                        />
                        <div className="flex items-center gap-2">
                          <span className="font-body text-[10px] text-muted-foreground">
                            {editingUrlsText.split(/[\n,]+/).filter(u => u.trim().startsWith("http")).length} valid URLs
                          </span>
                          <button
                            onClick={async () => {
                              const newUrls = editingUrlsText.split(/[\n,]+/).map(u => u.trim()).filter(u => u.startsWith("http"));
                              if (!newUrls.length) { toast({ title: "No valid URLs", variant: "destructive" }); return; }
                              await updateConfigField(config.id, "urls", newUrls);
                              setEditingUrlsConfigId(null);
                            }}
                            className="p-1 rounded border border-success/30 text-success hover:bg-success/10 transition-colors"
                            title="Save URLs"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setEditingUrlsConfigId(null)}
                            className="p-1 rounded border border-border text-muted-foreground hover:bg-muted transition-colors"
                            title="Cancel"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
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
                      location: "",
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

              <div className="grid grid-cols-3 gap-3">
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
                <div>
                  <label className="font-body text-xs text-muted-foreground block mb-1">Country</label>
                  <select
                    value={brand.location}
                    onChange={(e) => updateBrand(brand.id, "location", e.target.value)}
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
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            const all = previewUrls[brand.id];
                            const sel = selectedPreviewUrls[brand.id] || new Set<string>();
                            const allSelected = all.length > 0 && all.every((u) => sel.has(u));
                            setSelectedPreviewUrls((prev) => ({ ...prev, [brand.id]: allSelected ? new Set<string>() : new Set(all) }));
                          }}
                          className="font-body text-[10px] text-primary font-medium hover:underline"
                        >
                          {(() => {
                            const all = previewUrls[brand.id];
                            const sel = selectedPreviewUrls[brand.id] || new Set<string>();
                            return all.length > 0 && all.every((u) => sel.has(u)) ? "Deselect all" : "Select all";
                          })()}
                        </button>
                        <span className="text-muted-foreground/30">|</span>
                        <button
                          onClick={() => {
                            const urls = previewUrls[brand.id];
                            const filter = previewFilter[brand.id] || "";
                            const PAGE_SIZE = 50;
                            const filtered = filter ? urls.filter((u) => u.toLowerCase().includes(filter.toLowerCase())) : urls;
                            const page = Math.min(previewPage[brand.id] || 0, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
                            const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
                            const sel = selectedPreviewUrls[brand.id] || new Set<string>();
                            const allOnPage = paged.length > 0 && paged.every((u) => sel.has(u));
                            const next = new Set<string>(sel);
                            paged.forEach((u) => allOnPage ? next.delete(u) : next.add(u));
                            setSelectedPreviewUrls((prev) => ({ ...prev, [brand.id]: next }));
                          }}
                          className="font-body text-[10px] text-primary/70 hover:underline"
                        >
                          {(() => {
                            const urls = previewUrls[brand.id];
                            const filter = previewFilter[brand.id] || "";
                            const PAGE_SIZE = 50;
                            const filtered = filter ? urls.filter((u) => u.toLowerCase().includes(filter.toLowerCase())) : urls;
                            const page = Math.min(previewPage[brand.id] || 0, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
                            const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
                            const sel = selectedPreviewUrls[brand.id] || new Set<string>();
                            return paged.length > 0 && paged.every((u) => sel.has(u)) ? "Deselect page" : "Select page";
                          })()}
                        </button>
                        <span className="font-body text-[10px] text-muted-foreground">
                          {selectedPreviewUrls[brand.id]?.size || 0} / {previewUrls[brand.id].length} selected
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                      <input
                        value={previewFilter[brand.id] || ""}
                        onChange={(e) => { setPreviewFilter((prev) => ({ ...prev, [brand.id]: e.target.value })); setPreviewPage((prev) => ({ ...prev, [brand.id]: 0 })); }}
                        placeholder="Filter URLs…"
                        className="w-full pl-8 pr-3 py-1.5 rounded border border-border bg-background font-body text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>

                    {(() => {
                      const PAGE_SIZE = 50;
                      const filtered = previewUrls[brand.id].filter((u) => {
                        const f = previewFilter[brand.id] || "";
                        return !f || u.toLowerCase().includes(f.toLowerCase());
                      });
                      const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                      const page = Math.min(previewPage[brand.id] || 0, Math.max(0, totalPages - 1));
                      const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

                      return (
                        <>
                          <div className="max-h-64 overflow-y-auto space-y-0.5 border border-border rounded bg-background p-1.5">
                            {paged.map((url) => {
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
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-1">
                              <span className="font-body text-[10px] text-muted-foreground">
                                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setPreviewPage((prev) => ({ ...prev, [brand.id]: page - 1 }))}
                                  disabled={page === 0}
                                  className="px-2 py-0.5 rounded border border-border font-body text-[10px] text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                                >
                                  ← Prev
                                </button>
                                <span className="font-body text-[10px] text-muted-foreground px-1">
                                  {page + 1} / {totalPages}
                                </span>
                                <button
                                  onClick={() => setPreviewPage((prev) => ({ ...prev, [brand.id]: page + 1 }))}
                                  disabled={page >= totalPages - 1}
                                  className="px-2 py-0.5 rounded border border-border font-body text-[10px] text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                                >
                                  Next →
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

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

        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 font-body text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={saveConfigs}
              onChange={(e) => setSaveConfigs(e.target.checked)}
              className="rounded border-border"
            />
            Save configuration for re-scraping
          </label>
          <label className="flex items-center gap-2 font-body text-xs text-muted-foreground">
            <span>Mode</span>
            <select
              value={
                chunkSize === 20 && chunkDelay === 0 ? "quick" :
                chunkSize === 10 && chunkDelay === 0 ? "normal" :
                chunkSize === 5 && chunkDelay === 5 ? "cautious" :
                chunkSize === 3 && chunkDelay === 15 ? "stealth" : "custom"
              }
              onChange={(e) => {
                const mode = e.target.value;
                if (mode === "quick") { setChunkSize(20); setChunkDelay(0); }
                else if (mode === "normal") { setChunkSize(10); setChunkDelay(0); }
                else if (mode === "cautious") { setChunkSize(5); setChunkDelay(5); }
                else if (mode === "stealth") { setChunkSize(3); setChunkDelay(15); }
              }}
              className="px-2 py-1 rounded border border-border bg-background font-body text-xs text-foreground"
            >
              <option value="quick">⚡ Quick (20 / no delay)</option>
              <option value="normal">● Normal (10 / no delay)</option>
              <option value="cautious">🛡 Cautious (5 / 5s delay)</option>
              <option value="stealth">🥷 Stealth (3 / 15s delay)</option>
              {chunkSize !== 20 && chunkSize !== 10 && chunkSize !== 5 && chunkSize !== 3 || 
               chunkDelay !== 0 && chunkDelay !== 5 && chunkDelay !== 15 ? (
                <option value="custom">Custom</option>
              ) : null}
            </select>
          </label>
          <label className="flex items-center gap-2 font-body text-xs text-muted-foreground">
            <span>Chunk size</span>
            <select
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              className="px-2 py-1 rounded border border-border bg-background font-body text-xs text-foreground"
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </label>
          <label className="flex items-center gap-2 font-body text-xs text-muted-foreground">
            <span>Delay</span>
            <select
              value={chunkDelay}
              onChange={(e) => setChunkDelay(Number(e.target.value))}
              className="px-2 py-1 rounded border border-border bg-background font-body text-xs text-foreground"
            >
              <option value={0}>None</option>
              <option value={2}>2s</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
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
          {scraping && scrapeProgress && (
            <>
              <div className="flex-1 space-y-1.5 max-w-md">
                <div className="flex items-center justify-between font-body text-[10px] text-muted-foreground">
                  <span>{scrapeProgress.done} / {scrapeProgress.total} URLs</span>
                  <span className="flex items-center gap-2">
                    {scrapeProgress.done > 0 && (() => {
                      const elapsed = (Date.now() - scrapeStartTimeRef.current) / 1000;
                      const rate = scrapeProgress.done / elapsed;
                      const remaining = (scrapeProgress.total - scrapeProgress.done) / rate;
                      if (remaining < 60) return <span>~{Math.ceil(remaining)}s left</span>;
                      return <span>~{Math.ceil(remaining / 60)}m left</span>;
                    })()}
                    <span>{Math.round((scrapeProgress.done / scrapeProgress.total) * 100)}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${(scrapeProgress.done / scrapeProgress.total) * 100}%` }}
                  />
                </div>
                <div className="flex gap-3 font-body text-[10px] text-muted-foreground">
                  <span className="text-green-600">{scrapeProgress.inserted} inserted</span>
                  <span className="text-blue-600">{scrapeProgress.updated} updated</span>
                  {scrapeProgress.errors > 0 && <span className="text-destructive">{scrapeProgress.errors} errors</span>}
                </div>
              </div>
              <button
                onClick={() => { scrapeCancelledRef.current = true; }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/30 text-destructive font-body text-[10px] uppercase tracking-[0.08em] hover:bg-destructive/10 transition-colors"
              >
                <XCircle className="h-3 w-3" />
                Cancel
              </button>
            </>
          )}
        </div>

        {/* Retry remaining */}
        {!scraping && remainingChunks && remainingChunks.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-md border border-primary/20 bg-primary/[0.03]">
            <span className="font-body text-xs text-foreground">
              {remainingChunks.reduce((s, c) => s + c.urls.length, 0)} URLs remaining
            </span>
            <button
              onClick={() => runChunks(remainingChunks)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background font-body text-[10px] uppercase tracking-[0.08em] hover:bg-foreground/90 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Resume scrape
            </button>
            <button
              onClick={() => setRemainingChunks(null)}
              className="font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

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

        {/* Scrape History */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display text-sm text-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Scrape History
            </h3>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1 text-[10px] font-body border border-border rounded px-2 py-1 hover:bg-muted/30 transition-colors">
                    <CalendarIcon className="h-3 w-3" />
                    {historyFrom ? format(historyFrom, "dd/MM/yy") : "From"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={historyFrom} onSelect={setHistoryFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-[10px] text-muted-foreground">–</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1 text-[10px] font-body border border-border rounded px-2 py-1 hover:bg-muted/30 transition-colors">
                    <CalendarIcon className="h-3 w-3" />
                    {historyTo ? format(historyTo, "dd/MM/yy") : "To"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={historyTo} onSelect={setHistoryTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {(historyFrom || historyTo) && (
                <button onClick={() => { setHistoryFrom(undefined); setHistoryTo(undefined); }} className="text-[10px] font-body text-muted-foreground hover:text-foreground transition-colors">
                  Clear dates
                </button>
              )}
              {historyBrands.length > 1 && (
                <select
                  value={historyBrand}
                  onChange={(e) => setHistoryBrand(e.target.value)}
                  className="text-[10px] font-body border border-border rounded px-1.5 py-1 bg-background text-foreground"
                >
                  <option value="">All brands</option>
                  {historyBrands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              )}
              <button
                onClick={fetchHistory}
                disabled={loadingHistory}
                className="font-body text-[10px] text-primary hover:underline flex items-center gap-1"
              >
                {loadingHistory ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Refresh
              </button>
              {filteredHistory.length > 0 && (
                <button
                  onClick={() => {
                    const headers = ["Brand", "Status", "Total URLs", "Scraped", "Inserted", "Updated", "Errors", "Duration (s)", "Started At", "Completed At"];
                    const rows = filteredHistory.map((r) => [
                      `"${(r.brand_name || "").replace(/"/g, '""')}"`,
                      r.status,
                      r.total_urls,
                      r.total_scraped,
                      r.inserted,
                      r.updated,
                      r.errors,
                      r.duration_seconds,
                      r.started_at,
                      r.completed_at,
                    ].join(","));
                    const csv = [headers.join(","), ...rows].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `scrape-history-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="font-body text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  CSV
                </button>
              )}
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => { const d = new Date(v + "T00:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="inserted" name="Inserted" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="updated" name="Updated" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="errors" name="Errors" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {filteredHistory.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground">No scrape runs yet.</p>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_80px_60px_60px_60px_70px_70px] gap-2 font-body text-[10px] text-muted-foreground uppercase tracking-wider px-2 pb-1 border-b border-border">
                <span>Brand</span>
                <span>Status</span>
                <span className="text-right">URLs</span>
                <span className="text-right">Inserted</span>
                <span className="text-right">Updated</span>
                <span className="text-right">Duration</span>
                <span className="text-right">When</span>
              </div>
              {filteredHistory.map((run) => {
                const dur = Number(run.duration_seconds);
                const durLabel = dur >= 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : `${dur}s`;
                const ago = (() => {
                  const diff = (Date.now() - new Date(run.started_at).getTime()) / 1000;
                  if (diff < 60) return "just now";
                  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                  return `${Math.floor(diff / 86400)}d ago`;
                })();
                return (
                  <div
                    key={run.id}
                    className="grid grid-cols-[1fr_80px_60px_60px_60px_70px_70px] gap-2 font-body text-[11px] text-foreground px-2 py-1.5 rounded hover:bg-muted/30 transition-colors"
                  >
                    <span className="truncate font-medium" title={run.brand_name}>{run.brand_name}</span>
                    <span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-medium ${
                        run.status === "completed" ? "bg-primary/10 text-primary" :
                        run.status === "cancelled" ? "bg-accent/50 text-accent-foreground" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        {run.status}
                      </span>
                    </span>
                    <span className="text-right">{run.total_scraped}/{run.total_urls}</span>
                    <span className="text-right text-green-600">{run.inserted}</span>
                    <span className="text-right text-blue-600">{run.updated}</span>
                    <span className="text-right text-muted-foreground">{durLabel}</span>
                    <span className="text-right text-muted-foreground" title={new Date(run.started_at).toLocaleString()}>{ago}</span>
                  </div>
                );
              })}
              {filteredHistory.length > 1 && (() => {
                const totals = filteredHistory.reduce((acc, r) => ({
                  urls: acc.urls + (r.total_urls || 0),
                  scraped: acc.scraped + (r.total_scraped || 0),
                  inserted: acc.inserted + (r.inserted || 0),
                  updated: acc.updated + (r.updated || 0),
                  duration: acc.duration + (Number(r.duration_seconds) || 0),
                }), { urls: 0, scraped: 0, inserted: 0, updated: 0, duration: 0 });
                const durLabel = totals.duration >= 60 ? `${Math.floor(totals.duration / 60)}m ${totals.duration % 60}s` : `${totals.duration}s`;
                return (
                  <div className="grid grid-cols-[1fr_80px_60px_60px_60px_70px_70px] gap-2 font-body text-[11px] font-semibold text-foreground px-2 py-1.5 border-t border-border mt-1">
                    <span>{filteredHistory.length} runs</span>
                    <span />
                    <span className="text-right">{totals.scraped}/{totals.urls}</span>
                    <span className="text-right text-green-600">{totals.inserted}</span>
                    <span className="text-right text-blue-600">{totals.updated}</span>
                    <span className="text-right text-muted-foreground">{durLabel}</span>
                    <span />
                  </div>
                );
              })()}
            </div>
          )}
        </div>

      </CollapsibleContent>
    </Collapsible>
  );
};

export default ScrapeProducts;
