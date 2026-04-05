import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

export default function TradeReorder() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: pastQuotes = [], isLoading } = useQuery({
    queryKey: ["reorder-quotes", user?.id],
    queryFn: async () => {
      const { data: quotes } = await supabase
        .from("trade_quotes")
        .select("id, client_name, status, created_at, currency")
        .eq("user_id", user!.id)
        .in("status", ["confirmed", "responded"])
        .order("created_at", { ascending: false });

      if (!quotes?.length) return [];

      const quoteIds = quotes.map((q) => q.id);
      const { data: items } = await supabase
        .from("trade_quote_items")
        .select("quote_id, quantity, unit_price_cents, product_id")
        .in("quote_id", quoteIds);

      return quotes.map((q) => ({
        ...q,
        itemCount: (items || []).filter((i) => i.quote_id === q.id).reduce((s, i) => s + i.quantity, 0),
        total: (items || []).filter((i) => i.quote_id === q.id).reduce((s, i) => s + (i.unit_price_cents || 0) * i.quantity, 0),
      }));
    },
    enabled: !!user,
  });

  const handleReorder = async (quoteId: string) => {
    // Create a new draft quote duplicating the items
    const { data: sourceItems } = await supabase
      .from("trade_quote_items")
      .select("product_id, quantity, notes")
      .eq("quote_id", quoteId);

    if (!sourceItems?.length) {
      toast.error("No items to reorder");
      return;
    }

    const { data: newQuote, error } = await supabase
      .from("trade_quotes")
      .insert({ user_id: user!.id, status: "draft" })
      .select("id")
      .single();

    if (error || !newQuote) {
      toast.error("Failed to create reorder");
      return;
    }

    const newItems = sourceItems.map((item) => ({
      quote_id: newQuote.id,
      product_id: item.product_id,
      quantity: item.quantity,
      notes: item.notes,
    }));

    await supabase.from("trade_quote_items").insert(newItems);
    toast.success("Reorder created as draft quote");
    navigate("/trade/quotes");
  };

  return (
    <>
      <Helmet><title>Reorder — Trade Portal</title></Helmet>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Reorder / Repurchase</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Quick-reorder from past confirmed quotes for repeat specifications.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : pastQuotes.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <RefreshCw className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">No past orders found. Confirmed quotes will appear here for quick reordering.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pastQuotes.map((q: any) => (
              <div key={q.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors">
                <div>
                  <p className="font-display text-sm text-foreground">{q.client_name || "Untitled Quote"}</p>
                  <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                    {format(new Date(q.created_at), "dd MMM yyyy")} · {q.itemCount} item{q.itemCount !== 1 ? "s" : ""} · {q.total > 0 ? `€${(q.total / 100).toFixed(2)}` : "Price TBD"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleReorder(q.id)}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Reorder
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
