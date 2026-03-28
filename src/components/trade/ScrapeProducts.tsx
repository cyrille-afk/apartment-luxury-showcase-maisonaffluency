import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronRight, Globe, Package } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ScrapeProducts = () => {
  const { toast } = useToast();
  const [urlText, setUrlText] = useState("");
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("Rugs");
  const [scraping, setScraping] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleScrape = async () => {
    const urls = urlText
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"));

    if (!urls.length) {
      toast({ title: "No valid URLs found", variant: "destructive" });
      return;
    }
    if (!brandName.trim()) {
      toast({ title: "Brand name is required", variant: "destructive" });
      return;
    }

    setScraping(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-products", {
        body: {
          urls,
          brand_name: brandName.trim(),
          category: category.trim() || "Uncategorized",
        },
      });

      if (error) throw error;
      setResult(data);
      toast({
        title: "Scrape complete",
        description: `${data.inserted} inserted, ${data.updated} updated, ${data.skipped} skipped`,
      });
    } catch (err: any) {
      toast({ title: "Scrape failed", description: err.message, variant: "destructive" });
      setResult({ error: err.message });
    } finally {
      setScraping(false);
    }
  };

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 group cursor-pointer">
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <h2 className="font-display text-lg text-foreground">Scrape Products</h2>
      </CollapsibleTrigger>
      <p className="font-body text-xs text-muted-foreground ml-6">
        Paste product page URLs to scrape pricing and details via Firecrawl into the trade catalogue.
      </p>
      <CollapsibleContent className="mt-3 ml-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">Brand Name *</label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. Atelier Février"
                className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Rugs, Lighting, Furniture"
              className="w-full px-3 py-2 rounded-md border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        <div>
          <label className="font-body text-xs text-muted-foreground block mb-1">
            Product URLs (one per line or comma-separated)
          </label>
          <textarea
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            rows={8}
            placeholder={"https://example.com/product/item-1/\nhttps://example.com/product/item-2/\nhttps://example.com/product/item-3/"}
            className="w-full px-3 py-2 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 font-mono leading-relaxed resize-y"
          />
          <p className="font-body text-[10px] text-muted-foreground/50 mt-1">
            {urlText.split(/[\n,]+/).filter((u) => u.trim().startsWith("http")).length} valid URL(s) detected
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleScrape}
            disabled={scraping || !brandName.trim() || !urlText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {scraping ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Scraping…
              </>
            ) : (
              <>
                <Globe className="h-3.5 w-3.5" />
                Scrape &amp; Import
              </>
            )}
          </button>
          {scraping && (
            <span className="font-body text-xs text-muted-foreground animate-pulse">
              This may take 3–6 minutes for large batches…
            </span>
          )}
        </div>

        {result && (
          <div className="rounded-md border border-border p-4 bg-muted/30">
            <h4 className="font-display text-sm text-foreground mb-2">
              {result.error ? "Error" : "Results"}
            </h4>
            {result.error ? (
              <p className="font-body text-xs text-destructive">{result.error}</p>
            ) : (
              <div className="grid grid-cols-4 gap-3 font-body text-xs">
                <div className="text-center">
                  <div className="text-xl font-display text-foreground">{result.total_scraped}</div>
                  <div className="text-muted-foreground">Scraped</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-display text-success">{result.inserted}</div>
                  <div className="text-muted-foreground">Inserted</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-display text-warning">{result.updated}</div>
                  <div className="text-muted-foreground">Updated</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-display text-muted-foreground">{result.skipped}</div>
                  <div className="text-muted-foreground">Skipped</div>
                </div>
              </div>
            )}
            {result.errors?.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="font-body text-[10px] text-destructive font-medium">Errors:</p>
                {result.errors.slice(0, 10).map((e: string, i: number) => (
                  <p key={i} className="font-body text-[10px] text-destructive/70">{e}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ScrapeProducts;
