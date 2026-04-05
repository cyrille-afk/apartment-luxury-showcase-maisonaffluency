import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Search, Loader2, Paintbrush, Plus, X, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function TradeMoodBoards() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [board, setBoard] = useState<any[]>([]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["mood-board-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, category")
        .eq("is_active", true)
        .not("image_url", "is", null)
        .order("brand_name");
      return data || [];
    },
  });

  const filtered = products.filter((p: any) =>
    !search || [p.product_name, p.brand_name].some((f: string) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const addToBoard = (product: any) => {
    if (board.find((b) => b.id === product.id)) return;
    setBoard((prev) => [...prev, product]);
  };

  const removeFromBoard = (id: string) => {
    setBoard((prev) => prev.filter((p) => p.id !== id));
  };

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
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">{board.length} item{board.length !== 1 ? "s" : ""} on board</p>
            </div>
            {board.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center py-20">
                <Paintbrush className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="font-body text-sm text-muted-foreground">Add products from the right panel to build your mood board.</p>
              </div>
            ) : (
              <div className={`grid gap-2 ${board.length <= 2 ? "grid-cols-2" : board.length <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
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

          {/* Product picker */}
          <div className="w-full lg:w-72 shrink-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-10 font-body text-sm" />
            </div>
            <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : (
                filtered.slice(0, 50).map((p: any) => {
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
