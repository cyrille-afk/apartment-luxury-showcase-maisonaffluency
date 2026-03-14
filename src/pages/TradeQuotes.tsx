import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Clock, CheckCircle, Send, Trash2, ShoppingCart, ChevronRight } from "lucide-react";
import QuoteDetail from "@/components/trade/QuoteDetail";
import SectionHero from "@/components/trade/SectionHero";

interface Quote {
  id: string;
  status: string;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  draft: { label: "Draft", icon: FileText, className: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", icon: Send, className: "bg-primary/10 text-primary" },
  reviewed: { label: "Reviewed", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600" },
};

const TradeQuotes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const fetchQuotes = async () => {
    if (!user) return;
    setLoading(true);
    const { data: quotesData } = await supabase
      .from("trade_quotes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Get item counts
    const quoteIds = (quotesData || []).map((q: any) => q.id);
    let itemCounts: Record<string, number> = {};
    if (quoteIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("trade_quote_items")
        .select("quote_id")
        .in("quote_id", quoteIds);
      (itemsData || []).forEach((item: any) => {
        itemCounts[item.quote_id] = (itemCounts[item.quote_id] || 0) + 1;
      });
    }

    setQuotes(
      (quotesData || []).map((q: any) => ({ ...q, item_count: itemCounts[q.id] || 0 }))
    );
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
    } else if (data) {
      setSelectedQuoteId(data.id);
    }
    setCreating(false);
  };

  // Show detail view
  if (selectedQuoteId) {
    const quote = quotes.find((q) => q.id === selectedQuoteId);
    return (
      <QuoteDetail
        quoteId={selectedQuoteId}
        quoteStatus={quote?.status || "draft"}
        quoteCreatedAt={quote?.created_at || new Date().toISOString()}
        quoteNotes={quote?.notes || null}
        onBack={() => {
          setSelectedQuoteId(null);
          fetchQuotes();
        }}
        onStatusChange={() => {
          setSelectedQuoteId(null);
          fetchQuotes();
        }}
      />
    );
  }

  return (
    <div className="max-w-4xl">
      <SectionHero
        section="quotes"
        title="Quote Builder"
        subtitle="Create and manage product quotes for your projects."
      >
        <button
          onClick={handleCreateQuote}
          disabled={creating}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-background text-foreground font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-background/90 transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          New Quote
        </button>
      </SectionHero>

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
              <button
                key={quote.id}
                onClick={() => setSelectedQuoteId(quote.id)}
                className="w-full text-left border border-border rounded-lg p-4 hover:border-foreground/20 transition-colors group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-display text-sm text-foreground">
                        QU-{quote.id.slice(0, 6).toUpperCase()}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider ${config.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </span>
                      {quote.item_count > 0 && (
                        <span className="font-body text-[10px] text-muted-foreground">
                          {quote.item_count} {quote.item_count === 1 ? "item" : "items"}
                        </span>
                      )}
                    </div>
                    <p className="font-body text-[10px] text-muted-foreground">
                      Created {new Date(quote.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {quote.submitted_at && ` · Submitted ${new Date(quote.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                    </p>
                    {quote.notes && (
                      <p className="font-body text-xs text-muted-foreground mt-1 italic truncate">"{quote.notes}"</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TradeQuotes;
