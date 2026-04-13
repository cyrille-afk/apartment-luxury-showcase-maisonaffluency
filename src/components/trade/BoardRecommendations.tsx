import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, RefreshCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Recommendation {
  product_id: string;
  score: number;
  reason: string;
  title: string;
  subtitle: string;
  image_url: string;
  category: string;
  brand: string;
}

export function BoardRecommendations() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [boardTitle, setBoardTitle] = useState("");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadRecommendations();
  }, [user]);

  const loadRecommendations = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Find user's most recently updated board with items
      const { data: boards } = await supabase
        .from("client_boards")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (!boards?.length) {
        setLoading(false);
        return;
      }

      // Find first board that has items
      let activeBoardId: string | null = null;
      let activeBoardTitle = "";
      for (const b of boards) {
        const { count } = await supabase
          .from("client_board_items")
          .select("*", { count: "exact", head: true })
          .eq("board_id", b.id);
        if (count && count > 0) {
          activeBoardId = b.id;
          activeBoardTitle = b.title;
          break;
        }
      }

      if (!activeBoardId) {
        setLoading(false);
        return;
      }

      setBoardId(activeBoardId);
      setBoardTitle(activeBoardTitle);

      // Generate fresh recommendations so relevance updates are reflected immediately
      await generateRecommendations(activeBoardId);
    } catch (err) {
      console.error("Failed to load recommendations:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async (id: string) => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("board-recommendations", {
        body: { board_id: id },
      });

      if (error) {
        console.error("Recommendation error:", error);
        return;
      }

      if (data?.recommendations) {
        setRecommendations(data.recommendations);
        if (data.board_title) setBoardTitle(data.board_title);
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

  if (!recommendations.length) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Suggested for <em className="not-italic text-primary">{boardTitle}</em>
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => boardId && generateRecommendations(boardId)}
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
            to="/trade/showroom"
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
