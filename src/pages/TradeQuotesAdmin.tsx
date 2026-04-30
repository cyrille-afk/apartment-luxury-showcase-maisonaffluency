import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Clock, Send, CheckCircle, DollarSign, ChevronRight, ArrowLeft, Save, CreditCard, Trash2 } from "lucide-react";
import { QuoteCardSkeleton, QuoteItemSkeleton } from "@/components/trade/skeletons";
import SectionHero from "@/components/trade/SectionHero";

interface AdminQuote {
  id: string;
  user_id: string;
  status: string;
  notes: string | null;
  admin_notes: string | null;
  client_name: string | null;
  currency: string;
  submitted_at: string | null;
  responded_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { first_name: string; last_name: string; email: string; company: string } | null;
  item_count?: number;
}

interface AdminQuoteItem {
  id: string;
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
  } | null;
}

interface LeadTimeInfo {
  lead_weeks_min: number | null;
  lead_weeks_max: number | null;
  stock_status: string | null;
  source: string | null;
}

interface CatalogPriceInfo {
  cents: number;
  currency: string;
  /** "exact" when matched on product_id, "fuzzy" when matched on a different priced product. */
  match: "exact" | "fuzzy";
  matched_name?: string;
}

const formatLeadTime = (info?: LeadTimeInfo) => {
  if (!info) return null;
  const { lead_weeks_min, lead_weeks_max, stock_status } = info;
  if (lead_weeks_min && lead_weeks_max) {
    const range = lead_weeks_min === lead_weeks_max ? `${lead_weeks_min}` : `${lead_weeks_min}–${lead_weeks_max}`;
    return `Lead time: ${range} weeks`;
  }
  if (lead_weeks_min) return `Lead time: ~${lead_weeks_min} weeks`;
  if (stock_status === "in_stock") return "In stock";
  return "Made to order — lead time TBC";
};

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  draft: { label: "Draft", icon: Clock, className: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", icon: Send, className: "bg-primary/10 text-primary" },
  priced: { label: "Priced", icon: DollarSign, className: "bg-amber-500/10 text-amber-600" },
  confirmed: { label: "Confirmed", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600" },
  deposit_paid: { label: "Deposit Paid", icon: CreditCard, className: "bg-emerald-500/10 text-emerald-600" },
  paid: { label: "Fully Paid", icon: CreditCard, className: "bg-emerald-500/10 text-emerald-600" },
};

const currencySymbol = (c: string) => {
  const map: Record<string, string> = { SGD: "S$", USD: "US$", EUR: "€", GBP: "£" };
  return map[c] || c;
};

const formatPrice = (cents: number | null, currency: string = "SGD") => {
  if (!cents) return "—";
  return `${currencySymbol(currency)} ${(cents / 100).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const TradeQuotesAdmin = () => {
  const { isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"submitted" | "priced" | "confirmed" | "paid" | "all">("all");
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetchQuotes();
  }, [isAdmin, filter]);

  const fetchQuotes = async () => {
    setLoading(true);
    let query = supabase.from("trade_quotes").select("*").order("updated_at", { ascending: false });
    if (filter !== "all") {
      query = query.eq("status", filter);
    } else {
      query = query.neq("status", "draft");
    }
    const { data } = await query;
    const allQuotes = (data as any[]) || [];

    // Fetch profiles
    const userIds = [...new Set(allQuotes.map((q) => q.user_id))];
    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email, company").in("id", userIds);
      if (profiles) profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
    }

    // Fetch item counts
    const quoteIds = allQuotes.map((q) => q.id);
    let itemCounts: Record<string, number> = {};
    if (quoteIds.length > 0) {
      const { data: items } = await supabase.from("trade_quote_items").select("quote_id").in("quote_id", quoteIds);
      (items || []).forEach((item: any) => { itemCounts[item.quote_id] = (itemCounts[item.quote_id] || 0) + 1; });
    }

    setQuotes(allQuotes.map((q) => ({ ...q, profiles: profileMap[q.user_id] || null, item_count: itemCounts[q.id] || 0 })));
    setLoading(false);
  };

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  if (selectedQuoteId) {
    return <AdminQuoteDetail quoteId={selectedQuoteId} onBack={() => { setSelectedQuoteId(null); fetchQuotes(); }} />;
  }

  return (
    <>
      <Helmet><title>Manage Quotes — Trade Portal — Maison Affluency</title></Helmet>
      <div className="max-w-5xl">
        <SectionHero section="quotes-admin" title="Quote Management" subtitle="Review submitted quotes and set final pricing." />

        <div className="flex gap-2 mb-6 flex-wrap">
          {(["submitted", "priced", "confirmed", "paid", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full font-body text-xs uppercase tracking-[0.1em] border transition-colors ${
                filter === f
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <QuoteCardSkeleton key={i} />)}</div>
        ) : quotes.length === 0 ? (
          <p className="font-body text-sm text-muted-foreground py-8 text-center">No {filter} quotes.</p>
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
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="font-display text-sm text-foreground">QU-{quote.id.slice(0, 6).toUpperCase()}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider ${config.className}`}>
                          <StatusIcon className="h-3 w-3" />{config.label}
                        </span>
                        {quote.item_count && quote.item_count > 0 && (
                          <span className="font-body text-[10px] text-muted-foreground">{quote.item_count} items</span>
                        )}
                        <span className="font-body text-[10px] text-muted-foreground">{quote.currency}</span>
                      </div>
                      {quote.profiles && (
                        <p className="font-body text-xs text-muted-foreground">
                          {quote.profiles.first_name} {quote.profiles.last_name}
                          {quote.profiles.company && ` · ${quote.profiles.company}`}
                          {` · `}<a href={`mailto:${quote.profiles.email}`} className="text-foreground hover:underline">{quote.profiles.email}</a>
                        </p>
                      )}
                      {quote.client_name && (
                        <p className="font-body text-[10px] text-muted-foreground mt-0.5">Project: {quote.client_name}</p>
                      )}
                      <p className="font-body text-[10px] text-muted-foreground/60 mt-1">
                        {quote.submitted_at && `Submitted ${new Date(quote.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                        {quote.responded_at && ` · Priced ${new Date(quote.responded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                        {quote.confirmed_at && ` · Confirmed ${new Date(quote.confirmed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

/** Admin detail view — set item prices, add notes, send pricing */
const AdminQuoteDetail = ({ quoteId, onBack }: { quoteId: string; onBack: () => void }) => {
  const { toast } = useToast();
  const [items, setItems] = useState<AdminQuoteItem[]>([]);
  const [quote, setQuote] = useState<AdminQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState("");
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [catalogPrices, setCatalogPrices] = useState<Record<string, CatalogPriceInfo>>({});
  const [leadTimes, setLeadTimes] = useState<Record<string, LeadTimeInfo>>({});
  /** Trade discount % to apply on the client side (e.g. 0.08 for silver). */
  const [ownerDiscountPct, setOwnerDiscountPct] = useState<number>(0);
  const [ownerTierLabel, setOwnerTierLabel] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [itemsRes, quoteRes] = await Promise.all([
        supabase
          .from("trade_quote_items")
          .select("*, trade_products(product_name, brand_name, trade_price_cents, currency, image_url, dimensions, materials)")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: true }),
        supabase.from("trade_quotes").select("*").eq("id", quoteId).single(),
      ]);
      const fetchedItems = (itemsRes.data as AdminQuoteItem[]) || [];
      setItems(fetchedItems);
      const q = quoteRes.data as AdminQuote | null;
      setQuote(q);
      setAdminNotes(q?.admin_notes || "");

      const quoteCurrency = (quoteRes.data as any)?.currency || "SGD";

      // Fuzzy matching helpers (singularized token matching + brand boost)
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      const singularize = (t: string) => (t.endsWith("s") && t.length > 3 ? t.slice(0, -1) : t);
      const tokenize = (s: string) =>
        normalize(s)
          .split(" ")
          .map(singularize)
          .filter((t) => t.length > 1);

      // For items missing direct catalog price, try fuzzy-match against priced trade_products
      const needsCatalogResolution = fetchedItems.filter((i) => i.trade_products && i.trade_products.trade_price_cents == null);
      let pricedCatalog: Array<{ product_name: string; brand_name: string; trade_price_cents: number; currency: string }> = [];

      if (needsCatalogResolution.length > 0) {
        const { data: allPriced } = await supabase
          .from("trade_products")
          .select("product_name, brand_name, trade_price_cents, currency")
          .not("trade_price_cents", "is", null)
          .eq("is_active", true);
        pricedCatalog = (allPriced || []) as any;
      }

      const findFuzzyPrice = (name: string, brandName?: string | null) => {
        const norm = normalize(name);
        const tokens = tokenize(name);
        const normalizedBrand = normalize(brandName || "");

        let best: (typeof pricedCatalog)[0] | null = null;
        let bestScore = 0;

        for (const entry of pricedCatalog) {
          const candidateName = normalize(entry.product_name);
          if (candidateName === norm) return entry;

          const candidateTokens = tokenize(entry.product_name);
          const overlap = tokens.filter((t) => candidateTokens.includes(t)).length;
          const tokenScore = overlap > 0 ? overlap / Math.max(candidateTokens.length, tokens.length) : 0;

          const candidateBrand = normalize(entry.brand_name || "");
          const brandScore =
            normalizedBrand && candidateBrand
              ? candidateBrand === normalizedBrand
                ? 0.25
                : candidateBrand.includes(normalizedBrand) || normalizedBrand.includes(candidateBrand)
                  ? 0.15
                  : 0
              : 0;

          const containsScore =
            candidateName.includes(norm) || norm.includes(candidateName)
              ? 0.95
              : 0;

          const score = Math.max(containsScore, tokenScore + brandScore);
          const isStrongTokenMatch = overlap >= 2 || tokenScore >= 0.55;

          if ((containsScore > 0 || isStrongTokenMatch) && score > bestScore) {
            best = entry;
            bestScore = score;
          }
        }

        return best;
      };

      // Build a resolved price map: item.id → CatalogPriceInfo
      const resolvedPrices: Record<string, CatalogPriceInfo> = {};
      fetchedItems.forEach((item) => {
        if (item.trade_products?.trade_price_cents != null) {
          resolvedPrices[item.id] = {
            cents: item.trade_products.trade_price_cents,
            currency: item.trade_products.currency || "SGD",
            match: "exact",
          };
        } else {
          const match = findFuzzyPrice(item.trade_products?.product_name || "", item.trade_products?.brand_name);
          if (match) {
            resolvedPrices[item.id] = {
              cents: match.trade_price_cents,
              currency: match.currency,
              match: "fuzzy",
              matched_name: match.product_name,
            };
          }
        }
      });

      // Collect unique source currencies that differ from quote currency
      const sourceCurrencies = new Set<string>();
      Object.values(resolvedPrices).forEach(({ currency: c }) => {
        if (c !== quoteCurrency) sourceCurrencies.add(c);
      });

      // Fetch exchange rates if needed
      const fxRates: Record<string, number> = {};
      if (sourceCurrencies.size > 0) {
        await Promise.all(
          Array.from(sourceCurrencies).map(async (src) => {
            try {
              const res = await fetch(`https://api.frankfurter.app/latest?from=${src}&to=${quoteCurrency}`);
              const data = await res.json();
              if (data.rates?.[quoteCurrency]) {
                fxRates[`${src}_${quoteCurrency}`] = data.rates[quoteCurrency];
              }
            } catch {
              // silently fail
            }
          })
        );
      }

      // Init price inputs: existing unit_price_cents, or resolved catalog price (converted if needed)
      const prices: Record<string, string> = {};
      fetchedItems.forEach((item) => {
        if (item.unit_price_cents) {
          prices[item.id] = (item.unit_price_cents / 100).toFixed(2);
        } else {
          const resolved = resolvedPrices[item.id];
          if (resolved) {
            if (resolved.currency === quoteCurrency) {
              prices[item.id] = (resolved.cents / 100).toFixed(2);
            } else {
              const rate = fxRates[`${resolved.currency}_${quoteCurrency}`];
              if (rate) {
                prices[item.id] = (Math.round(resolved.cents * rate) / 100).toFixed(2);
              } else {
                prices[item.id] = "";
              }
            }
          } else {
            prices[item.id] = "";
          }
        }
      });
      setItemPrices(prices);
      setCatalogPrices(resolvedPrices);

      // Fetch lead time for each line item via the effective_product_availability function.
      const leadTimeMap: Record<string, LeadTimeInfo> = {};
      await Promise.all(
        fetchedItems.map(async (item) => {
          if (!item.product_id) return;
          try {
            const { data: lt } = await (supabase as any).rpc("effective_product_availability", { _product_id: item.product_id });
            if (lt && lt.length > 0) leadTimeMap[item.id] = lt[0] as LeadTimeInfo;
          } catch {
            /* ignore */
          }
        })
      );
      setLeadTimes(leadTimeMap);

      // Resolve the quote owner's trade discount tier (silver/gold/platinum → discount %).
      if (q?.user_id) {
        try {
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("trade_tier")
            .eq("id", q.user_id)
            .maybeSingle();
          const rawTier = (ownerProfile?.trade_tier as string | null) || "silver";
          const tier = (["silver", "gold", "platinum"] as const).includes(rawTier as any) ? (rawTier as "silver" | "gold" | "platinum") : "silver";
          const { data: cfg } = await (supabase as any)
            .from("trade_tier_config")
            .select("tier, discount_pct, label")
            .eq("tier", tier)
            .maybeSingle();
          const fallback: Record<string, { pct: number; label: string }> = {
            silver: { pct: 0.08, label: "Silver" },
            gold: { pct: 0.10, label: "Gold" },
            platinum: { pct: 0.15, label: "Platinum" },
          };
          setOwnerDiscountPct(cfg?.discount_pct != null ? Number(cfg.discount_pct) : fallback[tier].pct);
          setOwnerTierLabel(cfg?.label || fallback[tier].label);
        } catch {
          setOwnerDiscountPct(0.08);
          setOwnerTierLabel("Silver");
        }
      }

      setLoading(false);
    };
    load();
  }, [quoteId]);

  const currency = quote?.currency || "SGD";

  const handleSendPricing = async () => {
    setSaving(true);
    // Update each item's unit_price_cents
    for (const item of items) {
      const priceStr = itemPrices[item.id];
      const cents = priceStr ? Math.round(parseFloat(priceStr) * 100) : null;
      if (cents !== item.unit_price_cents) {
        await supabase.from("trade_quote_items").update({ unit_price_cents: cents }).eq("id", item.id);
      }
    }
    // Update quote status and admin notes
    await supabase.from("trade_quotes").update({
      status: "priced",
      admin_notes: adminNotes || null,
      responded_at: new Date().toISOString(),
    } as any).eq("id", quoteId);

    toast({ title: "Pricing sent", description: "The user can now review and confirm." });
    setSaving(false);
    onBack();
  };

  const handleSaveNotes = async () => {
    await supabase.from("trade_quotes").update({ admin_notes: adminNotes || null } as any).eq("id", quoteId);
    toast({ title: "Notes saved" });
  };

  const handleDeleteQuote = async () => {
    // Delete items first, then the quote
    await supabase.from("trade_quote_items").delete().eq("quote_id", quoteId);
    await supabase.from("trade_quotes").delete().eq("id", quoteId);
    toast({ title: "Quote deleted" });
    onBack();
  };

  const subtotalCents = items.reduce((sum, item) => {
    const priceStr = itemPrices[item.id];
    const cents = priceStr ? Math.round(parseFloat(priceStr) * 100) : 0;
    return sum + cents * item.quantity;
  }, 0);

  const canSendPricing = quote?.status === "submitted" || quote?.status === "priced";

  return (
    <div className="max-w-4xl">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> All Quotes
      </button>

      <div className="border border-border rounded-lg bg-background">
        {/* Header */}
        <div className="border-b border-border p-4 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl text-foreground">QU-{quoteId.slice(0, 6).toUpperCase()}</h2>
              {quote?.client_name && <p className="font-display text-sm text-muted-foreground uppercase tracking-wider mt-1">{quote.client_name}</p>}
              <p className="font-body text-xs text-muted-foreground mt-1">
                Currency: {currencySymbol(currency)} {currency}
                {quote?.notes && <> · User notes: <span className="italic">"{quote.notes}"</span></>}
              </p>
            </div>
            {quote && (() => {
              const config = statusConfig[quote.status] || statusConfig.draft;
              const StatusIcon = config.icon;
              return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider ${config.className}`}>
                  <StatusIcon className="h-3 w-3" />{config.label}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Items with editable pricing */}
        <div className="p-4 md:p-6">
          {loading ? (
            <div className="divide-y divide-border">{Array.from({ length: 3 }).map((_, i) => <QuoteItemSkeleton key={i} />)}</div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[1fr_80px_120px_100px] gap-4 pb-3 border-b border-border">
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">Item</span>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest text-center">Qty</span>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest text-right">Unit Price</span>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest text-right">Amount</span>
              </div>

              <div className="divide-y divide-border">
                {items.map((item) => {
                  const product = item.trade_products;
                  const priceStr = itemPrices[item.id] || "";
                  const cents = priceStr ? Math.round(parseFloat(priceStr) * 100) : 0;
                  const lineTotal = cents * item.quantity;

                  return (
                    <div key={item.id} className="py-3 md:py-4 md:grid md:grid-cols-[1fr_80px_120px_100px] md:gap-4 md:items-center">
                      <div className="flex gap-3">
                        <div className="w-12 h-12 rounded bg-muted/30 overflow-hidden shrink-0">
                          {product?.image_url ? (
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-muted/20" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-display text-xs text-foreground leading-tight">{product?.product_name || "Unknown"}</h4>
                          <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">{product?.brand_name?.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product?.brand_name}</p>
                          {product?.dimensions && <p className="font-body text-[10px] text-muted-foreground">{product.dimensions}</p>}
                          {catalogPrices[item.id] && (
                            <p className="font-body text-[10px] text-muted-foreground/60">
                              Catalog: {formatPrice(catalogPrices[item.id].cents, catalogPrices[item.id].currency)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="hidden md:flex justify-center">
                        <span className="font-body text-sm text-foreground">{item.quantity}</span>
                      </div>
                      <div className="hidden md:block">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">{currencySymbol(currency)}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={priceStr}
                            onChange={(e) => setItemPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="0.00"
                            className="w-full pl-8 pr-2 py-1.5 border border-border rounded-md font-body text-sm text-foreground text-right bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        {catalogPrices[item.id] && catalogPrices[item.id].currency !== currency && (
                          <p className="font-body text-[9px] text-muted-foreground/50 text-right mt-0.5 italic">
                            {formatPrice(catalogPrices[item.id].cents, catalogPrices[item.id].currency)} catalog
                          </p>
                        )}
                      </div>
                      <div className="hidden md:block text-right">
                        <span className="font-body text-sm text-foreground font-medium">
                          {lineTotal > 0 ? formatPrice(lineTotal, currency) : "—"}
                        </span>
                      </div>
                      {/* Mobile layout */}
                      <div className="flex items-center justify-between mt-2 md:hidden gap-2">
                        <span className="font-body text-xs text-muted-foreground">Qty: {item.quantity}</span>
                        <div className="relative flex-1 max-w-[140px]">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">{currencySymbol(currency)}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={priceStr}
                            onChange={(e) => setItemPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="0.00"
                            className="w-full pl-8 pr-2 py-1.5 border border-border rounded-md font-body text-sm text-foreground text-right bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 text-[16px]"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Subtotal */}
              <div className="border-t border-border mt-2 pt-4 flex justify-end">
                <div className="w-64 space-y-1">
                  <div className="flex justify-between font-body text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{subtotalCents > 0 ? formatPrice(subtotalCents, currency) : "—"}</span>
                  </div>
                  {currency === "SGD" && subtotalCents > 0 && (
                    <div className="flex justify-between font-body text-xs text-muted-foreground">
                      <span>GST (9%)</span>
                      <span>{formatPrice(Math.round(subtotalCents * 0.09), currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-display text-sm text-foreground pt-2 border-t border-border">
                    <span className="uppercase tracking-wider">Total {currency}</span>
                    <span className="font-medium">
                      {subtotalCents > 0
                        ? formatPrice(currency === "SGD" ? subtotalCents + Math.round(subtotalCents * 0.09) : subtotalCents, currency)
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Admin notes */}
        <div className="border-t border-border p-4 md:p-6">
          <label className="font-body text-[10px] text-muted-foreground uppercase tracking-widest block mb-2">Admin Notes (visible to client)</label>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Add pricing notes, lead times, special conditions…"
            rows={3}
            className="w-full px-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none text-[16px] sm:text-sm"
          />
          <button onClick={handleSaveNotes} className="mt-1 font-body text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors">
            Save Notes
          </button>
        </div>

        {/* Action */}
        {canSendPricing && (
          <div className="border-t border-border p-4 md:p-6 flex justify-end">
            <button
              onClick={handleSendPricing}
              disabled={saving || subtotalCents === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              {saving ? "Sending…" : quote?.status === "priced" ? "Update Pricing" : "Send Pricing"}
            </button>
          </div>
        )}

        {/* Delete quote */}
        <div className="border-t border-border p-4 md:p-6 flex items-center justify-between">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 font-body text-[10px] text-destructive hover:text-destructive/80 uppercase tracking-wider transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Quote
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-body text-xs text-destructive">Delete this quote permanently?</span>
              <button
                onClick={handleDeleteQuote}
                className="px-3 py-1.5 bg-destructive text-destructive-foreground font-body text-xs uppercase tracking-wider rounded-md hover:bg-destructive/90 transition-colors"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 border border-border font-body text-xs uppercase tracking-wider rounded-md hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradeQuotesAdmin;
