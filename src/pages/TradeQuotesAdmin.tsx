import { useCallback, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { hydrateQuotePricesFromPicks } from "@/lib/hydrateQuotePricesFromPicks";
import { getFxRates, getFxSource, summarizeFxSources, type FxSource } from "@/lib/fxRates";
import { FxSourceBadge } from "@/components/trade/FxSourceBadge";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Clock, Send, CheckCircle, DollarSign, ChevronRight, ArrowLeft, Save, CreditCard, Trash2, Edit3, XCircle } from "lucide-react";
import { QuoteCardSkeleton, QuoteItemSkeleton } from "@/components/trade/skeletons";
import SectionHero from "@/components/trade/SectionHero";
import { UkLandedCostPanel } from "@/components/trade/UkLandedCostPanel";
import { QuoteDisplayCurrencyToggle } from "@/components/trade/QuoteDisplayCurrencyToggle";
import { DEFAULT_GBP_LANDED_CBM, GBP_LANDED_KG_PER_CBM, useGbpLandedCost, fmtGbp } from "@/hooks/useGbpLandedCost";
import { priceRugVariantFromLabel } from "@/lib/rugPricing";

interface AdminQuote {
  id: string;
  user_id: string;
  client_id?: string | null;
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
  landed_cost_cbm?: number | null;
  landed_cost_kg?: number | null;
  landed_cost_mode?: "road" | "courier" | null;
  profiles?: { first_name: string; last_name: string; email: string; company: string } | null;
  item_count?: number;
}

