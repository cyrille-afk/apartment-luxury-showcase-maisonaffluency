import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Clock, CheckCircle, Send, Trash2, ShoppingCart } from "lucide-react";

interface Quote {
  id: string;
  status: string;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  items?: QuoteItem[];
}

interface QuoteItem {
  id: string;
  quote_id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number | null;
  notes: string | null;
  product?: {
    product_name: string;
    brand_name: string;
    trade_price_cents: number | null;
    currency: string;
    image_url: string | null;
  };
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  draft: { label: "Draft", icon: FileText, className: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", icon: Send, className: "bg-primary/10 text-primary" },
  reviewed: { label: "Reviewed", icon: CheckCircle, className: "bg-success/10 text-success" },
};

const formatPrice = (cents: number | null, currency = "SGD") => {
  if (!cents) return "—";
  return new Intl.NumberFormat("en-SG", { style: "currency", currency }).format(cents / 100);
};

const TradeQuotes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchQuotes = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("trade_quotes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setQuotes((data as Quote[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
  }, [user]);

  const handleCreateQuote = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("trade_quotes")
      .insert({ user_id: user.id, status: "draft" })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "New quote created" });
      fetchQuotes();
    }
    setCreating(false);
  };

  const handleSubmitQuote = async (quoteId: string) => {
    const { error } = await supabase
      .from("trade_quotes")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", quoteId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Quote submitted", description: "Our team will review and respond within 1-2 business days." });
      fetchQuotes();
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    const { error } = await supabase.from("trade_quotes").delete().eq("id", quoteId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Quote deleted" });
      fetchQuotes();
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-foreground mb-1">Quote Builder</h1>
          <p className="font-body text-sm text-muted-foreground">
            Create and manage product quotes for your projects.
          </p>
        </div>
        <button
          onClick={handleCreateQuote}
          disabled={creating}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          New Quote
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : quotes.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <ShoppingCart className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-body text-sm text-muted-foreground mb-4">
            No quotes yet. Create your first quote to start building a product selection.
          </p>
          <button
            onClick={handleCreateQuote}
            disabled={creating}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-foreground text-foreground font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground hover:text-background transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create First Quote
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => {
            const config = statusConfig[quote.status] || statusConfig.draft;
            const StatusIcon = config.icon;

            return (
              <div key={quote.id} className="border border-border rounded-lg p-4 hover:border-foreground/20 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-display text-sm text-foreground">
                        Quote #{quote.id.slice(0, 8).toUpperCase()}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider ${config.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </div>
                    <p className="font-body text-[10px] text-muted-foreground">
                      Created {new Date(quote.created_at).toLocaleDateString()}
                      {quote.submitted_at && ` · Submitted ${new Date(quote.submitted_at).toLocaleDateString()}`}
                    </p>
                    {quote.notes && (
                      <p className="font-body text-xs text-muted-foreground mt-1 italic">"{quote.notes}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {quote.status === "draft" && (
                      <>
                        <button
                          onClick={() => handleSubmitQuote(quote.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-foreground text-foreground font-body text-[10px] uppercase tracking-wider rounded-md hover:bg-foreground hover:text-background transition-colors"
                        >
                          <Send className="h-3 w-3" />
                          Submit
                        </button>
                        <button
                          onClick={() => handleDeleteQuote(quote.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete quote"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TradeQuotes;
