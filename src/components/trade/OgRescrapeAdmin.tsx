import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Check, X, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type RescrapeResult = {
  url: string;
  ok: boolean;
  title?: string;
  error?: string;
};

export default function OgRescrapeAdmin() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    total: number;
    results: RescrapeResult[];
  } | null>(null);
  const [category, setCategory] = useState<"all" | "designers" | "ateliers" | "journal">("all");

  const handleRescrape = async () => {
    setRunning(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("rescrape-og", {
        body: { all: true, category },
      });
      if (error) throw error;
      setResults(data);
      toast({
        title: `OG Rescrape Complete`,
        description: `${data.success}/${data.total} succeeded, ${data.failed} failed`,
      });
    } catch (err: any) {
      toast({
        title: "Rescrape failed",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const failedResults = results?.results.filter((r) => !r.ok) || [];

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 group cursor-pointer w-full">
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <div className="flex-1 text-left">
          <h2 className="font-display text-lg text-foreground">OG / Social Previews</h2>
          <p className="font-body text-xs text-muted-foreground">
            Force Meta to re-scrape all OG bridge files for WhatsApp & social previews
          </p>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 ml-6 space-y-4">
        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "designers", "ateliers", "journal"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full font-body text-xs uppercase tracking-[0.1em] border transition-colors ${
                category === c
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Trigger button */}
        <button
          onClick={handleRescrape}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Rescraping…" : `Rescrape ${category === "all" ? "All" : category} OG Files`}
        </button>

        {/* Results */}
        {results && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 font-body text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <Check className="h-4 w-4" /> {results.success} OK
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <X className="h-4 w-4" /> {results.failed} failed
              </span>
              <span className="text-muted-foreground">/ {results.total} total</span>
            </div>

            {failedResults.length > 0 && (
              <div className="border border-destructive/20 rounded-lg p-3 max-h-60 overflow-y-auto">
                <p className="font-body text-xs font-medium text-destructive mb-2">Failed URLs:</p>
                {failedResults.map((r, i) => (
                  <div key={i} className="font-body text-[11px] text-muted-foreground py-0.5 border-b border-border/50 last:border-0">
                    <span className="text-foreground break-all">{r.url}</span>
                    {r.error && <span className="block text-destructive/80 mt-0.5">{r.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
