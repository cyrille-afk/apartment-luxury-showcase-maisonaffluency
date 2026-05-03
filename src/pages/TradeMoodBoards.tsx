import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, Paintbrush, Plus, X, Heart, FolderOpen, LayoutGrid, Sparkles, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PickerFilter = "all" | "favourites" | "board";

const BOARD_STORAGE_KEY = "mood-board-items";

function loadBoardFromStorage(): any[] {
  try {
    const stored = localStorage.getItem(BOARD_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

interface MoodRec {
  product_id: string;
  score: number;
  reason: string;
  title: string;
  subtitle: string;
  image_url: string;
  category: string;
  brand: string;
}

export default function TradeMoodBoards() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [board, setBoard] = useState<any[]>(loadBoardFromStorage);
  const [filter, setFilter] = useState<PickerFilter>("all");
  const [recommendations, setRecommendations] = useState<MoodRec[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const prevBoardIdsRef = useRef<string>("");

  // Persist board to localStorage on change
  useEffect(() => {
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(board));
  }, [board]);

  // Auto-fetch recommendations when board has 2+ items and composition changes
  useEffect(() => {
    const currentIds = board.map((b) => b.id).sort().join(",");
    if (currentIds === prevBoardIdsRef.current) return;
    prevBoardIdsRef.current = currentIds;

    if (board.length < 2) {
      setRecommendations([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchRecommendations(board.map((b) => b.id));
    }, 1500); // Debounce 1.5s

    return () => clearTimeout(timer);
  }, [board]);

  const fetchRecommendations = useCallback(async (productIds: string[]) => {
    setRecLoading(true);
    setRecError(null);
    try {
      const { data, error } = await supabase.functions.invoke("board-recommendations", {
        body: { product_ids: productIds, source: "mood_board" },
      });
      if (error) throw error;
      if (data?.recommendations) {
        const recs: MoodRec[] = data.recommendations;
        setRecommendations(recs);

        // Concierge steps in to narrate WHY these complements were chosen.
        // We only fire when there's something meaningful to say.
        if (recs.length > 0) {
          const top = recs.slice(0, 6);
          const bullets = top
            .map((r) => `- **${r.title}**${r.brand ? ` · ${r.brand}` : ""} — ${r.reason}`)
            .join("\n");
          const message =
            `I've pulled ${top.length} complement${top.length === 1 ? "" : "s"} for the mood you're building. ` +
            `Here's why each was chosen:\n\n${bullets}\n\n` +
            `Tap any thumbnail to drop it onto the board, or ask me to refine the direction (warmer palette, smaller scale, more sculptural, etc.).`;
          window.dispatchEvent(
            new CustomEvent("concierge:stage", {
              detail: {
                stage: "Tearsheet",
                message,
                openPanel: false,
                actions: [
                  { label: "Make it warmer", prompt: "Suggest complements with a warmer, earthier palette for my current mood board." },
                  { label: "More sculptural", prompt: "Replace the current complements with more sculptural, statement pieces." },
                  { label: "Different scale", prompt: "Suggest complements at a different scale (smaller accent pieces) for my mood board." },
                ],
              },
            }),
          );
        }
      }
    } catch (err: any) {
      console.error("Mood board recommendations error:", err);
      setRecError("Could not generate suggestions");
    } finally {
      setRecLoading(false);
    }
  }, []);

  // All products: merge trade_products + designer_curator_picks
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["mood-board-products-merged"],
    queryFn: async () => {
      const [{ data: trade }, { data: curator }] = await Promise.all([
        supabase
          .from("trade_products")
          .select("id, product_name, brand_name, image_url, category")
          .eq("is_active", true)
          .not("image_url", "is", null)
          .order("brand_name"),
        supabase
          .from("designer_curator_picks")
          .select("id, title, image_url, category, designer_id")
          .not("image_url", "is", null)
          .order("title"),
      ]);

      // Resolve designer names for curator picks
      const designerIds = [...new Set((curator || []).map((p) => p.designer_id))];
      let designerMap = new Map<string, string>();
      if (designerIds.length > 0) {
        const { data: designers } = await supabase
          .from("designers")
          .select("id, name")
          .in("id", designerIds);
        designerMap = new Map((designers || []).map((d) => [d.id, d.name]));
      }

      const tradeItems = (trade || []).map((p) => ({
        id: p.id,
        product_name: p.product_name,
        brand_name: p.brand_name,
        image_url: p.image_url,
        category: p.category,
        source: "trade" as const,
      }));

      const curatorItems = (curator || []).map((p) => ({
        id: p.id,
        product_name: p.title,
        brand_name: designerMap.get(p.designer_id) || "Unknown",
        image_url: p.image_url,
        category: p.category || "",
        source: "curator" as const,
      }));

      // Deduplicate by name+brand, preferring curator (richer data)
      const seen = new Set<string>();
      const merged: Array<{ id: string; product_name: string; brand_name: string; image_url: string; category: string; source: "trade" | "curator" }> = [];
      for (const item of [...curatorItems, ...tradeItems]) {
        const key = `${item.product_name?.toLowerCase()}|${item.brand_name?.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
      return merged.sort((a, b) => a.brand_name.localeCompare(b.brand_name));
    },
  });

  // User's favourites
  const { data: favouriteProducts = [], isLoading: loadingFavs } = useQuery({
    queryKey: ["mood-board-favourites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: favs } = await supabase
        .from("trade_favorites")
        .select("product_id")
        .eq("user_id", user!.id);
      if (!favs?.length) return [];
      const ids = favs.map((f) => f.product_id);
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, category")
        .in("id", ids)
        .not("image_url", "is", null)
        .order("brand_name");
      return data || [];
    },
  });

  // User's board items (from client_boards)
  const { data: boardProducts = [], isLoading: loadingBoards } = useQuery({
    queryKey: ["mood-board-project-items", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: boards } = await supabase
        .from("client_boards")
        .select("id")
        .eq("user_id", user!.id);
      if (!boards?.length) return [];
      const boardIds = boards.map((b) => b.id);
      const { data: items } = await supabase
        .from("client_board_items")
        .select("product_id")
        .in("board_id", boardIds);
      if (!items?.length) return [];
      const productIds = [...new Set(items.map((i) => i.product_id))];
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, category")
        .in("id", productIds)
        .not("image_url", "is", null)
        .order("brand_name");
      return data || [];
    },
  });

  const sourceProducts = filter === "favourites" ? favouriteProducts : filter === "board" ? boardProducts : products;
  const sourceLoading = filter === "favourites" ? loadingFavs : filter === "board" ? loadingBoards : isLoading;

  const filtered = sourceProducts.filter((p: any) =>
    !search || [p.product_name, p.brand_name].some((f: string) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const addToBoard = (product: any) => {
    if (board.find((b) => b.id === product.id)) return;
    setBoard((prev) => [...prev, product]);
  };

  const addRecToBoard = (rec: MoodRec) => {
    if (board.find((b) => b.id === rec.product_id)) return;
    setBoard((prev) => [...prev, {
      id: rec.product_id,
      product_name: rec.title,
      brand_name: rec.brand,
      image_url: rec.image_url,
      category: rec.category,
    }]);
    // Remove from recommendations
    setRecommendations((prev) => prev.filter((r) => r.product_id !== rec.product_id));
  };

  const removeFromBoard = (id: string) => {
    setBoard((prev) => prev.filter((p) => p.id !== id));
  };

  const filterOptions: { key: PickerFilter; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All", icon: <LayoutGrid className="h-3 w-3" /> },
    { key: "favourites", label: "Favourites", icon: <Heart className="h-3 w-3" /> },
    { key: "board", label: "Projects", icon: <FolderOpen className="h-3 w-3" /> },
  ];

  return (
    <>
      <Helmet><title>Mood Board — Trade Portal</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Mood Board Builder</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Curate product imagery into collages for early-stage concept pitches.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Board area */}
          <div className="flex-1 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">{board.length} item{board.length !== 1 ? "s" : ""} on board</p>
              </div>
              {board.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center py-20">
                  <Paintbrush className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="font-body text-sm text-muted-foreground">Add products from the right panel to build your mood board.</p>
                </div>
              ) : (
                <div className={`grid gap-2 ${board.length <= 2 ? "grid-cols-3" : board.length <= 6 ? "grid-cols-3" : "grid-cols-4"}`}>
                  {board.map((item) => (
                    <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                      <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="font-display text-xs text-white truncate">{item.product_name}</p>
                          <p className="font-body text-[10px] text-white/70">{item.brand_name}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromBoard(item.id)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Recommendations */}
            {(recLoading || recommendations.length > 0 || recError) && (
              <div className="border-t border-border pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-sm text-foreground flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Suggested complements
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchRecommendations(board.map((b) => b.id))}
                    disabled={recLoading || board.length < 2}
                    className="text-[10px] text-muted-foreground h-7 px-2"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${recLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                {recLoading ? (
                  <div className="flex gap-3 overflow-hidden">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-32 shrink-0 animate-pulse">
                        <div className="aspect-square bg-muted rounded-lg mb-1.5" />
                        <div className="h-2.5 w-24 bg-muted rounded mb-1" />
                        <div className="h-2 w-16 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : recError ? (
                  <p className="font-body text-xs text-muted-foreground">{recError}</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {recommendations.slice(0, 8).map((rec) => (
                      <button
                        key={rec.product_id}
                        onClick={() => addRecToBoard(rec)}
                        className="group w-32 shrink-0 text-left"
                      >
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-1.5 border border-border group-hover:border-primary/40 transition-colors">
                          {rec.image_url ? (
                            <img
                              src={rec.image_url}
                              alt={rec.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">
                              No image
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Plus className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                          </div>
                        </div>
                        <p className="font-body text-[10px] text-foreground truncate">{rec.title}</p>
                        <p className="font-body text-[9px] text-muted-foreground truncate">{rec.brand}</p>
                        <p className="font-body text-[9px] text-primary/70 line-clamp-2 leading-tight mt-0.5">
                          {rec.reason}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product picker */}
          <div className="w-full lg:w-72 shrink-0 space-y-3">
            {/* Filter toggle */}
            <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg">
              {filterOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                    filter === opt.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-10 font-body text-sm" />
            </div>

            <p className="font-body text-[10px] text-muted-foreground">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            </p>

            <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
              {sourceLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <p className="font-body text-xs text-muted-foreground text-center py-8">
                  {filter === "favourites" ? "No favourited products yet." : filter === "board" ? "No products in your project boards." : "No products found."}
                </p>
              ) : (
                filtered.slice(0, 100).map((p: any) => {
                  const onBoard = board.find((b) => b.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToBoard(p)}
                      disabled={!!onBoard}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${onBoard ? "opacity-40 cursor-default" : "hover:bg-muted/50"}`}
                    >
                      <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                        {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-xs text-foreground truncate">{p.product_name}</p>
                        <p className="font-body text-[10px] text-muted-foreground">{p.brand_name}</p>
                      </div>
                      {!onBoard && <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}