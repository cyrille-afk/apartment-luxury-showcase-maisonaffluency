import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface AnchorRef {
  name: string;
  brand: string;
  category: string;
}

interface Recommendation {
  product_id: string;
  score: number;
  reason: string;
  title: string;
  subtitle: string;
  image_url: string;
  category: string;
  brand: string;
  anchors?: AnchorRef[];
}

export function BoardRecommendations() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadForActiveProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Identify the user's "active project" = most recently updated project that
  // has at least one tearsheet item (quote item or client_board item). Then
  // aggregate the product IDs across those tearsheets and feed them to the
  // recommendation engine, so the dashboard strip is always anchored to a
  // real project context instead of a stray board.
  const loadForActiveProject = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (!projects?.length) {
        setLoading(false);
        return;
      }

      for (const p of projects) {
        const ids = await collectProjectProductIds(p.id);
        if (ids.length > 0) {
          setProjectId(p.id);
          setProjectName(p.name);
          setProductIds(ids);
          await generateRecommendations(ids);
          break;
        }
      }
    } catch (err) {
      console.error("Failed to load recommendations:", err);
    } finally {
      setLoading(false);
    }
  };

  const collectProjectProductIds = async (pid: string): Promise<string[]> => {
    const ids = new Set<string>();
    const [quotesRes, boardsRes] = await Promise.all([
      supabase.from("trade_quotes").select("id").eq("project_id", pid),
      supabase.from("client_boards").select("id").eq("project_id", pid),
    ]);
    const quoteIds = (quotesRes.data || []).map((q: any) => q.id);
    const boardIds = (boardsRes.data || []).map((b: any) => b.id);

    const [qItems, bItems] = await Promise.all([
      quoteIds.length
        ? supabase.from("trade_quote_items").select("product_id").in("quote_id", quoteIds)
        : Promise.resolve({ data: [] as any[] }),
      boardIds.length
        ? supabase.from("client_board_items").select("product_id").in("board_id", boardIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    (qItems.data || []).forEach((r: any) => r.product_id && ids.add(r.product_id));
    (bItems.data || []).forEach((r: any) => r.product_id && ids.add(r.product_id));
    return Array.from(ids).slice(0, 20);
  };

  const generateRecommendations = async (ids: string[]) => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("board-recommendations", {
        body: { product_ids: ids, source: "mood_board" },
      });
      if (error) {
        console.error("Recommendation error:", error);
        return;
      }
      if (data?.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch (err) {
      console.error("Failed to generate recommendations:", err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-10 animate-pulse">
        <div className="h-5 w-64 bg-muted rounded mb-4" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-44 shrink-0">
              <div className="h-44 bg-muted rounded-lg mb-2" />
              <div className="h-3 w-32 bg-muted rounded mb-1" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!recommendations.length || !projectId) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Suggested for <em className="not-italic text-primary">{projectName}</em>
        </h2>
        <div className="flex items-center gap-2">
          <Link
            to={`/trade/mood-boards?project=${projectId}`}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Open mood board
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => productIds.length && generateRecommendations(productIds)}
            disabled={refreshing}
            className="text-xs text-muted-foreground"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {recommendations.slice(0, 6).map((rec) => (
          <Link
            key={rec.product_id}
            to={`/trade/mood-boards?project=${projectId}`}
            className="group w-44 shrink-0"
          >
            <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2 border border-border group-hover:border-primary/30 transition-colors">
              {rec.image_url ? (
                <img
                  src={rec.image_url}
                  alt={rec.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  No image
                </div>
              )}
            </div>
            <p className="text-xs font-medium text-foreground truncate">{rec.title}</p>
            <p className="text-[11px] text-muted-foreground truncate">{rec.brand}</p>
            <p className="text-[10px] text-primary/70 mt-0.5 line-clamp-2 leading-tight">
              {rec.reason}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
