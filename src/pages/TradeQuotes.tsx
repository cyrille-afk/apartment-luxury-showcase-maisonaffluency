import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import { useDesignerDisplayName } from "@/hooks/useDesignerDisplayName";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Clock, CheckCircle, Send, Trash2, ShoppingCart, ChevronRight, CreditCard, Users, XCircle, FolderOpen } from "lucide-react";
import { QuoteCardSkeleton } from "@/components/trade/skeletons";
import QuoteDetail from "@/components/trade/QuoteDetail";
import SectionHero from "@/components/trade/SectionHero";
import ActiveFilterChips from "@/components/trade/ActiveFilterChips";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";

interface Quote {
  id: string;
  user_id: string;
  status: string;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
  project_id?: string | null;
  project_name?: string | null;
  profiles?: { first_name: string; last_name: string; company: string; email: string } | null;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  draft: { label: "Draft", icon: FileText, className: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", icon: Send, className: "bg-primary/10 text-primary" },
  priced: { label: "Priced — Review", icon: Clock, className: "bg-amber-500/10 text-amber-600" },
  confirmed: { label: "Order Confirmed", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600" },
  deposit_paid: { label: "Deposit Paid", icon: CreditCard, className: "bg-emerald-500/10 text-emerald-600" },
  paid: { label: "Fully Paid", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "bg-destructive/10 text-destructive" },
};

const TradeQuotes = () => {
  const { user, isSuperAdmin } = useAuth();
  const { currentStudio, canEdit } = useStudio();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    projectFilter,
    designerFilter,
    clearDesignerFilter,
    clearAllFilters,
  } = useProjectFilter();
  const designerLabel = useDesignerDisplayName(designerFilter);
  const [projectFilterName, setProjectFilterName] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [matchingQuoteIds, setMatchingQuoteIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchQuotes = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("trade_quotes")
      .select("*")
      .order("created_at", { ascending: false });
    
    // Super admins can toggle between studio quotes and all quotes.
    // Otherwise scope to current studio so all teammates see each other's work.
    // RLS enforces actual visibility based on role + per-project overrides.
    if (!showAll || !isSuperAdmin) {
      if (currentStudio) {
        query = query.eq("studio_id", currentStudio.id);
      } else {
        query = query.eq("user_id", user.id);
      }
    }

    if (projectFilter) {
      query = query.eq("project_id", projectFilter);
    }

    const { data: quotesData } = await query;

    // Fetch profiles for super admin view
    let profileMap: Record<string, any> = {};
    if (showAll && isSuperAdmin && quotesData && quotesData.length > 0) {
      const userIds = [...new Set(quotesData.map((q: any) => q.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company, email")
        .in("id", userIds);
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
    }

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

    // Fetch project names for assigned projects
    const projectIds = [...new Set(((quotesData || []) as any[]).map((q) => q.project_id).filter(Boolean))] as string[];
    let projectMap: Record<string, string> = {};
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from("projects" as any)
        .select("id, name")
        .in("id", projectIds);
      (projects || []).forEach((p: any) => { projectMap[p.id] = p.name; });
    }

    setQuotes(
      (quotesData || []).map((q: any) => ({
        ...q,
        item_count: itemCounts[q.id] || 0,
        profiles: profileMap[q.user_id] || null,
        project_name: q.project_id ? projectMap[q.project_id] || null : null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
  }, [user, showAll, projectFilter, currentStudio?.id]);

  useEffect(() => {
    if (!projectFilter) { setProjectFilterName(null); return; }
    (async () => {
      const { data } = await supabase.from("projects" as any).select("name").eq("id", projectFilter).maybeSingle();
      setProjectFilterName((data as any)?.name || null);
    })();
  }, [projectFilter]);

  // Resolve which quotes contain the selected designer/brand
  useEffect(() => {
    if (!designerFilter) { setMatchingQuoteIds(null); return; }
    (async () => {
      const { data } = await supabase
        .from("trade_quote_items")
        .select("quote_id, trade_products!inner(brand_name)")
        .eq("trade_products.brand_name", designerFilter);
      setMatchingQuoteIds(new Set(((data as any[]) || []).map((r) => r.quote_id)));
    })();
  }, [designerFilter]);

  // Deep-link: open a specific quote when ?quote=<id> is in the URL
  useEffect(() => {
    const q = searchParams.get("quote");
    if (q && q !== selectedQuoteId) setSelectedQuoteId(q);
  }, [searchParams]);

  const handleCreateQuote = async () => {
    if (!user) return;
    if (currentStudio && !canEdit) {
      toast({ title: "Read-only role", description: "Your role in this studio doesn't allow creating quotes.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("trade_quotes")
      .insert({ user_id: user.id, studio_id: currentStudio?.id ?? null, status: "draft" } as any)
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
          if (searchParams.get("quote")) {
            searchParams.delete("quote");
            setSearchParams(searchParams, { replace: true });
          }
          fetchQuotes();
        }}
        onStatusChange={() => {
          setSelectedQuoteId(null);
          if (searchParams.get("quote")) {
            searchParams.delete("quote");
            setSearchParams(searchParams, { replace: true });
          }
          fetchQuotes();
        }}
      />
    );
  }

  return (
    <>
      <Helmet><title>Quotes — Trade Portal — Maison Affluency</title></Helmet>
    <div className="max-w-4xl">
      <SectionHero
        section="quotes"
        title="Quote Builder"
        subtitle="Create and manage product quotes for your projects."
      >
        {isSuperAdmin && (
          <button
            onClick={() => setShowAll(!showAll)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 font-body text-xs uppercase tracking-[0.1em] rounded-md transition-colors ${
              showAll ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            {showAll ? "All Quotes" : "My Quotes"}
          </button>
        )}
        <button
          onClick={handleCreateQuote}
          disabled={creating}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-background text-foreground font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-background/90 transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          New Quote
        </button>
      </SectionHero>

      <TradeBreadcrumb current="Quotes" />
      <ActiveFilterChips className="mb-4" confirmClearAll />

      {(() => {
        const visibleQuotes = designerFilter && matchingQuoteIds
          ? quotes.filter((q) => matchingQuoteIds.has(q.id))
          : quotes;
        return loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <QuoteCardSkeleton key={i} />)}
        </div>
      ) : visibleQuotes.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <ShoppingCart className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-body text-sm text-muted-foreground mb-4">
            {designerFilter
              ? `No quotes contain ${designerLabel}.`
              : "No quotes yet. Create your first quote to start building a product selection."}
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
          {visibleQuotes.map((quote) => {
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
                      {quote.project_name && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); navigate(`/trade/projects/${quote.project_id}`); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate(`/trade/projects/${quote.project_id}`);
                            }
                          }}
                          className="inline-flex items-center gap-1 font-body text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        >
                          <FolderOpen className="h-3 w-3" />
                          {quote.project_name}
                        </span>
                      )}
                    </div>
                    <p className="font-body text-[10px] text-muted-foreground">
                      {showAll && quote.profiles && (
                        <span className="font-medium text-foreground mr-1">
                          {[quote.profiles.first_name, quote.profiles.last_name].filter(Boolean).join(" ") || quote.profiles.email}
                          {quote.profiles.company ? ` · ${quote.profiles.company}` : ""}
                          {" · "}
                        </span>
                      )}
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
      );
      })()}
    </div>
    </>
  );
};

export default TradeQuotes;
