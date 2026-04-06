import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Search, Loader2, X, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function TradeComparator() {
  const [search, setSearch] = useState("");
  const [compareList, setCompareList] = useState<any[]>([]);

  // Load only the user's favourited products
  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["comparator-favorites"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("trade_favorites")
        .select("id, product_id, trade_products(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data || [])
        .filter((f: any) => f.trade_products)
        .map((f: any) => ({ ...f.trade_products, favorite_id: f.id }));
    },
  });

  const filtered = favorites.filter((p: any) =>
    !search || [p.product_name, p.brand_name].some((f: string) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCompare = (p: any) => {
    if (compareList.length >= 4) return;
    if (compareList.find((c) => c.id === p.id)) return;
    setCompareList((prev) => [...prev, p]);
  };

  const removeFromCompare = (id: string) => {
    setCompareList((prev) => prev.filter((p) => p.id !== id));
  };

  const FIELDS = [
    { key: "brand_name", label: "Brand" },
    { key: "category", label: "Category" },
    { key: "dimensions", label: "Dimensions" },
    { key: "materials", label: "Materials" },
    { key: "lead_time", label: "Lead Time" },
    { key: "trade_price_cents", label: "Trade Price", format: (v: number | null) => v ? `€${(v / 100).toFixed(2)}` : "On request" },
    { key: "rrp_price_cents", label: "RRP", format: (v: number | null) => v ? `€${(v / 100).toFixed(2)}` : "—" },
  ];

  return (
    <>
      <Helmet><title>Product Comparator — Trade Portal</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Product Comparator</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Compare up to 4 products from your favourites side-by-side on dimensions, materials, price, and lead time.
          </p>
        </div>

        {compareList.length > 0 && (
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 w-32" />
                  {compareList.map((p) => (
                    <th key={p.id} className="px-4 py-3 min-w-[180px]">
                      <div className="relative">
                        <button onClick={() => removeFromCompare(p.id)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-muted flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                        {p.image_url && (
                          <img src={p.image_url} alt="" className="w-full h-28 object-contain rounded bg-muted mb-2" />
                        )}
                        <p className="font-display text-xs text-foreground">{p.product_name}</p>
                      </div>
                    </th>
                  ))}
                  {compareList.length < 4 && <th className="px-4 py-3 w-32" />}
                </tr>
              </thead>
              <tbody>
                {FIELDS.map((field) => (
                  <tr key={field.key} className="border-b border-border/50">
                    <td className="px-4 py-2.5 font-body text-[10px] uppercase tracking-wider text-muted-foreground">{field.label}</td>
                    {compareList.map((p) => {
                      const val = (p as any)[field.key];
                      return (
                        <td key={p.id} className="px-4 py-2.5 font-body text-sm text-foreground">
                          {field.format ? field.format(val) : val || "—"}
                        </td>
                      );
                    })}
                    {compareList.length < 4 && <td />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Heart className="h-3 w-3" />
              {compareList.length < 4
                ? `Select from your favourites (${compareList.length}/4)`
                : "Maximum 4 products"}
            </p>
          </div>

          {favorites.length === 0 && !isLoading && (
            <p className="font-body text-sm text-muted-foreground py-10 text-center">
              No favourites yet — save products from the Showroom to compare them here.
            </p>
          )}

          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your favourites..." className="pl-10 font-body text-sm" />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto">
              {filtered.map((p: any) => {
                const onList = compareList.find((c) => c.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCompare(p)}
                    disabled={!!onList || compareList.length >= 4}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${onList ? "border-primary bg-primary/5 opacity-60" : "border-border hover:border-foreground/30"} ${compareList.length >= 4 && !onList ? "opacity-40" : ""}`}
                  >
                    <div className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0">
                      {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-xs text-foreground truncate">{p.product_name}</p>
                      <p className="font-body text-[10px] text-muted-foreground">{p.brand_name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