interface AdminQuoteItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number | null;
  notes: string | null;
  lead_time_weeks_override: number | null;
  variant_label?: string | null;
  trade_products: {
    product_name: string;
    brand_name: string;
    trade_price_cents: number | null;
    price_per_sqm_cents?: number | null;
    price_unit?: string | null;
    currency: string;
    image_url: string | null;
    dimensions: string | null;
    materials: string | null;
    source_pick_id?: string | null;
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

const catalogSourcePriceCents = (item: AdminQuoteItem) => {
  const product = item.trade_products;
  if (!product) return null;
  if (product.price_unit === "per_sqm" && product.price_per_sqm_cents) {
    return priceRugVariantFromLabel((item as any).variant_label || product.dimensions, product.price_per_sqm_cents);
  }
  return product.trade_price_cents;
};

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

const leadOverride = (value: number | null) => (value && value > 0 ? value : null);

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
  const [clientCountry, setClientCountry] = useState<string | null>(null);
  /** Display the totals block in the quote currency or in GBP DDP landed cost. */
  const [displayCcy, setDisplayCcy] = useState<"quote" | "gbp">("quote");
  const [fxSource, setFxSource] = useState<FxSource>("identity");
  const [landedCostSettings, setLandedCostSettings] = useState<{ cbm: number; kg: number; mode: "road" | "courier" }>(() => ({
    cbm: DEFAULT_GBP_LANDED_CBM,
    kg: Math.round(DEFAULT_GBP_LANDED_CBM * GBP_LANDED_KG_PER_CBM.road),
    mode: "road",
  }));

  // Recompute the FX source badge whenever the display currency toggle flips
  // (quote currency ↔ GBP DDP). Without this the badge kept showing the source
  // used for the quote-currency conversion even after the user switched to
  // GBP, making the indicator lie about which provider produced the visible
  // number.
  useEffect(() => {
    const quoteCcy = quote?.currency || "SGD";
    const targetCcy = displayCcy === "gbp" ? "GBP" : quoteCcy;
    const sources = new Set<string>();
    items.forEach((item) => {
      const src =
        item.unit_price_cents != null
          ? (item.unit_price_currency || quoteCcy)
          : (item.trade_products?.currency || quoteCcy);
      if (src && src !== targetCcy) sources.add(src);
    });
    if (displayCcy === "gbp" && quoteCcy !== "GBP") sources.add(quoteCcy);
    if (sources.size === 0) { setFxSource("identity"); return; }
    const pairs = Array.from(sources).map((src) => ({ src, tgt: targetCcy }));
    // Warm the cache, then read back the definitive source per pair.
    getFxRates(pairs).then(() => {
      setFxSource(summarizeFxSources(pairs.map((p) => getFxSource(p.src, p.tgt))));
    });
  }, [displayCcy, quote?.currency, items]);


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [itemsRes, quoteRes] = await Promise.all([
        supabase
          .from("trade_quote_items")
          .select("*, trade_products(product_name, brand_name, trade_price_cents, price_per_sqm_cents, price_unit, currency, image_url, dimensions, materials, source_pick_id)")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: true }),
        supabase.from("trade_quotes").select("*").eq("id", quoteId).single(),
      ]);
      let fetchedItems = (itemsRes.data as AdminQuoteItem[]) || [];
      // Fallback: prefer freshest price from designer_curator_picks when the
      // mirror row is missing/stale (pick is the source of truth).
      fetchedItems = await hydrateQuotePricesFromPicks(fetchedItems, "trade_products");
      setItems(fetchedItems);
      const q = quoteRes.data as AdminQuote | null;
      setQuote(q);
      setAdminNotes(q?.admin_notes || "");
      setDisplayCcy("quote");
      setClientCountry(null);
      const landedMode = q?.landed_cost_mode === "courier" ? "courier" : "road";
      const landedCbm = Number(q?.landed_cost_cbm ?? DEFAULT_GBP_LANDED_CBM);
      const landedKg = Number(q?.landed_cost_kg ?? Math.round(landedCbm * GBP_LANDED_KG_PER_CBM[landedMode]));
      setLandedCostSettings({ cbm: landedCbm, kg: landedKg, mode: landedMode });

      if (q?.client_id) {
        const { data: client } = await (supabase.from("clients" as any).select("billing_country").eq("id", q.client_id).maybeSingle() as any);
        setClientCountry((client?.billing_country as string) || null);
      }

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
        const catalogCents = catalogSourcePriceCents(item);
        if (catalogCents != null) {
          resolvedPrices[item.id] = {
            cents: catalogCents,
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

      // Resolve FX via the shared helper (frankfurter → open.er-api → hardcoded
      // fallback). Never leaves us with an empty rate table, so line prices
      // always convert instead of silently displaying the source-currency number.
      const fxPairs = Array.from(sourceCurrencies).map((src) => ({ src, tgt: quoteCurrency }));
      const fxRates = fxPairs.length > 0 ? await getFxRates(fxPairs) : {};
      setFxSource(
        fxPairs.length === 0
          ? "identity"
          : summarizeFxSources(fxPairs.map((p) => getFxSource(p.src, p.tgt))),
      );

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
      landed_cost_cbm: landedCostSettings.cbm,
      landed_cost_kg: landedCostSettings.kg,
      landed_cost_mode: landedCostSettings.mode,
    } as any).eq("id", quoteId);

    // Notify requesting user + admins (fire-and-forget)
    supabase.functions.invoke("send-quote-priced", {
      body: { quoteId },
    }).catch((err) => console.error("Quote priced email failed:", err));

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

  const appendAdminNote = (existing: string | null, label: string, reason: string) => {
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const entry = `[${stamp}] ${label}: ${reason}`;
    return existing ? `${existing}\n\n${entry}` : entry;
  };

  const handleRequestChanges = async () => {
    const reason = window.prompt("Reason for requesting changes (visible to client):");
    if (!reason || !reason.trim()) return;
    setSaving(true);
    const merged = appendAdminNote(adminNotes, "Changes requested", reason.trim());
    await supabase.from("trade_quotes").update({
      status: "draft",
      admin_notes: merged,
    } as any).eq("id", quoteId);
    toast({ title: "Reopened as draft", description: "Client can revise the quote." });
    setSaving(false);
    onBack();
  };

  const handleCancelQuote = async () => {
    const reason = window.prompt("Reason for cancelling this quote (visible to client):");
    if (!reason || !reason.trim()) return;
    if (!window.confirm("Cancel this quote? The client will be notified.")) return;
    setSaving(true);
    const merged = appendAdminNote(adminNotes, "Cancelled", reason.trim());
    await supabase.from("trade_quotes").update({
      status: "cancelled",
      admin_notes: merged,
    } as any).eq("id", quoteId);
    toast({ title: "Quote cancelled" });
    setSaving(false);
    onBack();
  };


  const subtotalCents = items.reduce((sum, item) => {
    const priceStr = itemPrices[item.id];
    const cents = priceStr ? Math.round(parseFloat(priceStr) * 100) : 0;
    return sum + cents * item.quantity;
  }, 0);

  const isUkDestination = (() => {
    const c = (clientCountry || "").trim().toLowerCase();
    return c === "uk" || c === "gb" || c === "united kingdom" || c === "great britain" || c === "england" || c === "scotland" || c === "wales" || c === "northern ireland";
  })();

  // GBP DDP landed-cost amounts for the totals toggle
  const goodsAfterDiscountCents =
    subtotalCents - (ownerDiscountPct > 0 ? Math.round(subtotalCents * ownerDiscountPct) : 0);
  const gbp = useGbpLandedCost({
    goodsAfterDiscountCents: isUkDestination ? goodsAfterDiscountCents : 0,
    quoteCurrency: currency,
    cbm: landedCostSettings.cbm,
    kg: landedCostSettings.kg,
    mode: landedCostSettings.mode,
  });

  const handleLandedCostSettingsChange = useCallback((settings: { cbm: number; kg: number; mode: "road" | "courier" }) => {
    setLandedCostSettings((prev) => (
      prev.cbm === settings.cbm && prev.kg === settings.kg && prev.mode === settings.mode ? prev : settings
    ));
    void supabase.from("trade_quotes").update({
      landed_cost_cbm: settings.cbm,
      landed_cost_kg: settings.kg,
      landed_cost_mode: settings.mode,
    } as any).eq("id", quoteId);
  }, [quoteId]);

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
              <p className="font-body text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                <span>Currency: {currencySymbol(currency)} {currency}</span>
                {fxSource !== "identity" && <FxSourceBadge source={fxSource} />}
                {quote?.notes && <span>· User notes: <span className="italic">"{quote.notes}"</span></span>}
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
                  const discountedUnit = ownerDiscountPct > 0 ? Math.round(cents * (1 - ownerDiscountPct)) : cents;
                  const lead = leadTimes[item.id];
                  // Per-line admin override wins over the catalog/brand default from the RPC.
                  const overrideLead = leadOverride(item.lead_time_weeks_override);
                  const leadLabel = overrideLead
                    ? `Lead time: ${overrideLead} weeks`
                    : formatLeadTime(lead);
                  const catalog = catalogPrices[item.id];
                  // Only show the suggestion when we used it to pre-fill (i.e. no admin price has been saved yet).
                  const showCatalogHint = catalog && !item.unit_price_cents;

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
                          {leadLabel && (
                            <p className="font-body text-[10px] text-muted-foreground">{leadLabel}</p>
                          )}
                          {showCatalogHint && (
                            <p className="font-body text-[10px] text-muted-foreground/60">
                              Suggested {catalog.match === "fuzzy" ? "(≈)" : "(catalog)"}: {formatPrice(catalog.cents, catalog.currency)}
                              {catalog.match === "fuzzy" && catalog.matched_name && (
                                <span className="italic"> · from "{catalog.matched_name}"</span>
                              )}
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
                        {ownerDiscountPct > 0 && cents > 0 && (
                          <p className="font-body text-[9px] text-emerald-600/80 text-right mt-0.5">
                            After {(ownerDiscountPct * 100).toFixed(0)}% trade: {formatPrice(discountedUnit, currency)}
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
              <div className="border-t border-border mt-2 pt-4 flex flex-col items-end">
                {subtotalCents > 0 && isUkDestination && (
                  <div className="w-72">
                    <QuoteDisplayCurrencyToggle
                      value={displayCcy}
                      onChange={setDisplayCcy}
                      quoteCurrency={currency}
                      disabled={displayCcy === "quote" ? false : !gbp.ready}
                    />
                  </div>
                )}
                {(() => {
                  const discountCents = ownerDiscountPct > 0 ? Math.round(subtotalCents * ownerDiscountPct) : 0;
                  const afterDiscountCents = subtotalCents - discountCents;
                  // Strict GST guard: only when the quote is SGD AND fully loaded (never on the SGD fallback while quote is still null).
                  const showGst = quote?.currency === "SGD" && afterDiscountCents > 0;
                  const gstCents = showGst ? Math.round(afterDiscountCents * 0.09) : 0;
                  const totalCents = afterDiscountCents + gstCents;

                  // GBP DDP view
                  if (displayCcy === "gbp" && isUkDestination) {
                    return (
                      <div className="w-72 space-y-1">
                        <div className="flex justify-between font-body text-xs text-muted-foreground">
                          <span>Goods (after discount)</span>
                          <span>{gbp.ready ? fmtGbp(gbp.goodsGbpCents) : "…"}</span>
                        </div>
                        <div className="flex justify-between font-body text-xs text-muted-foreground">
                          <span>Shipping FR → GB</span>
                          <span>{gbp.ready ? fmtGbp(gbp.shippingGbpCents) : "…"}</span>
                        </div>
                        {gbp.dutyGbpCents > 0 && (
                          <div className="flex justify-between font-body text-xs text-muted-foreground">
                            <span>Import duty</span>
                            <span>{fmtGbp(gbp.dutyGbpCents)}</span>
                          </div>
                        )}
                        {gbp.vatGbpCents > 0 && (
                          <div className="flex justify-between font-body text-xs text-muted-foreground">
                            <span>UK VAT</span>
                            <span>{fmtGbp(gbp.vatGbpCents)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-display text-sm text-foreground pt-2 border-t border-border">
                          <span className="uppercase tracking-wider">Total GBP · DDP London</span>
                          <span className="font-medium">
                            {gbp.ready ? fmtGbp(gbp.totalGbpCents) : "…"}
                          </span>
                        </div>
                        <p className="font-body text-[10px] text-muted-foreground/80 leading-relaxed pt-1">
                          Indicative. EUR→GBP @ {gbp.fxEurGbp?.toFixed(4)} (+2% FX buffer). DDP — duty &amp; VAT included. Adjust CBM/weight in the panel below.
                        </p>
                        {gbp.fxIsFallback && (
                          <p className="font-body text-[10px] text-amber-700 leading-relaxed">
                            ⚠ Live FX unavailable — figures use a fallback indicative rate. Treat the GBP total as approximate (≈).
                          </p>
                        )}
                      </div>
                    );
                  }

                  // Quote currency view (default)
                  return (
                    <div className="w-72 space-y-1">
                      <div className="flex justify-between font-body text-xs text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{subtotalCents > 0 ? formatPrice(subtotalCents, currency) : "—"}</span>
                      </div>
                      {ownerDiscountPct > 0 && subtotalCents > 0 && (
                        <div className="flex justify-between font-body text-xs text-emerald-600/80">
                          <span>Trade discount ({(ownerDiscountPct * 100).toFixed(0)}% · {ownerTierLabel})</span>
                          <span>− {formatPrice(discountCents, currency)}</span>
                        </div>
                      )}
                      {showGst && (
                        <div className="flex justify-between font-body text-xs text-muted-foreground">
                          <span>GST (9%)</span>
                          <span>{formatPrice(gstCents, currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-display text-sm text-foreground pt-2 border-t border-border">
                        <span className="uppercase tracking-wider">Total {currency}</span>
                        <span className="font-medium">
                          {subtotalCents > 0 ? formatPrice(totalCents, currency) : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* UK landed cost (DDP, GBP) — only for linked UK clients */}
              {subtotalCents > 0 && isUkDestination && (() => {
                const discountCents = ownerDiscountPct > 0 ? Math.round(subtotalCents * ownerDiscountPct) : 0;
                const goodsAfter = subtotalCents - discountCents;
                return (
                  <div className="mt-4">
                    <UkLandedCostPanel
                      goodsAfterDiscountCents={goodsAfter}
                      quoteCurrency={currency}
                      defaultExpanded={true}
                      title="UK landed cost (DDP, GBP) — admin preview"
                      quoteRef={`QU-${quoteId.slice(0, 6).toUpperCase()}`}
                      clientName={quote?.client_name ?? null}
                      initialCbm={landedCostSettings.cbm}
                      initialKg={landedCostSettings.kg}
                      initialMode={landedCostSettings.mode}
                      onSettingsChange={handleLandedCostSettingsChange}
                    />
                  </div>
                );
              })()}
              {subtotalCents > 0 && !clientCountry && (
                <div className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Select a delivery country</p>
                  <p className="mt-1">
                    Link a client with a billing country before showing any destination-specific landed-cost panel.
                  </p>
                </div>
              )}
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
          <div className="border-t border-border p-4 md:p-6 flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={handleCancelQuote}
              disabled={saving}
              className="inline-flex items-center gap-2 px-3 py-2 border border-destructive/30 text-destructive font-body text-[10px] uppercase tracking-[0.1em] rounded-md hover:bg-destructive/10 transition-colors disabled:opacity-40"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancel Quote
            </button>
            <button
              onClick={handleRequestChanges}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 border border-border font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-muted transition-colors text-foreground disabled:opacity-40"
            >
              <Edit3 className="h-3.5 w-3.5" /> Request Changes
            </button>
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
