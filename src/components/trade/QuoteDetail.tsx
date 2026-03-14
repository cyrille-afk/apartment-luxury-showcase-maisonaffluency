import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Trash2, Plus, Minus, Package, Printer } from "lucide-react";
import { cloudinaryUrl } from "@/lib/cloudinary";

const quoteLogo = cloudinaryUrl("affluency-footer-logo_gvpt4u", { width: 400, quality: "auto", crop: "fill" });

interface QuoteItemWithProduct {
  id: string;
  quote_id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number | null;
  notes: string | null;
  trade_products: {
    product_name: string;
    brand_name: string;
    trade_price_cents: number | null;
    currency: string;
    image_url: string | null;
    dimensions: string | null;
    materials: string | null;
    lead_time: string | null;
    sku: string | null;
  } | null;
}

interface QuoteDetailProps {
  quoteId: string;
  quoteStatus: string;
  quoteCreatedAt: string;
  quoteNotes: string | null;
  onBack: () => void;
  onStatusChange: () => void;
}

const formatPrice = (cents: number | null, currency = "SGD") => {
  if (!cents) return "Price on request";
  return new Intl.NumberFormat("en-SG", { style: "currency", currency }).format(cents / 100);
};

const formatPriceRaw = (cents: number | null, currency = "SGD") => {
  if (!cents) return null;
  return new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

const QuoteDetail = ({ quoteId, quoteStatus, quoteCreatedAt, quoteNotes, onBack, onStatusChange }: QuoteDetailProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<QuoteItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState(quoteNotes || "");

  const quoteNumber = `QU-${quoteId.slice(0, 6).toUpperCase()}`;
  const isDraft = quoteStatus === "draft";

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("trade_quote_items")
      .select("*, trade_products(product_name, brand_name, trade_price_cents, currency, image_url, dimensions, materials, lead_time, sku)")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: true });
    setItems((data as QuoteItemWithProduct[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [quoteId]);

  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    await supabase.from("trade_quote_items").update({ quantity: newQty }).eq("id", itemId);
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity: newQty } : i)));
  };

  const handleRemoveItem = async (itemId: string) => {
    await supabase.from("trade_quote_items").delete().eq("id", itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast({ title: "Item removed" });
  };

  const handleSubmit = async () => {
    // Save notes first
    await supabase.from("trade_quotes").update({
      notes: notes || null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }).eq("id", quoteId);
    toast({ title: "Quote submitted", description: "Our team will review and respond within 1-2 business days." });
    onStatusChange();
  };

  const handleSaveNotes = async () => {
    await supabase.from("trade_quotes").update({ notes: notes || null }).eq("id", quoteId);
    toast({ title: "Notes saved" });
  };

  const handleDelete = async () => {
    await supabase.from("trade_quotes").delete().eq("id", quoteId);
    toast({ title: "Quote deleted" });
    onStatusChange();
  };

  // Calculate totals
  const currency = items[0]?.trade_products?.currency || "SGD";
  const subtotalCents = items.reduce((sum, item) => {
    const price = item.unit_price_cents ?? item.trade_products?.trade_price_cents ?? 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <div className="max-w-4xl">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Quotes
      </button>

      {/* Quote document */}
      <div className="border border-border rounded-lg bg-background">
        {/* Header */}
        <div className="border-b border-border p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div>
              <img src={quoteLogo} alt="Affluency" className="h-8 md:h-10 w-auto mb-3" />
              <h1 className="font-display text-xl md:text-2xl text-foreground tracking-wide uppercase mb-1">
                Quote
              </h1>
              <p className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">
                Affluency Etc Pte. Ltd.
              </p>
              <p className="font-body text-[10px] text-muted-foreground mt-1">
                1 Grange Garden, Singapore 249631
              </p>
            </div>
            <div className="text-right">
              <p className="font-body text-xs text-muted-foreground">
                Date: {new Date(quoteCreatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <p className="font-display text-sm text-foreground mt-1">{quoteNumber}</p>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider ${
                quoteStatus === "submitted" ? "bg-primary/10 text-primary" :
                quoteStatus === "reviewed" ? "bg-emerald-500/10 text-emerald-600" :
                "bg-muted text-muted-foreground"
              }`}>
                {quoteStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="p-6 md:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center">
              <Package className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-body text-sm text-muted-foreground mb-1">No items in this quote</p>
              <p className="font-body text-[10px] text-muted-foreground">
                Add products from the Trade Gallery to build your quote.
              </p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_80px_100px_100px] gap-4 pb-3 border-b border-border mb-0">
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">Description</span>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest text-center">Qty</span>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest text-right">Unit Price</span>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest text-right">Amount {currency}</span>
              </div>

              {/* Items */}
              <div className="divide-y divide-border">
                {items.map((item) => {
                  const product = item.trade_products;
                  const unitPrice = item.unit_price_cents ?? product?.trade_price_cents ?? null;
                  const lineTotal = unitPrice ? unitPrice * item.quantity : null;

                  return (
                    <div key={item.id} className="py-4 md:grid md:grid-cols-[1fr_80px_100px_100px] md:gap-4 md:items-start">
                      {/* Description + Image */}
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded bg-muted/30 overflow-hidden shrink-0">
                          {product?.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.product_name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-display text-sm text-foreground leading-tight">
                            {product?.product_name || "Unknown Product"}
                          </h4>
                          <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                            {product?.brand_name}
                          </p>
                          {product?.dimensions && (
                            <p className="font-body text-[11px] text-muted-foreground mt-1">
                              Dimensions: {product.dimensions}
                            </p>
                          )}
                          {product?.materials && (
                            <p className="font-body text-[11px] text-muted-foreground">
                              Materials: {product.materials}
                            </p>
                          )}
                          {product?.lead_time && (
                            <p className="font-body text-[11px] text-muted-foreground">
                              Lead time: {product.lead_time}
                            </p>
                          )}
                          {item.notes && (
                            <p className="font-body text-[11px] text-muted-foreground/70 italic mt-1">
                              {item.notes}
                            </p>
                          )}
                          {isDraft && (
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="inline-flex items-center gap-1 font-body text-[10px] text-destructive hover:text-destructive/80 mt-2 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center justify-center gap-1 mt-3 md:mt-0">
                        {isDraft ? (
                          <>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="font-body text-sm text-foreground w-8 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <span className="font-body text-sm text-foreground">{item.quantity}</span>
                        )}
                      </div>

                      {/* Unit price */}
                      <div className="text-right mt-2 md:mt-0">
                        <span className="font-body text-sm text-foreground">
                          {formatPriceRaw(unitPrice, currency) || "TBD"}
                        </span>
                      </div>

                      {/* Amount */}
                      <div className="text-right mt-1 md:mt-0">
                        <span className="font-body text-sm text-foreground font-medium">
                          {formatPriceRaw(lineTotal, currency) || "TBD"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="border-t border-border mt-2 pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-1">
                    <div className="flex justify-between font-body text-xs text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatPriceRaw(subtotalCents, currency) || "TBD"}</span>
                    </div>
                    <div className="flex justify-between font-display text-sm text-foreground pt-2 border-t border-border">
                      <span className="uppercase tracking-wider">Total {currency}</span>
                      <span className="font-medium">{formatPriceRaw(subtotalCents, currency) || "TBD"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Notes */}
        <div className="border-t border-border p-6 md:p-8">
          <label className="font-body text-[10px] text-muted-foreground uppercase tracking-widest block mb-2">
            Notes / Special Instructions
          </label>
          {isDraft ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any special requirements, delivery instructions, or project details…"
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none transition-colors"
              />
              <button
                onClick={handleSaveNotes}
                className="font-body text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors"
              >
                Save Notes
              </button>
            </div>
          ) : (
            <p className="font-body text-sm text-muted-foreground italic">
              {notes || "No notes"}
            </p>
          )}
        </div>

        {/* Actions */}
        {isDraft && (
          <div className="border-t border-border p-6 md:p-8 flex items-center justify-between">
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 font-body text-[10px] text-destructive hover:text-destructive/80 uppercase tracking-wider transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Quote
            </button>
            <button
              onClick={handleSubmit}
              disabled={items.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              Submit Quote
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteDetail;
