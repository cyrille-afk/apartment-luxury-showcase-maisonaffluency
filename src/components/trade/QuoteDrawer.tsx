import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Trash2, Package, ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

interface QuoteItem {
  id: string;
  quantity: number;
  product: {
    product_name: string;
    brand_name: string;
    image_url: string | null;
    trade_price_cents: number | null;
    currency: string;
  };
}

interface QuoteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string | null;
  /** Bump this number to trigger a re-fetch (e.g. after adding an item) */
  refreshKey?: number;
}

const formatPrice = (cents: number, currency: string) => {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const QuoteDrawer = ({ open, onOpenChange, quoteId, refreshKey = 0 }: QuoteDrawerProps) => {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !quoteId) return;
    const fetchItems = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("trade_quote_items")
        .select("id, quantity, product:trade_products(product_name, brand_name, image_url, trade_price_cents, currency)")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false });

      if (data) {
        setItems(
          (data as any[]).map((d) => ({
            id: d.id,
            quantity: d.quantity,
            product: Array.isArray(d.product) ? d.product[0] : d.product,
          }))
        );
      }
      setLoading(false);
    };
    fetchItems();
  }, [open, quoteId, refreshKey]);

  const removeItem = async (itemId: string) => {
    await supabase.from("trade_quote_items").delete().eq("id", itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display text-lg flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Active Quote
            {quoteId && (
              <span className="font-body text-xs text-muted-foreground ml-1">
                QU-{quoteId.slice(0, 6).toUpperCase()}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="font-body text-xs">
            {itemCount} {itemCount === 1 ? "item" : "items"} in this quote
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4 -mx-6 px-6 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-body text-sm text-muted-foreground">No items yet</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border border-border hover:border-foreground/10 transition-colors">
                <div className="w-12 h-12 rounded bg-muted/30 overflow-hidden shrink-0">
                  {item.product?.image_url ? (
                    <img src={item.product.image_url} alt={item.product.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-3 w-3 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[9px] text-muted-foreground uppercase tracking-wider">
                    {item.product?.brand_name}
                  </p>
                  <p className="font-display text-xs text-foreground truncate">
                    {item.product?.product_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-body text-[10px] text-muted-foreground">
                      Qty: {item.quantity}
                    </span>
                    {item.product?.trade_price_cents && (
                      <span className="font-body text-[10px] text-primary font-medium">
                        {formatPrice(item.product.trade_price_cents, item.product.currency)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {quoteId && (
          <div className="border-t border-border pt-4 mt-4">
            <Link
              to="/trade/quotes"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-foreground text-background rounded-md font-body text-xs uppercase tracking-wider hover:bg-foreground/90 transition-colors"
            >
              Open Quote Builder
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default QuoteDrawer;
