import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Trash2, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface FolderItem {
  favoriteId: string;
  productId: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
}

export default function TradeFavoriteFolderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [folderName, setFolderName] = useState("");
  const [items, setItems] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      setLoading(true);
      const [folderRes, itemsRes] = await Promise.all([
        supabase.from("favorite_folders").select("name").eq("id", id).single(),
        supabase.from("favorite_folder_items")
          .select("favorite_id, trade_favorites!inner(id, product_id, trade_products(product_name, brand_name, image_url))")
          .eq("folder_id", id),
      ]);
      if (folderRes.data) setFolderName((folderRes.data as any).name);
      const mapped: FolderItem[] = (itemsRes.data || []).map((row: any) => ({
        favoriteId: row.favorite_id,
        productId: row.trade_favorites?.product_id,
        product_name: row.trade_favorites?.trade_products?.product_name || "Unknown",
        brand_name: row.trade_favorites?.trade_products?.brand_name || "",
        image_url: row.trade_favorites?.trade_products?.image_url || null,
      }));
      setItems(mapped);
      setLoading(false);
    };
    load();
  }, [id, user]);

  const remove = async (favoriteId: string) => {
    if (!id) return;
    await supabase.from("favorite_folder_items").delete().eq("folder_id", id).eq("favorite_id", favoriteId);
    setItems((p) => p.filter((i) => i.favoriteId !== favoriteId));
    toast({ title: "Removed from folder" });
  };

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <Link to="/trade/me" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back to dashboard
      </Link>
      <h1 className="font-display text-2xl text-foreground mb-6">{folderName || "Folder"}</h1>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Heart className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-body text-sm text-muted-foreground mb-3">No items in this folder yet</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/trade/favorites")}>Browse favorites</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((it) => (
            <div key={it.favoriteId} className="group relative border border-border rounded-lg overflow-hidden">
              <Link to={`/trade/products/${it.productId}`} className="block">
                <div className="aspect-square bg-muted/30">
                  {it.image_url ? <img src={it.image_url} alt={it.product_name} className="w-full h-full object-cover" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center"><Heart className="h-5 w-5 text-muted-foreground/30" /></div>}
                </div>
                <div className="p-2">
                  <p className="font-body text-xs text-foreground truncate">{it.product_name}</p>
                  <p className="font-body text-[10px] text-muted-foreground truncate">{it.brand_name}</p>
                </div>
              </Link>
              <Button
                variant="secondary" size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => remove(it.favoriteId)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
