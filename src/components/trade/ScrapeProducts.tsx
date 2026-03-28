import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronRight, Globe, Plus, Save, XCircle, RefreshCw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BrandEntry, SavedConfig } from "./scrape/scrape-types";
import ScrapeConfigCard from "./scrape/ScrapeConfigCard";
import ScrapeDiscoverAll from "./scrape/ScrapeDiscoverAll";
import ScrapeBrandForm from "./scrape/ScrapeBrandForm";
import ScrapeHistory from "./scrape/ScrapeHistory";

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
  const [runningConfigId, setRunningConfigId] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    const { data } = await supabase.from("scrape_configs").select("*").order("brand_name") as { data: SavedConfig[] | null };
    setSavedConfigs(data || []);
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const updateBrand = (id: string, field: keyof BrandEntry, value: string) => {
    setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeBrand = (id: string) => {
    if (brands.length <= 1) return;
    setBrands((prev) => prev.filter((b) => b.id !== id));
  };

  const updateConfigField = async (configId: string, field: string, value: any) => {
    await supabase.from("scrape_configs").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", configId);
    setSavedConfigs((prev) => prev.map((c) => (c.id === configId ? { ...c, [field]: value } : c)));
    toast({ title: "Config updated" });
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

    let totalInserted = 0, totalUpdated = 0, totalErrors = 0, urlsDone = 0;
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
          body: { brands: [chunk], save_configs: isLastChunk ? saveConfigs : false, chunk_size: chunkSize, chunk_delay: chunkDelay },
        });
        if (error) throw error;
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
        toast({ title: "Scrape complete", description: `${totalInserted} inserted, ${totalUpdated} updated` });
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
      await supabase.from("scrape_runs").insert({
        brand_name: brandNames, category: categories, total_urls: totalUrls, total_scraped: urlsDone,
        inserted: totalInserted, updated: totalUpdated, errors: totalErrors,
        duration_seconds: durationSeconds, status: finalStatus, error_message: errorMsg,
        started_at: startedAt, completed_at: new Date().toISOString(),
      });
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
        urls: b.urls_text.split(/[\n,]+/).map((u) => u.trim()).filter((u) => u.startsWith("http")),
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
                <ScrapeConfigCard
                  key={config.id}
                  config={config}
                  runningConfigId={runningConfigId}
                  onRunConfig={runSavedConfig}
                  onRefresh={fetchConfigs}
                  onUpdateConfig={updateConfigField}
                />
              ))}
            </div>
          </div>
        )}

        {/* Discover All */}
        <ScrapeDiscoverAll onLoadBrands={setBrands} />

        {/* New scrape form */}
        <div className="space-y-4">
          <h3 className="font-display text-sm text-foreground">New Scrape</h3>
          {brands.map((brand, idx) => (
            <ScrapeBrandForm
              key={brand.id}
              brand={brand}
              index={idx}
              canRemove={brands.length > 1}
              onUpdate={updateBrand}
              onRemove={removeBrand}
            />
          ))}
          <button
            onClick={() => setBrands((prev) => [...prev, { id: crypto.randomUUID(), brand_name: "", category: "Uncategorized", urls_text: "", location: "" }])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-border text-muted-foreground font-body text-xs hover:border-foreground/30 hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add another brand
          </button>
        </div>

        {/* Scrape settings */}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 font-body text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={saveConfigs} onChange={(e) => setSaveConfigs(e.target.checked)} className="rounded border-border" />
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
            <select value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))} className="px-2 py-1 rounded border border-border bg-background font-body text-xs text-foreground">
              {[3, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 font-body text-xs text-muted-foreground">
            <span>Delay</span>
            <select value={chunkDelay} onChange={(e) => setChunkDelay(Number(e.target.value))} className="px-2 py-1 rounded border border-border bg-background font-body text-xs text-foreground">
              {[0, 2, 5, 10, 15, 30, 60].map((n) => <option key={n} value={n}>{n === 0 ? "None" : `${n}s`}</option>)}
            </select>
          </label>
        </div>

        {/* Scrape button + progress */}
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
                  <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${(scrapeProgress.done / scrapeProgress.total) * 100}%` }} />
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
                  <div><div className="text-lg font-display text-foreground">{results.summary.brands}</div><div className="text-muted-foreground">Brands</div></div>
                  <div><div className="text-lg font-display text-success">{results.summary.total_inserted}</div><div className="text-muted-foreground">Inserted</div></div>
                  <div><div className="text-lg font-display text-warning">{results.summary.total_updated}</div><div className="text-muted-foreground">Updated</div></div>
                  <div><div className="text-lg font-display text-muted-foreground">{results.summary.total_skipped}</div><div className="text-muted-foreground">Skipped</div></div>
                </div>
                {results.results.map((r: any, i: number) => (
                  <div key={i} className="border-t border-border pt-2 font-body text-xs">
                    <span className="font-medium text-foreground">{r.brand_name}</span>
                    <span className="text-muted-foreground ml-2">{r.total_scraped} scraped · {r.inserted}i / {r.updated}u / {r.skipped}s</span>
                    {r.errors?.length > 0 && <span className="text-destructive/70 ml-2">({r.errors.length} errors)</span>}
                  </div>
                ))}
              </>
            ) : (
              <div className="grid grid-cols-4 gap-3 font-body text-xs text-center">
                <div><div className="text-lg font-display text-foreground">{results.total_scraped}</div><div className="text-muted-foreground">Scraped</div></div>
                <div><div className="text-lg font-display text-success">{results.inserted}</div><div className="text-muted-foreground">Inserted</div></div>
                <div><div className="text-lg font-display text-warning">{results.updated}</div><div className="text-muted-foreground">Updated</div></div>
                <div><div className="text-lg font-display text-muted-foreground">{results.skipped}</div><div className="text-muted-foreground">Skipped</div></div>
              </div>
            )}
          </div>
        )}

        {/* Scrape History */}
        <ScrapeHistory />
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ScrapeProducts;
