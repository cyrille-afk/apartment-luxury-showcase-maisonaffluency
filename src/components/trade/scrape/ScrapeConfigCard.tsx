import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Play, Search, Pencil, Check, X } from "lucide-react";
import { SavedConfig, COUNTRY_OPTIONS, SCHEDULE_OPTIONS } from "./scrape-types";

interface ScrapeConfigCardProps {
  config: SavedConfig;
  runningConfigId: string | null;
  onRunConfig: (configId: string) => void;
  onRefresh: () => void;
  onUpdateConfig: (configId: string, field: string, value: any) => Promise<void>;
}

const ScrapeConfigCard = ({
  config,
  runningConfigId,
  onRunConfig,
  onRefresh,
  onUpdateConfig,
}: ScrapeConfigCardProps) => {
  const { toast } = useToast();

  // URL editing
  const [editingUrls, setEditingUrls] = useState(false);
  const [editingUrlsText, setEditingUrlsText] = useState("");

  // URL discovery
  const [mappingConfig, setMappingConfig] = useState(false);
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [discoverFilter, setDiscoverFilter] = useState("");
  const [discoverPage, setDiscoverPage] = useState(0);

  const toggleConfigActive = async () => {
    await supabase.from("scrape_configs").update({ is_active: !config.is_active }).eq("id", config.id);
    onRefresh();
  };

  const updateSchedule = async (cron: string) => {
    await supabase.from("scrape_configs").update({
      schedule_cron: cron || null,
      updated_at: new Date().toISOString(),
    }).eq("id", config.id);
    onRefresh();
    toast({ title: "Schedule updated" });
  };

  const deleteConfig = async () => {
    await supabase.from("scrape_configs").delete().eq("id", config.id);
    onRefresh();
    toast({ title: "Config deleted" });
  };

  const discoverNewUrls = async () => {
    if (!config.urls.length) {
      toast({ title: "No existing URLs to derive site from", variant: "destructive" });
      return;
    }
    const baseUrl = new URL(config.urls[0]).origin;
    setMappingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke("firecrawl-map", {
        body: { url: baseUrl, limit: 500 },
      });
      if (error) throw error;
      const allUrls: string[] = (data.urls || data.links || []).filter((u: string) => u.startsWith("http"));
      const existingSet = new Set(config.urls);
      const newUrls = allUrls.filter((u) => !existingSet.has(u));
      if (newUrls.length) {
        setDiscoveredUrls(newUrls);
        setSelectedUrls(new Set(newUrls));
        setDiscoverFilter("");
        setDiscoverPage(0);
        toast({
          title: `Found ${newUrls.length} new URLs`,
          description: `${allUrls.length} total, ${allUrls.length - newUrls.length} already in config`,
        });
      } else {
        toast({ title: "No new URLs found", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Discovery failed", description: err.message, variant: "destructive" });
    } finally {
      setMappingConfig(false);
    }
  };

  const filter = discoverFilter.toLowerCase();
  const filteredDiscovered = filter
    ? discoveredUrls.filter((u) => u.toLowerCase().includes(filter))
    : discoveredUrls;
  const PAGE_SIZE = 30;
  const totalPages = Math.ceil(filteredDiscovered.length / PAGE_SIZE);
  const pagedDiscovered = filteredDiscovered.slice(discoverPage * PAGE_SIZE, (discoverPage + 1) * PAGE_SIZE);

  return (
    <div className="border border-border rounded-md p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-sm text-foreground">{config.brand_name}</span>
          <span className="font-body text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
            {config.category}
          </span>
          <button
            onClick={() => {
              if (editingUrls) {
                setEditingUrls(false);
              } else {
                setEditingUrls(true);
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
            onChange={(e) => onUpdateConfig(config.id, "location", e.target.value)}
            className="px-1.5 py-0.5 rounded border border-border bg-background font-body text-[10px] text-foreground"
            title="Country"
          >
            {COUNTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.value ? `📍 ${o.value}` : "🌐 Auto"}</option>
            ))}
          </select>
          <select
            value={config.chunk_size || 10}
            onChange={(e) => onUpdateConfig(config.id, "chunk_size", Number(e.target.value))}
            className="px-1.5 py-0.5 rounded border border-border bg-background font-body text-[10px] text-foreground w-14"
            title="Chunk size"
          >
            {[3, 5, 10, 15, 20].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            value={config.chunk_delay || 0}
            onChange={(e) => onUpdateConfig(config.id, "chunk_delay", Number(e.target.value))}
            className="px-1.5 py-0.5 rounded border border-border bg-background font-body text-[10px] text-foreground w-14"
            title="Delay (s)"
          >
            {[0, 2, 5, 10, 15, 30].map((n) => (
              <option key={n} value={n}>{n}s</option>
            ))}
          </select>
          {!config.is_active && (
            <span className="font-body text-[10px] text-destructive/70 px-1.5 py-0.5 rounded bg-destructive/10">
              paused
            </span>
          )}
        </div>

        {/* URL Editor */}
        {editingUrls && (
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
                {editingUrlsText.split(/[\n,]+/).filter((u) => u.trim().startsWith("http")).length} valid URLs
              </span>
              <button
                onClick={async () => {
                  const newUrls = editingUrlsText.split(/[\n,]+/).map((u) => u.trim()).filter((u) => u.startsWith("http"));
                  if (!newUrls.length) { toast({ title: "No valid URLs", variant: "destructive" }); return; }
                  await onUpdateConfig(config.id, "urls", newUrls);
                  setEditingUrls(false);
                }}
                className="p-1 rounded border border-success/30 text-success hover:bg-success/10 transition-colors"
                title="Save URLs"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                onClick={() => setEditingUrls(false)}
                className="p-1 rounded border border-border text-muted-foreground hover:bg-muted transition-colors"
                title="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Last run info */}
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

        {/* Discovered URLs panel */}
        {discoveredUrls.length > 0 && (
          <div className="mt-2 border border-border rounded p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-body text-[10px] text-foreground">
                {(() => {
                  const filteredSelected = filteredDiscovered.filter((u) => selectedUrls.has(u)).length;
                  const totalSelected = selectedUrls.size;
                  return filter
                    ? `${filteredSelected}/${filteredDiscovered.length} filtered · ${totalSelected}/${discoveredUrls.length} total selected`
                    : `${totalSelected} / ${discoveredUrls.length} new URLs selected`;
                })()}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const toAdd = filter ? filteredDiscovered : discoveredUrls;
                    setSelectedUrls((prev) => new Set([...prev, ...toAdd]));
                  }}
                  className="font-body text-[10px] text-primary hover:underline"
                >All</button>
                <button
                  onClick={() => {
                    if (!filter) {
                      setSelectedUrls(new Set());
                    } else {
                      const toRemove = new Set(filteredDiscovered);
                      setSelectedUrls((prev) => {
                        const s = new Set(prev);
                        toRemove.forEach((u) => s.delete(u));
                        return s;
                      });
                    }
                  }}
                  className="font-body text-[10px] text-muted-foreground hover:underline"
                >None</button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
              <input
                value={discoverFilter}
                onChange={(e) => { setDiscoverFilter(e.target.value); setDiscoverPage(0); }}
                placeholder="Filter URLs…"
                className="w-full pl-7 pr-2 py-1 rounded border border-border bg-background font-body text-[10px] text-foreground placeholder:text-muted-foreground/40"
              />
            </div>
            {filter && (
              <span className="font-body text-[10px] text-muted-foreground/50">
                Showing {filteredDiscovered.length} of {discoveredUrls.length}
              </span>
            )}
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {pagedDiscovered.map((url) => (
                <label key={url} className="flex items-center gap-1.5 font-body text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUrls.has(url)}
                    onChange={(e) => {
                      setSelectedUrls((prev) => {
                        const s = new Set(prev);
                        e.target.checked ? s.add(url) : s.delete(url);
                        return s;
                      });
                    }}
                    className="rounded"
                  />
                  <span className="truncate">{url.replace(/^https?:\/\/[^/]+/, "")}</span>
                </label>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={() => setDiscoverPage((p) => Math.max(0, p - 1))}
                  disabled={discoverPage === 0}
                  className="px-2 py-0.5 rounded border border-border font-body text-[10px] text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
                >←</button>
                <span className="font-body text-[10px] text-muted-foreground">
                  {discoverPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setDiscoverPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={discoverPage >= totalPages - 1}
                  className="px-2 py-0.5 rounded border border-border font-body text-[10px] text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
                >→</button>
              </div>
            )}
            <div className="flex gap-1.5">
              <button
                onClick={async () => {
                  const selected = Array.from(selectedUrls);
                  if (!selected.length) { toast({ title: "No URLs selected", variant: "destructive" }); return; }
                  const merged = [...new Set([...config.urls, ...selected])];
                  await onUpdateConfig(config.id, "urls", merged);
                  setDiscoveredUrls([]);
                  setSelectedUrls(new Set());
                  toast({ title: `Added ${selected.length} URLs`, description: `Config now has ${merged.length} total URLs` });
                }}
                className="px-2 py-1 rounded border border-success/30 text-success font-body text-[10px] hover:bg-success/10 transition-colors"
              >
                <Check className="h-3 w-3 inline mr-1" />Add selected
              </button>
              <button
                onClick={() => setDiscoveredUrls([])}
                className="px-2 py-1 rounded border border-border text-muted-foreground font-body text-[10px] hover:bg-muted transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Discover URLs button */}
      <button
        onClick={discoverNewUrls}
        disabled={mappingConfig}
        className="p-1.5 rounded border border-primary/20 text-primary hover:bg-primary/5 transition-colors disabled:opacity-40"
        title="Discover new URLs"
      >
        {mappingConfig ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Search className="h-3.5 w-3.5" />
        )}
      </button>

      <select
        value={config.schedule_cron || ""}
        onChange={(e) => updateSchedule(e.target.value)}
        className="px-2 py-1 rounded border border-border bg-background font-body text-[10px] text-foreground"
      >
        {SCHEDULE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <button
        onClick={toggleConfigActive}
        className={`px-2 py-1 rounded border text-[10px] font-body transition-colors ${
          config.is_active
            ? "border-success/30 text-success hover:bg-success/10"
            : "border-muted text-muted-foreground hover:bg-muted"
        }`}
      >
        {config.is_active ? "Active" : "Paused"}
      </button>

      <button
        onClick={() => onRunConfig(config.id)}
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
        onClick={deleteConfig}
        className="p-1.5 rounded border border-destructive/20 text-destructive/60 hover:bg-destructive/10 transition-colors"
        title="Delete config"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default ScrapeConfigCard;
