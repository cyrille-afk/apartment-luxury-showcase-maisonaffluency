import { useState, useCallback } from "react";
import { Search, Loader2, ChevronRight, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SearchResult {
  title: string;
  link: string;
  thumbnail: string;
  contextLink: string;
  width: number;
  height: number;
}

interface ProductImageSearchProps {
  onSelectImage: (result: { title: string; imageUrl: string; sourceUrl: string }) => void;
}

const ProductImageSearch = ({ onSelectImage }: ProductImageSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextStart, setNextStart] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const search = useCallback(async (searchQuery: string, start = 1) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("google-image-search", {
        body: { query: searchQuery, start },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      if (start === 1) {
        setResults(data.results || []);
      } else {
        setResults(prev => [...prev, ...(data.results || [])]);
      }
      setNextStart(data.nextStart || null);
      setHasSearched(true);
    } catch (err: any) {
      console.error("Image search error:", err);
      setError(err.message || "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelect = async (result: SearchResult, idx: number) => {
    setImporting(idx);
    try {
      // Proxy the image through our edge function to avoid hotlink blocks
      const { data, error: fnError } = await supabase.functions.invoke("proxy-image", {
        body: {
          url: result.link,
          fallbackUrl: result.thumbnail || null,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      onSelectImage({
        title: result.title,
        imageUrl: data.publicUrl,
        sourceUrl: result.contextLink,
      });

      toast({ title: "Image imported successfully" });
    } catch (err: any) {
      console.error("Image import error:", err);
      toast({
        title: "Import failed",
        description: err.message || "Could not import this image. Try another.",
        variant: "destructive",
      });
    } finally {
      setImporting(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query, 1);
  };

  return (
    <div className="space-y-4">
      {/* Search input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for product images (e.g. 'Fendi Casa sofa')…"
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-md bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading && results.length === 0 ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      {/* Results grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {results.map((result, idx) => (
            <button
              key={`${result.link}-${idx}`}
              onClick={() => handleSelect(result, idx)}
              disabled={importing !== null}
              className="group relative aspect-square bg-muted rounded-md overflow-hidden border border-border hover:border-primary/50 transition-all hover:shadow-md disabled:opacity-60"
            >
              {importing === idx && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                  <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                </div>
              )}
              <img
                src={result.thumbnail || result.link}
                alt={result.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
              <div className="hidden absolute inset-0 flex items-center justify-center text-muted-foreground">
                <ImageOff className="h-6 w-6" />
              </div>
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/60 transition-colors flex items-end p-2 opacity-0 group-hover:opacity-100">
                <p className="text-xs text-white line-clamp-2 leading-tight">{result.title}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Load more */}
      {nextStart && (
        <div className="flex justify-center">
          <button
            onClick={() => search(query, nextStart)}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md hover:border-foreground/30 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Load more results
          </button>
        </div>
      )}

      {/* Empty state */}
      {hasSearched && results.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <ImageOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No images found. Try a different search term.</p>
        </div>
      )}
    </div>
  );
};

export default ProductImageSearch;
